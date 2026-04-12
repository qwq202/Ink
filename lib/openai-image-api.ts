import type { ProviderConfig } from "./providers"
import { parseImageSize } from "./image-utils"
import { logDebug } from "./logger"
import type { GenerationParams } from "./api-client"
import { extractOpenAIImageResults, normalizeOpenAIEndpoint, resolveOpenAIImageSize } from "./openai-shared"

interface OpenAIRequestError {
  error?: { message?: string }
  message?: string
}

function toDataUrl(base64: string): string {
  const cleanBase64 = base64.trim()
  return `data:image/png;base64,${cleanBase64}`
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(text || "OpenAI image API 响应解析失败")
  }
}

function buildEditPayload(
  params: GenerationParams,
  hasInputImages: boolean,
): {
  model?: string
  size: string
  response_format: "url" | "b64_json"
  n: number
  prompt: string
  quality?: "standard" | "hd"
  style?: "vivid" | "natural"
} {
  const { width, height } = parseImageSize(resolveOpenAIImageSize(params.imageSize))
  const model = params.modelId?.trim()
  const size = `${width}x${height}`
  const requestedNumImages = hasInputImages ? 1 : params.numImages && params.numImages > 0 ? params.numImages : 1
  const fallbackPrompt = "优化这张图片并保持原始主体。"

  return {
    model: model || undefined,
    size,
    response_format: "b64_json",
    n: requestedNumImages,
    prompt: params.prompt?.trim() || fallbackPrompt,
    quality: params.openaiImageQuality,
    style: model === "dall-e-3" ? params.openaiImageStyle : undefined,
  }
}

function parseOpenAIError(payload: unknown): string {
  const error = payload as OpenAIRequestError
  if (typeof error?.error?.message === "string" && error.error.message) {
    return error.error.message
  }
  if (typeof error?.message === "string" && error.message) {
    return error.message
  }
  return "OpenAI 图像请求失败"
}

export async function callOpenAIImageAPI(provider: ProviderConfig, params: GenerationParams): Promise<string[]> {
  const hasInputImages = Boolean(params.images?.length)
  const requestPath = hasInputImages ? "images/edits" : "images/generations"
  const endpoint = normalizeOpenAIEndpoint(provider.endpoint, requestPath)
  const payload = buildEditPayload(params, hasInputImages)

  await logDebug({
    message: "OpenAI Image API 请求分发",
    details: {
      provider: provider.id,
      endpoint,
      mode: hasInputImages ? "edits" : "generations",
      model: payload.model,
      size: payload.size,
      numImages: payload.n,
      promptPreview: params.prompt.substring(0, 120),
      promptLength: params.prompt.length,
      hasInputImages,
    },
  })

  const response = hasInputImages
    ? await buildEditRequest({ providerEndpoint: endpoint, providerApiKey: provider.apiKey, payload, params })
    : await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          ...(payload.model ? { model: payload.model } : {}),
          prompt: payload.prompt,
          n: payload.n,
          size: payload.size,
          response_format: payload.response_format,
          ...(payload.quality ? { quality: payload.quality } : {}),
          ...(payload.style ? { style: payload.style } : {}),
        }),
      })

  const data = await parseResponse(response)
  if (!response.ok) {
    const message = parseOpenAIError(data)
    await logDebug({
      level: "error",
      message: "OpenAI Image API 请求失败",
      details: {
        provider: provider.id,
        status: response.status,
        endpoint,
        error: message,
      },
    })
    throw new Error(`OpenAI Image API error: ${message}`)
  }

  const images = extractOpenAIImageResults(data)
  if (!images.length) {
    await logDebug({
      level: "warn",
      message: "OpenAI Image API 未返回图像结果",
      details: {
        provider: provider.id,
        endpoint,
      },
    })
    throw new Error("OpenAI Image API 未返回图像结果")
  }

  const imageList = images.map((item) => {
    if (item.startsWith("data:")) return item
    if (item.startsWith("http")) return item
    return toDataUrl(item)
  })
  const expectedCount = params.numImages > 0 ? params.numImages : imageList.length
  const normalizedImages = imageList.slice(0, expectedCount)

  await logDebug({
    message: "OpenAI Image API 请求完成",
    details: {
      provider: provider.id,
      endpoint,
      imageCount: normalizedImages.length,
    },
  })

  return normalizedImages
}

async function buildEditRequest({
  providerEndpoint,
  providerApiKey,
  payload,
  params,
}: {
  providerEndpoint: string
  providerApiKey: string
  payload: ReturnType<typeof buildEditPayload>
  params: GenerationParams
}): Promise<Response> {
  const targetImage = params.images?.[0]
  const formData = new FormData()
  if (payload.model) {
    formData.append("model", payload.model)
  }
  formData.append("prompt", payload.prompt)
  formData.append("n", payload.n.toString())
  if (payload.size) {
    formData.append("size", payload.size)
  }
  formData.append("response_format", payload.response_format)
  if (payload.quality) {
    formData.append("quality", payload.quality)
  }
  if (payload.style) {
    formData.append("style", payload.style)
  }

  if (targetImage) {
    formData.append("image", targetImage)
  }

  return fetch(providerEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${providerApiKey}`,
    },
    body: formData,
  })
}
