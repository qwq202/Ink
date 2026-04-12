import type { OpenAIAPIMode } from "@/domains/settings/lib/providers"

export type OpenAIModelMode = OpenAIAPIMode

export interface OpenAIEndpointProfile {
  mode: OpenAIModelMode
  imageEndpoint: string
  responsesEndpoint: string
}

export const OPENAI_IMAGE_ENDPOINT_DEFAULT = "https://api.openai.com/v1/images/generations"
export const OPENAI_RESPONSES_ENDPOINT_DEFAULT = "https://api.openai.com/v1/responses"
export const OPENAI_ENDPOINT_PROFILE_KEY = "ai-image-openai-endpoint-profile"

export function normalizeOpenAIEndpointValue(value: string, fallback: string): string {
  const trimmed = value.trim()
  return trimmed.length ? trimmed : fallback
}

export function inferOpenAIMode(endpoint: string): OpenAIModelMode {
  if (!endpoint) return "image"
  return endpoint.includes("/responses") ? "responses" : "image"
}

export function loadOpenAIEndpointProfile(): OpenAIEndpointProfile {
  if (typeof window === "undefined") {
    return {
      mode: "image",
      imageEndpoint: OPENAI_IMAGE_ENDPOINT_DEFAULT,
      responsesEndpoint: OPENAI_RESPONSES_ENDPOINT_DEFAULT,
    }
  }

  try {
    const raw = localStorage.getItem(OPENAI_ENDPOINT_PROFILE_KEY)
    if (!raw) {
      throw new Error("no-profile")
    }

    const parsed = JSON.parse(raw) as Partial<OpenAIEndpointProfile>
    return {
      mode: parsed.mode === "responses" ? "responses" : "image",
      imageEndpoint: normalizeOpenAIEndpointValue(parsed.imageEndpoint || "", OPENAI_IMAGE_ENDPOINT_DEFAULT),
      responsesEndpoint: normalizeOpenAIEndpointValue(parsed.responsesEndpoint || "", OPENAI_RESPONSES_ENDPOINT_DEFAULT),
    }
  } catch {
    return {
      mode: "image",
      imageEndpoint: OPENAI_IMAGE_ENDPOINT_DEFAULT,
      responsesEndpoint: OPENAI_RESPONSES_ENDPOINT_DEFAULT,
    }
  }
}

export function saveOpenAIEndpointProfile(profile: OpenAIEndpointProfile): void {
  if (typeof window === "undefined") return

  localStorage.setItem(
    OPENAI_ENDPOINT_PROFILE_KEY,
    JSON.stringify({
      ...profile,
      imageEndpoint: normalizeOpenAIEndpointValue(profile.imageEndpoint, OPENAI_IMAGE_ENDPOINT_DEFAULT),
      responsesEndpoint: normalizeOpenAIEndpointValue(profile.responsesEndpoint, OPENAI_RESPONSES_ENDPOINT_DEFAULT),
    }),
  )
}

export function resolveOpenAIEndpointByMode(
  profile: OpenAIEndpointProfile,
  mode: OpenAIModelMode,
): string {
  return mode === "responses"
    ? normalizeOpenAIEndpointValue(profile.responsesEndpoint, OPENAI_RESPONSES_ENDPOINT_DEFAULT)
    : normalizeOpenAIEndpointValue(profile.imageEndpoint, OPENAI_IMAGE_ENDPOINT_DEFAULT)
}
