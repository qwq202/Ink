export type FalMode = "txt2img" | "img2img"

export type FalSpecialConfig = "nano-banana-pro" | "gemini-3-pro-image-preview" | null

export interface FalModelCapability {
  supportsImageSize: boolean
  supportsSeed: boolean
  supportsSafetyChecker: boolean
  supportsSyncMode: boolean
  specialConfig: FalSpecialConfig
}

export const DEFAULT_FAL_MODEL_ID = "fal-ai/flux/dev"

const TXT2IMG_TO_IMG2IMG: Record<string, string> = {
  "fal-ai/nano-banana-pro": "fal-ai/nano-banana-pro/edit",
  "fal-ai/gemini-3-pro-image-preview": "fal-ai/gemini-3-pro-image-preview/edit",
}

const IMG2IMG_TO_TXT2IMG = Object.fromEntries(
  Object.entries(TXT2IMG_TO_IMG2IMG).map(([textModelId, imageModelId]) => [imageModelId, textModelId]),
) as Record<string, string>

const SPECIAL_MODEL_CAPABILITY: Record<string, FalSpecialConfig> = {
  "fal-ai/nano-banana-pro": "nano-banana-pro",
  "fal-ai/nano-banana-pro/edit": "nano-banana-pro",
  "fal-ai/gemini-3-pro-image-preview": "gemini-3-pro-image-preview",
  "fal-ai/gemini-3-pro-image-preview/edit": "gemini-3-pro-image-preview",
}

function normalizeModelId(modelId?: string | null): string {
  if (!modelId) return DEFAULT_FAL_MODEL_ID
  const normalized = modelId.trim().replace(/^\/+/, "")
  return normalized || DEFAULT_FAL_MODEL_ID
}

export function getFalBaseModelId(modelId?: string | null): string {
  const normalized = normalizeModelId(modelId)
  return IMG2IMG_TO_TXT2IMG[normalized] ?? normalized
}

export function resolveFalModelIdForMode(modelId: string | undefined, mode: FalMode): string {
  const normalized = normalizeModelId(modelId)
  if (mode === "img2img") {
    return TXT2IMG_TO_IMG2IMG[normalized] ?? normalized
  }
  return IMG2IMG_TO_TXT2IMG[normalized] ?? normalized
}

export function getFalModelCapability(modelId: string | undefined, mode: FalMode): FalModelCapability {
  const resolvedModelId = resolveFalModelIdForMode(modelId, mode)
  const specialConfig = SPECIAL_MODEL_CAPABILITY[resolvedModelId] ?? null

  if (specialConfig === "nano-banana-pro") {
    return {
      supportsImageSize: false,
      supportsSeed: mode === "txt2img",
      supportsSafetyChecker: mode === "txt2img",
      supportsSyncMode: true,
      specialConfig,
    }
  }

  if (specialConfig === "gemini-3-pro-image-preview") {
    return {
      supportsImageSize: false,
      supportsSeed: true,
      supportsSafetyChecker: true,
      supportsSyncMode: true,
      specialConfig,
    }
  }

  return {
    supportsImageSize: true,
    supportsSeed: true,
    supportsSafetyChecker: true,
    supportsSyncMode: true,
    specialConfig: null,
  }
}
