export type OpenAIAPIMode = "image" | "responses"

export interface ProviderConfig {
  id: string
  name: string
  apiKey: string
  endpoint?: string
  enabled: boolean
  requestOrigin?: "client" | "server"
  openaiApiKey?: string
  openaiApiMode?: OpenAIAPIMode
}

export interface FalProviderConfig extends Omit<ProviderConfig, "endpoint" | "requestOrigin"> {}

export interface ProviderSettings {
  fal: FalProviderConfig
  openai: ProviderConfig
  newapi: ProviderConfig
  openrouter: ProviderConfig
  gemini: ProviderConfig
}

const DEFAULT_PROVIDERS: ProviderSettings = {
  fal: {
    id: "fal",
    name: "FAL",
    apiKey: "",
    enabled: false,
  },
  openai: {
    id: "openai",
    name: "OpenAI Images",
    apiKey: "",
    endpoint: "https://api.openai.com/v1/images/generations",
    openaiApiMode: "image",
    enabled: false,
  },
  newapi: {
    id: "newapi",
    name: "NewAPI Images",
    apiKey: "",
    endpoint: "https://your-newapi-host",
    requestOrigin: "server",
    enabled: false,
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    apiKey: "",
    endpoint: "https://openrouter.ai/api/v1",
    requestOrigin: "server",
    enabled: false,
  },
  gemini: {
    id: "gemini",
    name: "Gemini (Google AI)",
    apiKey: "",
    endpoint: "https://generativelanguage.googleapis.com",
    requestOrigin: "server",
    enabled: false,
  },
}

const STORAGE_KEY = "ai-image-tool-providers"
const ENCRYPTION_KEY_NAME = "provider-encryption-key"
const FAL_LEGACY_INVALIDATED_NOTICE_KEY = "ai-image-tool-fal-legacy-invalidated"

function hasFalLegacyFields(config: unknown): boolean {
  if (!config || typeof config !== "object") {
    return false
  }
  const falConfig = config as Record<string, unknown>
  return "endpoint" in falConfig || "requestOrigin" in falConfig
}

function normalizeOpenAIConfig(config: unknown): Omit<ProviderConfig, "id" | "name"> {
  if (!config || typeof config !== "object") {
    return DEFAULT_PROVIDERS.openai
  }

  const openAIConfig = config as Record<string, unknown>

  return {
    ...DEFAULT_PROVIDERS.openai,
    apiKey: typeof openAIConfig.apiKey === "string" ? openAIConfig.apiKey : DEFAULT_PROVIDERS.openai.apiKey,
    endpoint:
      typeof openAIConfig.endpoint === "string" && openAIConfig.endpoint.trim()
        ? openAIConfig.endpoint.trim()
        : DEFAULT_PROVIDERS.openai.endpoint,
    requestOrigin:
      openAIConfig.requestOrigin === "client" || openAIConfig.requestOrigin === "server"
        ? openAIConfig.requestOrigin
        : DEFAULT_PROVIDERS.openai.requestOrigin,
    enabled: typeof openAIConfig.enabled === "boolean" ? openAIConfig.enabled : DEFAULT_PROVIDERS.openai.enabled,
    openaiApiMode: openAIConfig.openaiApiMode === "responses" ? "responses" : "image",
  }
}

function setFalLegacyInvalidatedNotice(): void {
  if (typeof window === "undefined") return
  localStorage.setItem(FAL_LEGACY_INVALIDATED_NOTICE_KEY, "1")
}

function sanitizeFalConfig(config: unknown): { fal: FalProviderConfig; legacyInvalidated: boolean } {
  if (!config || typeof config !== "object") {
    return { fal: DEFAULT_PROVIDERS.fal, legacyInvalidated: false }
  }

  const falConfig = config as Record<string, unknown>
  const legacyInvalidated = hasFalLegacyFields(falConfig)

  return {
    fal: {
      ...DEFAULT_PROVIDERS.fal,
      apiKey: typeof falConfig.apiKey === "string" ? falConfig.apiKey : DEFAULT_PROVIDERS.fal.apiKey,
      openaiApiKey:
        typeof falConfig.openaiApiKey === "string" ? falConfig.openaiApiKey : DEFAULT_PROVIDERS.fal.openaiApiKey,
      enabled: typeof falConfig.enabled === "boolean" ? falConfig.enabled : DEFAULT_PROVIDERS.fal.enabled,
    },
    legacyInvalidated,
  }
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyData = localStorage.getItem(ENCRYPTION_KEY_NAME)

  if (keyData) {
    const jwk = JSON.parse(keyData)
    return await crypto.subtle.importKey("jwk", jwk, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
  }

  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])

  const jwk = await crypto.subtle.exportKey("jwk", key)
  localStorage.setItem(ENCRYPTION_KEY_NAME, JSON.stringify(jwk))

  return key
}

async function encryptData(data: string): Promise<string> {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(data)

  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded)

  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)

  return btoa(String.fromCharCode(...combined))
}

async function decryptData(encryptedData: string): Promise<string> {
  const key = await getEncryptionKey()
  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0))

  const iv = combined.slice(0, 12)
  const data = combined.slice(12)

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data)

  return new TextDecoder().decode(decrypted)
}

export async function saveProviderSettings(settings: ProviderSettings): Promise<void> {
  const encrypted = await encryptData(JSON.stringify(settings))
  localStorage.setItem(STORAGE_KEY, encrypted)
}

export async function loadProviderSettings(): Promise<ProviderSettings> {
  const encrypted = localStorage.getItem(STORAGE_KEY)

  if (!encrypted) {
    return DEFAULT_PROVIDERS
  }

  try {
    const decrypted = await decryptData(encrypted)
    const stored = JSON.parse(decrypted) as Partial<ProviderSettings>
    const { fal, legacyInvalidated } = sanitizeFalConfig(stored?.fal)
    if (legacyInvalidated) {
      setFalLegacyInvalidatedNotice()
    }

    return {
      ...DEFAULT_PROVIDERS,
      ...stored,
      fal,
      openai: {
        ...normalizeOpenAIConfig(stored?.openai),
        id: "openai",
        name: "OpenAI Images",
      },
      newapi: { ...DEFAULT_PROVIDERS.newapi, ...stored?.newapi },
      openrouter: { ...DEFAULT_PROVIDERS.openrouter, ...stored?.openrouter },
      gemini: { ...DEFAULT_PROVIDERS.gemini, ...stored?.gemini },
    }
  } catch (error) {
    console.error("Failed to decrypt provider settings:", error)
    return DEFAULT_PROVIDERS
  }
}

export function consumeFalLegacyInvalidatedNotice(): boolean {
  if (typeof window === "undefined") return false
  const flagged = localStorage.getItem(FAL_LEGACY_INVALIDATED_NOTICE_KEY) === "1"
  if (flagged) {
    localStorage.removeItem(FAL_LEGACY_INVALIDATED_NOTICE_KEY)
  }
  return flagged
}

export async function updateProviderConfig(providerId: string, config: Partial<ProviderConfig>): Promise<void> {
  const settings = await loadProviderSettings()
  const current = settings[providerId as keyof ProviderSettings]

  if (!current) {
    throw new Error(`Unknown provider: ${providerId}`)
  }

  settings[providerId as keyof ProviderSettings] = {
    ...current,
    ...config,
  }
  await saveProviderSettings(settings)
}

export async function getEnabledProviders(): Promise<ProviderConfig[]> {
  const settings = await loadProviderSettings()
  return Object.values(settings).filter((provider) => provider?.enabled && provider.apiKey)
}
