import type { GenerationParams } from "@/lib/api-client"
import {
  isNewApiGeminiModel,
  supportsNewApiBackground,
  supportsNewApiModeration,
} from "@/lib/newapi-openai-compat"

interface ResolveProviderModelIdInput {
  providerId: string
  falModelId: string
  newapiModelId: string
  openrouterModelId: string
  geminiModelId: string
  openaiModelId: string
}

interface BuildProviderGenerationParamsInput {
  providerId: string
  imageSize: string
  numImages: number
  seed?: number
  safetyChecker?: boolean
  syncMode?: boolean
  selectedNewapiModel: string
  safeNewapiQuality: string
  newapiStyle: string
  newapiBackground: NonNullable<GenerationParams["background"]>
  newapiModeration: NonNullable<GenerationParams["moderation"]>
  selectedGeminiModel: string
  geminiThinkingLevel?: GenerationParams["thinkingLevel"]
  geminiMediaResolution?: GenerationParams["mediaResolution"]
  geminiAspectRatio?: GenerationParams["aspectRatio"]
  openAIParamsForHistory: Partial<GenerationParams>
  supportsFalSeed: boolean
  supportsFalSafetyChecker: boolean
  supportsFalSyncMode: boolean
  isNanoBananaProSelected: boolean
  falNanoBananaAspectRatio?: GenerationParams["falNanoBananaAspectRatio"]
  falNanoBananaResolution?: GenerationParams["falNanoBananaResolution"]
  falNanoBananaOutputFormat?: GenerationParams["falNanoBananaOutputFormat"]
  isGemini3ProPreviewSelected: boolean
  falGemini3ProAspectRatio?: GenerationParams["falGemini3ProAspectRatio"]
  falGemini3ProResolution?: GenerationParams["falGemini3ProResolution"]
  falGemini3ProOutputFormat?: GenerationParams["falGemini3ProOutputFormat"]
}

export function resolveProviderModelId(input: ResolveProviderModelIdInput): string | undefined {
  const {
    providerId,
    falModelId,
    newapiModelId,
    openrouterModelId,
    geminiModelId,
    openaiModelId,
  } = input

  if (providerId === "fal") return falModelId
  if (providerId === "newapi") return newapiModelId
  if (providerId === "openrouter") return openrouterModelId
  if (providerId === "gemini") return geminiModelId
  if (providerId === "openai") return openaiModelId
  return undefined
}

export function buildProviderGenerationParams(
  input: BuildProviderGenerationParamsInput,
): Partial<GenerationParams> {
  const {
    providerId,
    imageSize,
    numImages,
    seed,
    safetyChecker,
    syncMode,
    selectedNewapiModel,
    safeNewapiQuality,
    newapiStyle,
    newapiBackground,
    newapiModeration,
    selectedGeminiModel,
    geminiThinkingLevel,
    geminiMediaResolution,
    geminiAspectRatio,
    openAIParamsForHistory,
    supportsFalSeed,
    supportsFalSafetyChecker,
    supportsFalSyncMode,
    isNanoBananaProSelected,
    falNanoBananaAspectRatio,
    falNanoBananaResolution,
    falNanoBananaOutputFormat,
    isGemini3ProPreviewSelected,
    falGemini3ProAspectRatio,
    falGemini3ProResolution,
    falGemini3ProOutputFormat,
  } = input

  const usesNewApiGemini = providerId === "newapi" && isNewApiGeminiModel(selectedNewapiModel)
  const usesGeminiProvider = providerId === "gemini"
  const supportsGeminiThinking = usesNewApiGemini || (usesGeminiProvider && selectedGeminiModel.includes("pro"))
  const supportsGeminiMediaParams = usesNewApiGemini || usesGeminiProvider

  return {
    imageSize,
    numImages,
    seed: providerId === "fal" && !supportsFalSeed ? undefined : seed,
    safetyChecker: providerId === "fal" && !supportsFalSafetyChecker ? undefined : safetyChecker,
    syncMode: providerId === "fal" && !supportsFalSyncMode ? undefined : syncMode,
    quality: providerId === "newapi" ? safeNewapiQuality : undefined,
    style: providerId === "newapi" ? newapiStyle : undefined,
    background: providerId === "newapi" && supportsNewApiBackground(selectedNewapiModel) ? newapiBackground : undefined,
    moderation: providerId === "newapi" && supportsNewApiModeration(selectedNewapiModel) ? newapiModeration : undefined,
    thinkingLevel: supportsGeminiThinking ? geminiThinkingLevel : undefined,
    mediaResolution: supportsGeminiMediaParams ? geminiMediaResolution : undefined,
    aspectRatio: supportsGeminiMediaParams ? geminiAspectRatio : undefined,
    falNanoBananaAspectRatio: isNanoBananaProSelected ? falNanoBananaAspectRatio : undefined,
    falNanoBananaResolution: isNanoBananaProSelected ? falNanoBananaResolution : undefined,
    falNanoBananaOutputFormat: isNanoBananaProSelected ? falNanoBananaOutputFormat : undefined,
    falGemini3ProAspectRatio: isGemini3ProPreviewSelected ? falGemini3ProAspectRatio : undefined,
    falGemini3ProResolution: isGemini3ProPreviewSelected ? falGemini3ProResolution : undefined,
    falGemini3ProOutputFormat: isGemini3ProPreviewSelected ? falGemini3ProOutputFormat : undefined,
    ...(providerId === "openai" ? openAIParamsForHistory : {}),
  }
}
