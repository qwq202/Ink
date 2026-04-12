import type { ProviderConfig } from "./providers"
import { logDebug } from "./logger"
import { FAL_IMAGE_SIZE_ENUMS, parseImageSize } from "./image-utils"
import { createBrowserFalClient } from "./fal-client"
import { callOpenAIImageAPI } from "./openai-image-api"
import { callOpenAIResponsesAPI } from "./openai-responses-api"
import type { OpenAIAPIMode } from "./providers"

export interface GenerationParams {
  prompt: string
  imageSize: string
  numImages: number
  providerId?: string
  seed?: number
  safetyChecker?: boolean
  syncMode?: boolean
  images?: File[]
  modelId?: string
  quality?: string
  style?: string
  thinkingLevel?: "low" | "high"
  mediaResolution?: "media_resolution_low" | "media_resolution_medium" | "media_resolution_high"
  aspectRatio?: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9"
  openaiApiKey?: string
  // FAL nano-banana-pro 专用参数
  falNanoBananaAspectRatio?: "21:9" | "16:9" | "3:2" | "4:3" | "5:4" | "1:1" | "4:5" | "3:4" | "2:3" | "9:16"
  falNanoBananaResolution?: "1K" | "2K" | "4K"
  falNanoBananaOutputFormat?: "jpeg" | "png" | "webp"
  // FAL gemini-3-pro-image-preview 专用参数（Nano Banana 2）
  falGemini3ProAspectRatio?: "21:9" | "16:9" | "3:2" | "4:3" | "5:4" | "1:1" | "4:5" | "3:4" | "2:3" | "9:16"
  falGemini3ProResolution?: "1K" | "2K" | "4K"
  falGemini3ProOutputFormat?: "jpeg" | "png" | "webp"
  // OpenAI
  openaiApiMode?: OpenAIAPIMode
  openaiPreviousResponseId?: string
  openaiResponseId?: string
  openaiImageQuality?: "standard" | "hd"
  openaiImageStyle?: "vivid" | "natural"
  openaiResponsesMode?: "text" | "image"
  openaiResponsesMaxOutputTokens?: number
  openaiResponsesTemperature?: number
}

export interface GenerationResult {
  id: string
  images: string[]
  provider: string
  params: GenerationParams
  timestamp: number
  status: "success" | "error"
  error?: string
  isFavorite?: boolean
  rating?: number
  tags?: string[]
  thumbnails?: string[]
}

async function callFalAPI(provider: ProviderConfig, params: GenerationParams): Promise<string[]> {
  const isImg2ImgMode = Boolean(params.images?.length)
  let modelId = params.modelId?.replace(/^\/+/, "") || "fal-ai/flux/dev"

  if (modelId === "fal-ai/nano-banana-pro" && isImg2ImgMode) {
    modelId = "fal-ai/nano-banana-pro/edit"
  }
  if (modelId === "fal-ai/gemini-3-pro-image-preview" && isImg2ImgMode) {
    modelId = "fal-ai/gemini-3-pro-image-preview/edit"
  }

  const requestedImageSize = params.imageSize || "landscape_4_3"
  const useAutoImageSize = isImg2ImgMode && requestedImageSize === "auto"
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

  const falClient = createBrowserFalClient(provider.apiKey)

  if (params.images?.length) {
    if (useAutoImageSize) {
      delete payload.image_size
    }

    const imageUrls = await Promise.all(params.images.map((file) => falClient.storage.upload(file)))
    payload.image_url = imageUrls[0]
    payload.image_urls = imageUrls

    if (modelId.includes("clarity-upscaler")) {
      delete payload.image_size
      delete payload.num_images
    }

    if (payload.prompt == null || payload.prompt === "") {
      payload.prompt = "masterpiece, best quality, highres"
    }

    if (payload.negative_prompt == null) {
      payload.negative_prompt = "(worst quality, low quality, normal quality:2)"
    }

    payload.upscale_factor = payload.upscale_factor ?? 2
    payload.creativity = payload.creativity ?? 0.35
    payload.resemblance = payload.resemblance ?? 0.6
    payload.guidance_scale = payload.guidance_scale ?? 4
    payload.num_inference_steps = payload.num_inference_steps ?? 18
    payload.enable_safety_checker = payload.enable_safety_checker ?? true
  }

  if (params.openaiApiKey) {
    payload.openai_api_key = params.openaiApiKey
  }

  const isNanoBananaPro = modelId === "fal-ai/nano-banana-pro" || modelId === "fal-ai/nano-banana-pro/edit"
  if (isNanoBananaPro) {
    if (params.falNanoBananaAspectRatio) {
      payload.aspect_ratio = params.falNanoBananaAspectRatio
      delete payload.image_size
    }
    if (params.falNanoBananaResolution) {
      payload.resolution = params.falNanoBananaResolution
    }
    if (params.falNanoBananaOutputFormat) {
      payload.output_format = params.falNanoBananaOutputFormat
    }
    if (isImg2ImgMode && payload.image_urls) {
      delete payload.image_url
      delete payload.enable_safety_checker
      delete payload.seed
    }
  }

  const isGemini3ProPreview = modelId === "fal-ai/gemini-3-pro-image-preview" || modelId === "fal-ai/gemini-3-pro-image-preview/edit"
  if (isGemini3ProPreview) {
    if (params.falGemini3ProAspectRatio) {
      payload.aspect_ratio = params.falGemini3ProAspectRatio
      delete payload.image_size
    }
    if (params.falGemini3ProResolution) {
      payload.resolution = params.falGemini3ProResolution
    }
    if (params.falGemini3ProOutputFormat) {
      payload.output_format = params.falGemini3ProOutputFormat
    }
    if (isImg2ImgMode && payload.image_urls) {
      delete payload.image_url
    }
  }

  await logDebug({
    message: "FAL request dispatch",
    details: {
      provider: provider.id,
      mode: isImg2ImgMode ? "img2img" : "txt2img",
      promptPreview: params.prompt.substring(0, 120),
      promptLength: params.prompt.length,
      numImages: params.numImages,
      syncMode: params.syncMode ?? true,
      hasImageInput: isImg2ImgMode,
      modelId,
      ...(isNanoBananaPro && {
        nanoBananaPro: {
          aspectRatio: params.falNanoBananaAspectRatio,
          resolution: params.falNanoBananaResolution,
          outputFormat: params.falNanoBananaOutputFormat,
        },
      }),
    },
  })

  const extractImageUrls = (result: unknown, dedupe = true): string[] => {
    if (!result) return []
    if (typeof result === "string") return [result]
    if (Array.isArray(result)) {
      return result.flatMap((item) => extractImageUrls(item, dedupe))
    }
    if (typeof result !== "object") return []

    const record = result as Record<string, unknown>
    const urls: string[] = []

    for (const key of ["url", "uri", "image", "image_url", "signed_url", "signedUrl", "download_url", "downloadUrl", "file_url"]) {
      const value = record[key]
      if (typeof value === "string" && value) {
        urls.push(value)
      }
    }

    if (typeof record.b64_json === "string" && record.b64_json) {
      urls.push(`data:image/png;base64,${record.b64_json}`)
    }

    for (const key of ["image", "images", "data", "output", "result", "contents", "items", "file", "files"]) {
      if (record[key] != null) {
        urls.push(...extractImageUrls(record[key], dedupe))
      }
    }

    return dedupe ? Array.from(new Set(urls)) : urls
  }

  try {
    const result = await falClient.subscribe(modelId as any, {
      input: payload,
      logs: true,
      mode: "polling",
      pollInterval: 1000,
      timeout: 4 * 60 * 1000,
      onEnqueue: (requestId) => {
        void logDebug({
          message: "FAL request enqueued",
          details: {
            provider: provider.id,
            modelId,
            requestId,
          },
        })
      },
      onQueueUpdate: (update) => {
        void logDebug({
          message: "FAL queue status updated",
          details: {
            provider: provider.id,
            modelId,
            requestId: update.request_id,
            status: update.status,
            position: "queue_position" in update ? update.queue_position : undefined,
          },
        })
      },
    })

    const images = extractImageUrls(result.data, false)
    if (!images.length) {
      throw new Error("FAL API 未返回图像结果。")
    }

    await logDebug({
      message: "FAL request completed with images",
      details: {
        provider: provider.id,
        modelId,
        requestId: result.requestId,
        imageCount: images.length,
      },
    })

    const targetCount = typeof params.numImages === "number" && params.numImages > 0 ? params.numImages : undefined
    return targetCount && images.length >= targetCount ? images.slice(0, targetCount) : images
  } catch (error) {
    await logDebug({
      level: "error",
      message: "FAL request failed",
      details: {
        provider: provider.id,
        modelId,
        error: error instanceof Error ? error.message : String(error),
      },
    })
    throw error instanceof Error ? error : new Error("FAL 请求失败")
  }
}

async function callOpenAIAPI(provider: ProviderConfig, params: GenerationParams): Promise<string[]> {
  const apiMode = params.openaiApiMode || provider.openaiApiMode || "image"
  const effectiveMode: OpenAIAPIMode = apiMode === "responses" ? "responses" : "image"

  if (effectiveMode === "responses") {
    return await callOpenAIResponsesAPI(provider, params)
  }

  return await callOpenAIImageAPI(provider, params)
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
    const allowedModels = ["gpt-image-1", "dall-e-3", "dall-e-2"]
    const normalizeModel = (modelId?: string) => {
      if (!modelId) return "gpt-image-1"
      const lower = modelId.toLowerCase()
      if (allowedModels.includes(lower)) return lower
      if (lower.startsWith("gemini")) return lower // 直接透传 gemini-* 模型
      // 尝试粗略匹配
      if (lower.includes("gpt-image-1")) return "gpt-image-1"
      if (lower.includes("dall-e-3")) return "dall-e-3"
      if (lower.includes("dall-e-2")) return "dall-e-2"
      return "gpt-image-1"
    }
    const newapiModel = normalizeModel(params.modelId)
    const responseFormat = newapiModel === "gpt-image-1" || newapiModel.startsWith("gemini") ? "b64_json" : "url"
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
        model: newapiModel,
        promptPreview: params.prompt.substring(0, 120),
        promptLength: params.prompt.length,
        numImages: params.numImages,
        imageSize: normalizedImageSize,
        useServerProxy,
        responseFormat,
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
        formData.append("response_format", responseFormat)

        if (params.quality) {
          formData.append("quality", params.quality)
        }

        if (params.style && newapiModel === "dall-e-3") {
          formData.append("style", params.style)
        }

        // Gemini 特定参数
        if (newapiModel.startsWith("gemini")) {
          if (params.thinkingLevel) {
            formData.append("thinking_level", params.thinkingLevel)
          }
          if (params.mediaResolution) {
            formData.append("media_resolution", params.mediaResolution)
          }
          if (params.aspectRatio) {
            formData.append("aspect_ratio", params.aspectRatio)
          }
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
        response_format: responseFormat,
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

  async function callGeminiAPI(): Promise<string[]> {
    const geminiModel = params.modelId || "gemini-2.5-flash-image"
    const useServerProxy = (provider.requestOrigin ?? "server") === "server"

    await logDebug({
      message: "Gemini image generation dispatch",
      details: {
        provider: provider.id,
        model: geminiModel,
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
        formData.append("apiKey", provider.apiKey)
        formData.append("model", geminiModel)
        formData.append("prompt", params.prompt)
        formData.append("size", normalizedImageSize)

        // Gemini 特定参数
        if (params.thinkingLevel) {
          formData.append("thinking_level", params.thinkingLevel)
        }
        if (params.mediaResolution) {
          formData.append("media_resolution", params.mediaResolution)
        }
        if (params.aspectRatio) {
          formData.append("aspect_ratio", params.aspectRatio)
        }

        return fetch("/api/gemini/generate", {
          method: "POST",
          body: formData,
        })
      }

      // 客户端直接调用（不推荐，会暴露 API Key）
      throw new Error("Gemini API 需要通过服务器代理调用")
    }

    const response = await performGeneration()
    const data = await parseJson(response)

    if (!response.ok) {
      const message = data?.error?.message || data?.message || "Gemini image generation failed"
      await logDebug({
        level: "error",
        message: "Gemini image generation failed",
        details: {
          provider: provider.id,
          status: response.status,
          error: message,
        },
      })
      throw new Error(`Gemini API error: ${message}`)
    }

    const images =
      data?.data?.map((item: { b64_json?: string }) => {
        if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`
        return null
      }) || []

    if (!images.length) {
      await logDebug({
        level: "warn",
        message: "Gemini returned no images",
        details: {
          provider: provider.id,
        },
      })
      throw new Error("Gemini did not return any images")
    }

    const filtered = images.filter(Boolean) as string[]

    await logDebug({
      message: "Gemini image generation completed",
      details: {
        provider: provider.id,
        imageCount: filtered.length,
      },
    })

    return filtered
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
    case "gemini":
      return await callGeminiAPI()
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
