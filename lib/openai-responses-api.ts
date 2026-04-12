import type { ProviderConfig } from "./providers"
import { logDebug } from "./logger"
import type { GenerationParams } from "./api-client"
import { extractOpenAIImageResults, normalizeOpenAIEndpoint, resolveOpenAIImageSize } from "./openai-shared"

interface OpenAIRequestError {
  error?: { message?: string }
  message?: string
}

interface ResponsesRequestPayload {
  model: string
  input: string
  tools: Array<{ type: string; quality?: string; size?: string }>
  tool_choice: "required"
  previous_response_id?: string
  max_output_tokens?: number
  temperature?: number
}

function buildResponsesPayload(params: GenerationParams): ResponsesRequestPayload {
  const requestModel = params.modelId?.trim() || "gpt-image-1"
  const imageSize = resolveOpenAIImageSize(params.imageSize)
  return {
    model: requestModel,
    input: params.prompt || "继续生成图片",
    tools: [
      {
        type: "image_generation",
        quality: "medium",
        size: imageSize,
      },
    ],
    tool_choice: "required",
    ...(params.openaiPreviousResponseId ? { previous_response_id: params.openaiPreviousResponseId } : {}),
    ...(typeof params.openaiResponsesMaxOutputTokens === "number" ? { max_output_tokens: params.openaiResponsesMaxOutputTokens } : {}),
    ...(typeof params.openaiResponsesTemperature === "number" ? { temperature: params.openaiResponsesTemperature } : {}),
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
  return "OpenAI Responses API 请求失败"
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(text || "OpenAI Responses API 响应解析失败")
  }
}

export async function callOpenAIResponsesAPI(provider: ProviderConfig, params: GenerationParams): Promise<string[]> {
  const endpoint = normalizeOpenAIEndpoint(provider.endpoint, "responses")
  const payload = buildResponsesPayload(params)

  await logDebug({
    message: "OpenAI Responses API 请求分发",
    details: {
      provider: provider.id,
      endpoint,
      model: payload.model,
      inputPreview: payload.input.substring(0, 120),
      inputLength: payload.input.length,
      toolCount: payload.tools.length,
      hasPreviousResponse: !!payload.previous_response_id,
      imageSize: resolveOpenAIImageSize(params.imageSize),
      numImages: params.numImages,
    },
  })

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  const data = await parseResponse(response)
  if (!response.ok) {
    const message = parseOpenAIError(data)
    await logDebug({
      level: "error",
      message: "OpenAI Responses API 请求失败",
      details: {
        provider: provider.id,
        status: response.status,
        endpoint,
        error: message,
        hasPreviousResponse: !!payload.previous_response_id,
      },
    })
    throw new Error(`OpenAI Responses API error: ${message}`)
  }

  if (typeof data === "object" && data !== null && typeof (data as { id?: unknown }).id === "string") {
    const responseId = (data as { id: string }).id
    params.openaiResponseId = responseId
  }

  const images = extractOpenAIImageResults(data)
  const expectedCount = params.numImages && params.numImages > 0 ? params.numImages : images.length
  const normalizedImages = images.slice(0, expectedCount)
  if (!normalizedImages.length) {
    await logDebug({
      level: "warn",
      message: "OpenAI Responses API 未返回图像结果",
      details: {
        provider: provider.id,
        endpoint,
        responseId: params.openaiResponseId,
      },
    })
    throw new Error("OpenAI Responses API 未返回图像结果")
  }

  await logDebug({
    message: "OpenAI Responses API 请求完成",
    details: {
      provider: provider.id,
      endpoint,
      imageCount: normalizedImages.length,
      responseId: params.openaiResponseId,
    },
  })

  return normalizedImages
}
