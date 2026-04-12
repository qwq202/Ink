export type NewApiOpenAICompatModel = "gpt-image-1" | "dall-e-3" | "dall-e-2"
export type NewApiBackground = "auto" | "transparent" | "opaque"
export type NewApiModeration = "auto" | "low"

export interface NewApiImageSizeOption {
  value: string
  label: string
}

const OPENAI_COMPAT_MODELS: NewApiOpenAICompatModel[] = ["gpt-image-1", "dall-e-3", "dall-e-2"]

export function isNewApiGeminiModel(modelId?: string): boolean {
  return (modelId || "").trim().toLowerCase().startsWith("gemini")
}

export function normalizeNewApiModel(modelId?: string): string {
  if (!modelId) return "gpt-image-1"

  const lower = modelId.toLowerCase().trim()
  if (OPENAI_COMPAT_MODELS.includes(lower as NewApiOpenAICompatModel)) {
    return lower
  }
  if (isNewApiGeminiModel(lower)) {
    return lower
  }
  if (lower.includes("gpt-image-1")) return "gpt-image-1"
  if (lower.includes("dall-e-3")) return "dall-e-3"
  if (lower.includes("dall-e-2")) return "dall-e-2"
  return "gpt-image-1"
}

export function isNewApiOpenAICompatModel(modelId?: string): modelId is NewApiOpenAICompatModel {
  const normalized = normalizeNewApiModel(modelId)
  return OPENAI_COMPAT_MODELS.includes(normalized as NewApiOpenAICompatModel)
}

export function supportsNewApiStyle(modelId?: string): boolean {
  return normalizeNewApiModel(modelId) === "dall-e-3"
}

export function supportsNewApiBackground(modelId?: string): boolean {
  return normalizeNewApiModel(modelId) === "gpt-image-1"
}

export function supportsNewApiModeration(modelId?: string): boolean {
  return normalizeNewApiModel(modelId) === "gpt-image-1"
}

export function supportsNewApiEdits(modelId?: string): boolean {
  const normalized = normalizeNewApiModel(modelId)
  return normalized === "gpt-image-1" || normalized === "dall-e-2"
}

export function getNewApiSafeQuality(modelId: string, quality: string): string {
  const normalized = normalizeNewApiModel(modelId)
  if (normalized === "dall-e-3") {
    return ["standard", "hd"].includes(quality) ? quality : "standard"
  }
  if (normalized === "gpt-image-1") {
    return ["auto", "low", "medium", "high"].includes(quality) ? quality : "auto"
  }
  if (normalized === "dall-e-2") {
    return "standard"
  }
  return quality
}

export function getNewApiSafeNumImages(modelId: string, numImages: number): number {
  return normalizeNewApiModel(modelId) === "dall-e-3" ? Math.min(numImages, 1) : numImages
}

export function getNewApiImageSizeOptions({
  modelId,
  generationMode,
  customAppliedValue,
}: {
  modelId: string
  generationMode: "img2img" | "txt2img"
  customAppliedValue?: string | null
}): NewApiImageSizeOption[] | null {
  const normalized = normalizeNewApiModel(modelId)
  if (!isNewApiOpenAICompatModel(normalized)) {
    return null
  }

  const includeCustom = (base: NewApiImageSizeOption[]) => {
    if (!customAppliedValue) return base
    if (base.some((option) => option.value === customAppliedValue)) return base

    const next = [...base]
    next.splice(next.length - 1, 0, {
      value: customAppliedValue,
      label: `自定义 · ${customAppliedValue.replace("x", " x ")}`,
    })
    return next
  }

  if (generationMode === "img2img") {
    if (!supportsNewApiEdits(normalized)) {
      return [
        { value: "1024x1024", label: "方形 · 1024 x 1024" },
      ]
    }

    const editOptions = includeCustom([
      { value: "256x256", label: "小图 · 256 x 256" },
      { value: "512x512", label: "中图 · 512 x 512" },
      { value: "1024x1024", label: "大图 · 1024 x 1024" },
      { value: "custom", label: "自定义尺寸" },
    ])
    return [{ value: "auto", label: "与原图相同（推荐）" }, ...editOptions]
  }

  if (normalized === "dall-e-2") {
    return includeCustom([
      { value: "256x256", label: "小图 · 256 x 256" },
      { value: "512x512", label: "中图 · 512 x 512" },
      { value: "1024x1024", label: "大图 · 1024 x 1024" },
      { value: "custom", label: "自定义尺寸" },
    ])
  }

  if (normalized === "dall-e-3") {
    return [
      { value: "1024x1024", label: "方形 · 1024 x 1024" },
      { value: "1792x1024", label: "横向 · 1792 x 1024" },
      { value: "1024x1792", label: "纵向 · 1024 x 1792" },
    ]
  }

  return includeCustom([
    { value: "1024x1024", label: "方形 · 1024 x 1024" },
    { value: "1536x1024", label: "横向 · 1536 x 1024" },
    { value: "1024x1536", label: "纵向 · 1024 x 1536" },
    { value: "custom", label: "自定义尺寸" },
  ])
}
