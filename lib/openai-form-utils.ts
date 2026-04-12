import type { GenerationParams } from "@/lib/api-client"
import type {
  GenerationOperationType,
  OpenAIApiMode,
  OpenAIResponseChainMetadata,
} from "@/hooks/use-generation-history"

export type OpenAIModelMode = "image" | "responses"
export type OpenAIResponsesMode = "text" | "image"

export interface OpenAIModelOption {
  value: string
  label: string
}

export interface OpenAIImageSizeOption {
  value: string
  label: string
}

export const OPENAI_IMAGE_ENDPOINT_DEFAULT = "https://api.openai.com/v1/images/generations"
export const OPENAI_RESPONSES_ENDPOINT_DEFAULT = "https://api.openai.com/v1/responses"
export const OPENAI_ENDPOINT_PROFILE_KEY = "ai-image-openai-endpoint-profile"

const OPENAI_IMAGE_MODELS: OpenAIModelOption[] = [
  { value: "gpt-image-1.5", label: "GPT Image 1.5" },
  { value: "gpt-image-1", label: "GPT Image 1" },
  { value: "gpt-image-1-mini", label: "GPT Image 1 Mini" },
  { value: "dall-e-3", label: "DALL·E 3" },
  { value: "dall-e-2", label: "DALL·E 2" },
]

const OPENAI_RESPONSES_MODELS: OpenAIModelOption[] = [
  { value: "gpt-4.1", label: "GPT-4.1（可做图像与文本）" },
  { value: "gpt-4.1-mini", label: "GPT-4.1-mini" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o-mini" },
  { value: "gpt-image-1", label: "GPT Image 1（兼容模式）" },
]

export const OPENAI_RESPONSES_MODES: Array<{ value: OpenAIResponsesMode; label: string }> = [
  { value: "image", label: "图片导向（输出图像）" },
  { value: "text", label: "文本导向（先理解再生成）" },
]

export function getOpenAIModelOptions(mode: OpenAIModelMode): OpenAIModelOption[] {
  return mode === "responses" ? OPENAI_RESPONSES_MODELS : OPENAI_IMAGE_MODELS
}

export function getOpenAIResponsesModes(): Array<{ value: OpenAIResponsesMode; label: string }> {
  return OPENAI_RESPONSES_MODES
}

export function getOpenAIImageSizeOptions({
  openAIMode,
  openAIModel,
  generationMode,
  customAppliedValue,
}: {
  openAIMode: OpenAIModelMode
  openAIModel: string
  generationMode: "img2img" | "txt2img"
  customAppliedValue?: string | null
}): OpenAIImageSizeOption[] {
  const includeCustom = (base: OpenAIImageSizeOption[]) => {
    if (!customAppliedValue) return base
    if (base.some((option) => option.value === customAppliedValue)) return base

    const next = [...base]
    const label = `自定义 · ${customAppliedValue.replace("x", " x ")}`
    next.splice(next.length - 1, 0, { value: customAppliedValue, label })
    return next
  }

  if (openAIMode === "image") {
    if (openAIModel === "dall-e-2") {
      const options = includeCustom([
        { value: "256x256", label: "小图 · 256 x 256" },
        { value: "512x512", label: "中图 · 512 x 512" },
        { value: "1024x1024", label: "大图 · 1024 x 1024" },
        { value: "custom", label: "自定义尺寸" },
      ])
      return generationMode === "img2img" ? [{ value: "auto", label: "与原图相同（推荐）" }, ...options] : options
    }

    if (openAIModel === "dall-e-3") {
      return [
        { value: "1024x1024", label: "方形 · 1024 x 1024" },
        { value: "1792x1024", label: "横向 · 1792 x 1024" },
        { value: "1024x1792", label: "纵向 · 1024 x 1792" },
      ]
    }
  }

  const baseOptions = includeCustom([
    { value: "1024x1024", label: "方形 · 1024 x 1024" },
    { value: "1536x1024", label: "横向 · 1536 x 1024" },
    { value: "1024x1536", label: "纵向 · 1024 x 1536" },
    { value: "custom", label: "自定义尺寸" },
  ])

  return generationMode === "img2img" ? [{ value: "auto", label: "与原图相同（推荐）" }, ...baseOptions] : baseOptions
}

export function getOpenAINumImages({
  openAIMode,
  openAIModel,
  numImages,
}: {
  openAIMode: OpenAIModelMode
  openAIModel: string
  numImages: number
}): number {
  if (openAIMode === "responses" || openAIModel === "dall-e-3") {
    return 1
  }
  return numImages
}

export function buildOpenAIHistoryParams({
  openAIMode,
  openAIImageQuality,
  openAIImageStyle,
  openAIResponsesMode,
  openAIResponsesMaxOutputTokens,
  openAIResponsesTemperature,
  openAIResponsesPreviousResponseId,
}: {
  openAIMode: OpenAIModelMode
  openAIImageQuality: "standard" | "hd"
  openAIImageStyle: "vivid" | "natural"
  openAIResponsesMode: OpenAIResponsesMode
  openAIResponsesMaxOutputTokens: number
  openAIResponsesTemperature: number
  openAIResponsesPreviousResponseId: string | undefined
}): Partial<GenerationParams> {
  if (openAIMode === "responses") {
    return {
      openaiApiMode: "responses",
      openaiPreviousResponseId: openAIResponsesPreviousResponseId,
      openaiResponsesMode,
      openaiResponsesMaxOutputTokens,
      openaiResponsesTemperature,
    }
  }

  return {
    openaiApiMode: "image",
    openaiImageQuality: openAIImageQuality,
    openaiImageStyle: openAIImageStyle,
  }
}

export function buildOpenAIHistoryMetadata({
  openAIEndpointByMode,
  openAIMode,
  openAIModel,
  openAIImageQuality,
  openAIImageStyle,
  openAIResponsesMode,
  openAIResponsesPreviousResponseId,
  openAIResponsesTemperature,
  openAIResponsesMaxOutputTokens,
  operationType,
}: {
  openAIEndpointByMode: (mode: OpenAIModelMode) => string
  openAIMode: OpenAIModelMode
  openAIModel: string
  openAIImageQuality: "standard" | "hd"
  openAIImageStyle: "vivid" | "natural"
  openAIResponsesMode: OpenAIResponsesMode
  openAIResponsesPreviousResponseId: string | undefined
  openAIResponsesTemperature: number
  openAIResponsesMaxOutputTokens: number
  operationType: GenerationOperationType
}): OpenAIResponseChainMetadata {
  const endpoint = openAIEndpointByMode(openAIMode)
  const openaiMode: OpenAIApiMode = openAIMode === "responses" ? "responses-api" : "image-api"

  const metadata: OpenAIResponseChainMetadata = {
    endpoint,
    modelId: openAIModel,
    openaiMode,
    operationType,
    extras: {
      openaiMode,
    },
  }

  if (openAIMode === "responses") {
    metadata.requestId = openAIResponsesPreviousResponseId
    metadata.temperature = openAIResponsesTemperature
    metadata.maxOutputTokens = openAIResponsesMaxOutputTokens
    metadata.extras = {
      ...metadata.extras,
      responsesMode: openAIResponsesMode,
    }
  } else {
    metadata.extras = {
      ...metadata.extras,
      imageQuality: openAIImageQuality,
      imageStyle: openAIImageStyle,
    }
  }

  return metadata
}
