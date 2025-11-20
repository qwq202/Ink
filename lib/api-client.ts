import type { ProviderConfig } from "./providers"
import { logDebug } from "./logger"
import { FAL_IMAGE_SIZE_ENUMS, parseImageSize } from "./image-utils"

export interface GenerationParams {
  prompt: string
  imageSize: string
  numImages: number
  seed?: number
  safetyChecker?: boolean
  syncMode?: boolean
  images?: File[]
  modelId?: string
  quality?: string
  style?: string
  openaiApiKey?: string
}

export interface GenerationResult {
  id: string
  images: string[]
  provider: string
  params: GenerationParams
  timestamp: number
  status: "success" | "error"
  error?: string
}

async function callFalAPI(provider: ProviderConfig, params: GenerationParams): Promise<string[]> {
  const normalizeEndpoint = (path: string) => path.replace(/\/$/, "")

  const computeFalEndpoint = () => {
    const fallbackModelId = params.modelId?.replace(/^\/+/, "")

    if (!fallbackModelId) {
      return normalizeEndpoint(provider.endpoint)
    }

    if (provider.endpoint) {
      try {
        const parsed = new URL(provider.endpoint)
        return normalizeEndpoint(`${parsed.origin}/${fallbackModelId}`)
      } catch {
        const originMatch = provider.endpoint.match(/^https?:\/\/[^/]+/)
        if (originMatch) {
          return normalizeEndpoint(`${originMatch[0]}/${fallbackModelId}`)
        }
      }
    }

    return normalizeEndpoint(`https://queue.fal.run/${fallbackModelId}`)
  }

  const baseEndpoint = computeFalEndpoint()

  const requestedImageSize = params.imageSize || "landscape_4_3"
  const useAutoImageSize = Boolean(params.images?.length) && requestedImageSize === "auto"
  let falImageSize: string | { width: number; height: number } | undefined

  if (!useAutoImageSize) {
    if (requestedImageSize && FAL_IMAGE_SIZE_ENUMS.has(requestedImageSize)) {
      falImageSize = requestedImageSize
    } else {
      const { width, height } = parseImageSize(requestedImageSize)
      falImageSize = { width, height }
    }
  }

  const payload: Record<string, unknown> = {
    prompt: params.prompt,
    num_images: params.numImages,
    sync_mode: params.syncMode ?? true,
  }

  if (falImageSize) {
    payload.image_size = falImageSize
  }

  if (typeof params.seed === "number") {
    payload.seed = params.seed
  }

  if (typeof params.safetyChecker === "boolean") {
    payload.enable_safety_checker = params.safetyChecker
  }

  if (params.images && params.images.length > 0) {
    if (useAutoImageSize) {
      delete payload.image_size
    }
    const toDataUrl = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result)
          } else {
            reject(new Error("无法读取图片数据"))
          }
        }
        reader.onerror = () => reject(reader.error ?? new Error("读取图片数据失败"))
        reader.readAsDataURL(file)
      })

    const imageDataUrls = await Promise.all(params.images.map((file) => toDataUrl(file)))
    const primaryImageUrl = imageDataUrls[0]

    payload.image_url = primaryImageUrl
    payload.image_urls = imageDataUrls
    const isClarityUpscaler = baseEndpoint.includes("clarity-upscaler")

    if (isClarityUpscaler) {
      delete payload.image_size
      delete payload.num_images
    }

    if (payload.prompt == null || payload.prompt === "") {
      payload.prompt = "masterpiece, best quality, highres"
    }

    if (payload.negative_prompt == null) {
      payload.negative_prompt = "(worst quality, low quality, normal quality:2)"
    }

    if (payload.upscale_factor == null) {
      payload.upscale_factor = 2
    }

    if (payload.creativity == null) {
      payload.creativity = 0.35
    }

    if (payload.resemblance == null) {
      payload.resemblance = 0.6
    }

    if (payload.guidance_scale == null) {
      payload.guidance_scale = 4
    }

    if (isClarityUpscaler) {
      payload.num_inference_steps = payload.num_inference_steps ?? 18
    } else if (payload.num_inference_steps == null) {
      payload.num_inference_steps = 18
    }

    if (payload.enable_safety_checker == null) {
      payload.enable_safety_checker = true
    }

  }

  if (params.openaiApiKey) {
    payload.openai_api_key = params.openaiApiKey
  }

  await logDebug({
    message: "FAL request dispatch",
    details: {
      provider: provider.id,
      endpoint: provider.endpoint,
      resolvedEndpoint: baseEndpoint,
      mode: params.images && params.images.length > 0 ? "img2img" : "txt2img",
      promptPreview: params.prompt.substring(0, 120),
      promptLength: params.prompt.length,
      numImages: params.numImages,
      syncMode: payload.sync_mode,
      hasImageInput: Boolean(params.images?.length),
      modelId: params.modelId,
      requestOrigin: provider.requestOrigin ?? "client",
    },
  })

  const useServerProxy = (provider.requestOrigin ?? "client") === "server"

  const executeFalRequest = async () => {
    if (useServerProxy) {
      const response = await fetch("/api/fal/proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: baseEndpoint,
          apiKey: provider.apiKey,
          resource: "generate",
          payload,
        }),
      })

      const raw = await response.text()
      let parsed: any = null
      if (raw) {
        try {
          parsed = JSON.parse(raw)
        } catch {
          parsed = { raw }
        }
      }

      return { response, data: parsed }
    }

    const response = await fetch(baseEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Key ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json().catch(async () => {
      const fallback = await response.text()
      throw new Error(fallback || "FAL API 返回了无效的响应。")
    })

    return { response, data }
  }

  const { response, data } = await executeFalRequest()

  await logDebug({
    message: "FAL initial response received",
    details: {
      provider: provider.id,
      status: response.status,
      ok: response.ok,
      requestId: data?.request_id,
    },
  })

  if (!response.ok) {
    const detail = data?.error || data?.message || data?.detail || "未知错误"
    await logDebug({
      level: "error",
      message: "FAL request failed",
      details: {
        provider: provider.id,
        status: response.status,
        detail,
      },
    })
    throw new Error(`FAL API error: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`)
  }

  const pollFalQueue = async (requestId: string): Promise<any> => {
    const statusUrl = `${baseEndpoint}/requests/${requestId}/status`
    const resultUrl = `${baseEndpoint}/requests/${requestId}`
    const pollIntervalMs = 2000
    const maxPollDurationMs = 4 * 60 * 1000 // allow up to 4 minutes for long-running queues
    const maxAttempts = Math.max(30, Math.ceil(maxPollDurationMs / pollIntervalMs))
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    const proxyRequest = async (
      resourceType: "status" | "result",
      endpointCandidate: string,
      fallbackAttempted = false,
    ): Promise<{ response: Response; endpointUsed: string; resourceUsed: "status" | "result" }> => {
      const response = await fetch("/api/fal/proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: endpointCandidate,
          requestId,
          apiKey: provider.apiKey,
          resource: resourceType,
        }),
      })

      if (!response.ok && !fallbackAttempted && (response.status === 404 || response.status === 405)) {
        const segments = endpointCandidate.split("/")
        if (segments.length > 4) {
          const fallbackEndpoint = segments.slice(0, -1).join("/")
          await logDebug({
            message: "FAL proxy fallback endpoint",
            details: {
              originalEndpoint: endpointCandidate,
              fallbackEndpoint,
              resourceType,
              responseStatus: response.status,
              resourceUsed: resourceType,
            },
          })
          return await proxyRequest(resourceType, fallbackEndpoint, true)
        }
      }

      return { response, endpointUsed: endpointCandidate, resourceUsed: resourceType }
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let { response: statusResponse, endpointUsed: statusEndpoint, resourceUsed } = await proxyRequest(
        "status",
        baseEndpoint,
      )

      if (statusResponse.status === 405) {
        await logDebug({
          message: "FAL status endpoint returned 405, retrying with result endpoint",
          details: {
            provider: provider.id,
            requestId,
            attempt: attempt + 1,
            endpoint: statusEndpoint,
          },
        })

        const fallbackStatus = await proxyRequest("result", baseEndpoint)
        statusResponse = fallbackStatus.response
        statusEndpoint = fallbackStatus.endpointUsed
        resourceUsed = fallbackStatus.resourceUsed
      }

      if (!statusResponse.ok) {
        const statusText = await statusResponse.text()
        await logDebug({
          level: "error",
          message: "FAL queue status fetch failed",
          details: {
            provider: provider.id,
            requestId,
            attempt: attempt + 1,
            status: statusResponse.status,
            body: statusText,
            endpoint: statusEndpoint,
            resourceUsed,
          },
        })
        throw new Error(statusText || "FAL 队列状态查询失败。")
      }

      const statusData = await statusResponse.json().catch(() => ({}))
      const status = (statusData?.status || statusData?.state || "").toString().toLowerCase()

      await logDebug({
        message: "FAL queue status polled",
        details: {
          provider: provider.id,
          requestId,
          attempt: attempt + 1,
          status,
          endpoint: statusEndpoint,
        },
      })

      if (status === "completed" || status === "succeeded" || status === "success") {
        const { response: resultResponse, endpointUsed: resultEndpoint } = await proxyRequest("result", baseEndpoint)

        if (!resultResponse.ok) {
          const resultText = await resultResponse.text()
          await logDebug({
            level: "error",
            message: "FAL queue result fetch failed",
            details: {
              provider: provider.id,
              requestId,
              status: resultResponse.status,
              body: resultText,
              endpoint: resultEndpoint,
            },
          })
          throw new Error(resultText || "FAL 队列结果获取失败。")
        }

        const resultData = await resultResponse.json()

        await logDebug({
          message: "FAL queue result received",
          details: {
            provider: provider.id,
            requestId,
            endpoint: resultEndpoint,
            imageCount: Array.isArray(resultData?.images) ? resultData.images.length : undefined,
          },
        })

        return resultData
      }

      if (status === "failed" || status === "error") {
        const reason = statusData?.error || statusData?.message || "FAL 队列任务执行失败。"
        await logDebug({
          level: "error",
          message: "FAL queue task failed",
          details: {
            provider: provider.id,
            requestId,
            reason,
          },
        })
        throw new Error(typeof reason === "string" ? reason : JSON.stringify(reason))
      }

      await delay(pollIntervalMs)
    }

    await logDebug({
      level: "warn",
      message: "FAL queue polling timed out",
      details: {
        provider: provider.id,
        requestId,
        maxAttempts,
      },
    })

    throw new Error("FAL 队列等待超时，请稍后重试或手动查询。")
  }

  const extractImageUrls = (result: unknown): string[] => {
    if (!result) return []

    if (typeof result === "string") {
      return [result]
    }

    if (Array.isArray(result)) {
      return result.flatMap((item) => extractImageUrls(item))
    }

    if (typeof result === "object") {
      const record = result as Record<string, unknown>
      const urls: string[] = []

      const directKeys = [
        "url",
        "uri",
        "image",
        "image_url",
        "signed_url",
        "signedUrl",
        "download_url",
        "downloadUrl",
        "file_url",
      ]
      for (const key of directKeys) {
        const value = record[key]
        if (typeof value === "string" && value) {
          urls.push(value)
        }
      }

      if (typeof record.b64_json === "string" && record.b64_json) {
        urls.push(`data:image/png;base64,${record.b64_json}`)
      }

      const nestedKeys = ["image", "images", "data", "output", "result", "contents", "items", "file", "files"]
      for (const key of nestedKeys) {
        if (record[key] != null) {
          urls.push(...extractImageUrls(record[key]))
        }
      }

      return Array.from(new Set(urls))
    }

    return []
  }

  const imageCandidates = [
    ...extractImageUrls(data?.images),
    ...extractImageUrls(data?.image),
    ...extractImageUrls(data?.output),
    ...extractImageUrls(data?.result?.images),
    ...extractImageUrls(data?.result?.image),
    ...extractImageUrls(data?.result),
  ].filter(Boolean)

  const images = Array.from(new Set(imageCandidates))

  if (images.length === 0) {
    if (data?.request_id) {
      const queueData = await pollFalQueue(data.request_id)
      await logDebug({
        message: "FAL queue final payload",
        details: {
          provider: provider.id,
          requestId: data.request_id,
          status: queueData?.status,
          keys: queueData ? Object.keys(queueData) : null,
        },
      })

      const queueImages = [
        ...extractImageUrls(queueData?.images),
        ...extractImageUrls(queueData?.image),
        ...extractImageUrls(queueData?.output),
        ...extractImageUrls(queueData?.result?.images),
        ...extractImageUrls(queueData?.result?.image),
        ...extractImageUrls(queueData?.result),
      ].filter(Boolean)

      if (queueImages.length > 0) {
        await logDebug({
          message: "FAL queue images returned after polling",
          details: {
            provider: provider.id,
            requestId: data.request_id,
            imageCount: queueImages.length,
          },
        })
        // 对于 FAL 队列结果，保持返回的图片数量与后端一致，不再做去重，
        // 否则当 FAL 返回的多张图片指向相同地址时，Set 去重会导致前端看到的数量少于 num_images。
        const targetCount = typeof params.numImages === "number" && params.numImages > 0 ? params.numImages : undefined
        const finalImages =
          targetCount && queueImages.length >= targetCount
            ? queueImages.slice(0, targetCount)
            : queueImages

        return finalImages
      }

      const queueError = queueData?.error || queueData?.message
      if (queueError) {
        await logDebug({
          level: "error",
          message: "FAL queue reported error",
          details: {
            provider: provider.id,
            requestId: data.request_id,
            error: queueError,
          },
        })
        throw new Error(
          typeof queueError === "string"
            ? "FAL 请求失败: " + queueError
            : "FAL 请求失败: " + JSON.stringify(queueError),
        )
      }

      await logDebug({
        level: "warn",
        message: "FAL queue finished without images",
        details: {
          provider: provider.id,
          requestId: data.request_id,
          status: queueData?.status,
          imagePreview: Array.isArray(queueData?.images)
            ? queueData.images.slice(0, 1)
            : typeof queueData?.images === "object"
            ? queueData.images
            : undefined,
        },
      })

      throw new Error(
        "FAL 队列未返回图像结果，状态: " + (queueData?.status || "未知") + "。Request ID: " + data.request_id,
      )
    }

    throw new Error("FAL API 未返回图像结果。")
  }

  await logDebug({
    message: "FAL request completed with images",
    details: {
      provider: provider.id,
      imageCount: images.length,
      requestId: data?.request_id,
    },
  })

  return images
}

async function callOpenAIAPI(provider: ProviderConfig, params: GenerationParams): Promise<string[]> {
  const { width, height } = parseImageSize(params.imageSize)
  const imageSizeString = `${width}x${height}`

  await logDebug({
    message: "OpenAI image request dispatch",
    details: {
      provider: provider.id,
      endpoint: provider.endpoint,
      promptPreview: params.prompt.substring(0, 120),
      promptLength: params.prompt.length,
      numImages: params.numImages,
      imageSize: imageSizeString,
    },
  })

  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      prompt: params.prompt,
      n: params.numImages,
      size: imageSizeString,
      response_format: "url",
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    await logDebug({
      level: "error",
      message: "OpenAI image request failed",
      details: {
        provider: provider.id,
        status: response.status,
        error: error?.error?.message || error,
      },
    })
    throw new Error(`OpenAI API error: ${error.error?.message || "Unknown error"}`)
  }

  const data = await response.json()
  await logDebug({
    message: "OpenAI image request completed",
    details: {
      provider: provider.id,
      status: response.status,
      imageCount: Array.isArray(data?.data) ? data.data.length : undefined,
    },
  })
  return data.data?.map((item: { url: string }) => item.url) || []
}

export async function generateImages(provider: ProviderConfig, params: GenerationParams): Promise<string[]> {
  const hasInputImages = params.images && params.images.length > 0
  const { width: normalizedWidth, height: normalizedHeight } = parseImageSize(params.imageSize)
  const normalizedImageSize = `${normalizedWidth}x${normalizedHeight}`

  async function parseJson(response: Response) {
    const text = await response.text()
    try {
      return JSON.parse(text)
    } catch {
      throw new Error(text || "NewAPI response parsing failed")
    }
  }

  async function callNewAPI(): Promise<string[]> {
    const newapiModel = params.modelId || "dall-e-2"
    const useServerProxy = (provider.requestOrigin ?? "server") === "server"
    const maxAttempts = 3
    const retryDelay = (attempt: number) =>
      new Promise((resolve) => setTimeout(resolve, 600 * attempt))
    const rateLimitStatuses = new Set([429, 430, 431, 503, 524])
    
    if (hasInputImages) {
      const formData = new FormData()
      
      // Model is always required for NewAPI
      formData.append("model", newapiModel)
      formData.append("prompt", params.prompt)
      formData.append("n", params.numImages.toString())
      formData.append("size", normalizedImageSize)

      if (params.quality) {
        formData.append("quality", params.quality)
      }
      
      // Use image[] for multiple images, image for single image
      const useArrayFormat = params.images && params.images.length > 1
      
      params.images?.forEach((image) => {
        formData.append(useArrayFormat ? "image[]" : "image", image)
      })

      await logDebug({
        message: "NewAPI image edit dispatch",
        details: {
          provider: provider.id,
          endpoint: provider.endpoint,
          promptPreview: params.prompt.substring(0, 120),
          promptLength: params.prompt.length,
          numImages: params.numImages,
          imageSize: normalizedImageSize,
          imageCount: params.images?.length,
          useServerProxy,
        },
      })

      const performRequest = () => {
        if (useServerProxy) {
          formData.set("endpoint", provider.endpoint)
          formData.set("apiKey", provider.apiKey)
          formData.set("mode", "edit")

          return fetch("/api/newapi/generate", {
            method: "POST",
            body: formData,
          })
        }

        let baseUrl = provider.endpoint.trim().replace(/\/+$/, "")
        if (baseUrl.includes("/v1/images")) {
          const match = baseUrl.match(/^(https?:\/\/[^/]+)/)
          baseUrl = match ? match[1] : baseUrl
        }
        const editEndpoint = `${baseUrl}/v1/images/edits`

        return fetch(editEndpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
          },
          body: formData,
        })
      }

      let response: Response
      let attempt = 0
      while (true) {
        response = await performRequest()
        if (response.status !== 524 || attempt >= maxAttempts - 1) {
          break
        }
        attempt += 1
        await logDebug({
          level: "warn",
          message: "NewAPI edit timeout, retrying",
          details: {
            provider: provider.id,
            attempt,
          },
        })
        await retryDelay(attempt)
      }

      const data = await parseJson(response)

      if (!response.ok) {
        const message = data?.error?.message || data?.message || "NewAPI image edit failed"
        const isRateLimited = rateLimitStatuses.has(response.status)
        await logDebug({
          level: "error",
          message: "NewAPI image edit failed",
          details: {
            provider: provider.id,
            status: response.status,
            error: message,
            rateLimited: isRateLimited,
          },
        })
        if (isRateLimited) {
          throw new Error("NewAPI API error: 请求过于频繁，请稍后重试或降低并发。")
        }
        throw new Error(`NewAPI API error: ${message}`)
      }

      const images =
        data?.data?.map((item: { url?: string; b64_json?: string }) => {
          if (item?.url) return item.url
          if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`
          return null
        }) || []

      if (!images.length) {
        await logDebug({
          level: "warn",
          message: "NewAPI image edit returned no images",
          details: {
            provider: provider.id,
          },
        })
        throw new Error("NewAPI did not return any edited images")
      }

      const filtered = images.filter(Boolean) as string[]

      await logDebug({
        message: "NewAPI image edit completed",
        details: {
          provider: provider.id,
          imageCount: filtered.length,
        },
      })

      return filtered
    }

    // Text-to-image generation
    await logDebug({
      message: "NewAPI image generation dispatch",
      details: {
        provider: provider.id,
        endpoint: provider.endpoint,
        promptPreview: params.prompt.substring(0, 120),
        promptLength: params.prompt.length,
        numImages: params.numImages,
        imageSize: normalizedImageSize,
        useServerProxy,
      },
    })

    const performGeneration = () => {
      if (useServerProxy) {
        const formData = new FormData()
        formData.append("endpoint", provider.endpoint)
        formData.append("apiKey", provider.apiKey)
        formData.append("mode", "generation")
        formData.append("model", newapiModel)
        formData.append("prompt", params.prompt)
        formData.append("n", params.numImages.toString())
        formData.append("size", normalizedImageSize)
        formData.append("response_format", "url")

        if (params.quality) {
          formData.append("quality", params.quality)
        }

        if (params.style && newapiModel === "dall-e-3") {
          formData.append("style", params.style)
        }

        return fetch("/api/newapi/generate", {
          method: "POST",
          body: formData,
        })
      }

      let baseUrl = provider.endpoint.trim().replace(/\/+$/, "")
      if (baseUrl.includes("/v1/images")) {
        const match = baseUrl.match(/^(https?:\/\/[^/]+)/)
        baseUrl = match ? match[1] : baseUrl
      }
      const generationEndpoint = `${baseUrl}/v1/images/generations`

      const requestBody: Record<string, unknown> = {
        model: newapiModel,
        prompt: params.prompt,
        n: params.numImages,
        size: normalizedImageSize,
        response_format: "url",
      }

      if (params.quality) {
        requestBody.quality = params.quality
      }

      if (params.style && newapiModel === "dall-e-3") {
        requestBody.style = params.style
      }

      return fetch(generationEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      })
    }

    let response: Response
    let attempt = 0
    while (true) {
      response = await performGeneration()
      if (response.status !== 524 || attempt >= maxAttempts - 1) {
        break
      }
      attempt += 1
      await logDebug({
        level: "warn",
        message: "NewAPI generation timeout, retrying",
        details: {
          provider: provider.id,
          attempt,
        },
      })
      await retryDelay(attempt)
    }

    const data = await parseJson(response)

    if (!response.ok) {
      const message = data?.error?.message || data?.message || "NewAPI image generation failed"
      const isRateLimited = rateLimitStatuses.has(response.status)
      await logDebug({
        level: "error",
        message: "NewAPI image generation failed",
        details: {
          provider: provider.id,
          status: response.status,
          error: message,
          rateLimited: isRateLimited,
        },
      })
      if (isRateLimited) {
        throw new Error("NewAPI API error: 请求过于频繁，请稍后重试或降低频率。")
      }
      throw new Error(`NewAPI API error: ${message}`)
    }

    const images =
      data?.data?.map((item: { url?: string; b64_json?: string }) => {
        if (item?.url) return item.url
        if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`
        return null
      }) || []

    if (!images.length) {
      await logDebug({
        level: "warn",
        message: "NewAPI image generation returned no images",
        details: {
          provider: provider.id,
        },
      })
      throw new Error("NewAPI did not return any generated images")
    }

    const filtered = images.filter(Boolean) as string[]

    await logDebug({
      message: "NewAPI image generation completed",
      details: {
        provider: provider.id,
        imageCount: filtered.length,
      },
    })

    return filtered
  }

  async function callOpenRouterAPI(): Promise<string[]> {
    const openrouterModel = params.modelId || "google/gemini-2.5-flash-image"
    const useServerProxy = (provider.requestOrigin ?? "server") === "server"

    await logDebug({
      message: "OpenRouter image generation dispatch",
      details: {
        provider: provider.id,
        endpoint: provider.endpoint,
        model: openrouterModel,
        promptPreview: params.prompt.substring(0, 120),
        promptLength: params.prompt.length,
        numImages: params.numImages,
        imageSize: normalizedImageSize,
        useServerProxy,
      },
    })

    const [width, height] = normalizedImageSize.split("x").map((value) => Number.parseInt(value, 10))
    const parsedWidth = Number.isFinite(width) ? width : 1024
    const parsedHeight = Number.isFinite(height) ? height : 1024

    const buildPayload = () => {
      const promptSegments = [params.prompt]
      if (params.style) {
        promptSegments.push(`Style: ${params.style}`)
      }
      if (params.quality) {
        promptSegments.push(`Quality: ${params.quality}`)
      }

      return {
        model: openrouterModel,
        messages: [
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: promptSegments.join("\n\n") }],
          },
        ],
        modalities: ["image", "text"],
        max_output_tokens: 1024,
        extra_body: {
          image_dimensions: {
            width: parsedWidth,
            height: parsedHeight,
          },
          num_images: params.numImages,
        },
      }
    }

    const performGeneration = () => {
      if (useServerProxy) {
        const formData = new FormData()
        formData.append("endpoint", provider.endpoint)
        formData.append("apiKey", provider.apiKey)
        formData.append("model", openrouterModel)
        formData.append("prompt", params.prompt)
        formData.append("size", normalizedImageSize)
        formData.append("n", params.numImages.toString())
        if (params.quality) {
          formData.append("quality", params.quality)
        }
        if (params.style) {
          formData.append("style", params.style)
        }
        return fetch("/api/openrouter/generate", {
          method: "POST",
          body: formData,
        })
      }

      return fetch(`${provider.endpoint}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify(buildPayload()),
      })
    }

    const response = await performGeneration()
    const data = await parseJson(response)

    if (!response.ok) {
      const message = data?.error?.message || data?.message || "OpenRouter image generation failed"
      await logDebug({
        level: "error",
        message: "OpenRouter image generation failed",
        details: {
          provider: provider.id,
          status: response.status,
          error: message,
        },
      })
      throw new Error(`OpenRouter API error: ${message}`)
    }

    const images: string[] = []
    const choices = Array.isArray(data?.choices) ? data.choices : []
    for (const choice of choices) {
      const message = choice?.message
      const responseImages = message?.images
      if (Array.isArray(responseImages)) {
        for (const imagePayload of responseImages) {
          const url = imagePayload?.image_url?.url
          if (typeof url === "string") {
            images.push(url)
          }
        }
      }
    }

    if (!images.length) {
      await logDebug({
        level: "warn",
        message: "OpenRouter returned no images",
        details: {
          provider: provider.id,
        },
      })
      throw new Error("OpenRouter did not return any images")
    }

    await logDebug({
      message: "OpenRouter image generation completed",
      details: {
        provider: provider.id,
        imageCount: images.length,
      },
    })

    return images
  }

  switch (provider.id) {
    case "fal":
      return await callFalAPI(provider, params)
    case "openai":
      return await callOpenAIAPI(provider, params)
    case "newapi":
      return await callNewAPI()
    case "openrouter":
      return await callOpenRouterAPI()
    default:
      throw new Error(`Unknown provider: ${provider.id}`)
  }
}

export interface NewApiModelsResponse {
  success: boolean
  data?: Record<string, string[]>
  message?: string
}

export async function fetchNewApiModels(provider: ProviderConfig): Promise<NewApiModelsResponse> {
  if (!provider.endpoint) {
    throw new Error("NewAPI endpoint 未配置")
  }

  if (!provider.apiKey) {
    throw new Error("请先在设置中填写 NewAPI API Key")
  }

  // Normalize base endpoint
  let baseUrl = provider.endpoint.trim().replace(/\/+$/, "")
  if (baseUrl.includes("/v1/images")) {
    const match = baseUrl.match(/^(https?:\/\/[^/]+)/)
    baseUrl = match ? match[1] : baseUrl
  }
  
  const modelsUrl = `${baseUrl}/v1/models`

  await logDebug({
    message: "NewAPI models fetch dispatch",
    details: {
      endpoint: modelsUrl,
      provider: provider.id,
    },
  })

  const response = await fetch(modelsUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
  })

  const text = await response.text()
  let json: any

  try {
    json = JSON.parse(text)
  } catch (error) {
    await logDebug({
      level: "error",
      message: "NewAPI models fetch parse failed",
      details: {
        body: text,
        error: error instanceof Error ? error.message : String(error),
      },
    })
    throw new Error("无法解析 NewAPI 模型列表响应")
  }

  if (!response.ok) {
    await logDebug({
      level: "error",
      message: "NewAPI models fetch failed",
      details: {
        status: response.status,
        body: json,
      },
    })
    throw new Error(json.message || json.error?.message || `NewAPI 获取模型失败，状态码 ${response.status}`)
  }

  // Convert OpenAI format to NewAPI format
  let result: NewApiModelsResponse
  
  if (json.object === "list" && Array.isArray(json.data)) {
    // OpenAI standard format: { object: "list", data: [{ id: "model-id", ... }] }
    const models: Record<string, string[]> = {
      "default": json.data.map((model: any) => model.id).filter(Boolean)
    }
    result = {
      success: true,
      data: models
    }
    
    await logDebug({
      message: "NewAPI models fetch completed (OpenAI format)",
      details: {
        status: response.status,
        modelCount: json.data.length,
      },
    })
  } else if (json.success && json.data) {
    // NewAPI custom format: { success: true, data: { channel: ["model1", "model2"] } }
    result = json as NewApiModelsResponse
    
    await logDebug({
      message: "NewAPI models fetch completed (custom format)",
      details: {
        status: response.status,
        channelCount: Object.keys(json.data).length,
      },
    })
  } else {
    throw new Error("未知的模型列表响应格式")
  }

  return result
}
