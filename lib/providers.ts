export interface ProviderConfig {
  id: string
  name: string
  apiKey: string
  endpoint: string
  enabled: boolean
  requestOrigin?: "client" | "server"
  openaiApiKey?: string
}

export interface ProviderSettings {
  fal: ProviderConfig
  openai: ProviderConfig
  newapi: ProviderConfig
  openrouter: ProviderConfig
  gemini: ProviderConfig
}

const DEFAULT_PROVIDERS: ProviderSettings = {
  fal: {
    id: "fal",
    name: "FAL Queue",
    apiKey: "",
    endpoint: "https://queue.fal.run/fal-ai/flux/dev",
    requestOrigin: "client",
    openaiApiKey: "",
    enabled: false,
  },
  openai: {
    id: "openai",
    name: "OpenAI Images",
    apiKey: "",
    endpoint: "https://api.openai.com/v1/images/generations",
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
    return {
      ...DEFAULT_PROVIDERS,
      ...stored,
      fal: { ...DEFAULT_PROVIDERS.fal, ...stored?.fal },
      openai: { ...DEFAULT_PROVIDERS.openai, ...stored?.openai },
      newapi: { ...DEFAULT_PROVIDERS.newapi, ...stored?.newapi },
      openrouter: { ...DEFAULT_PROVIDERS.openrouter, ...stored?.openrouter },
      gemini: { ...DEFAULT_PROVIDERS.gemini, ...stored?.gemini },
    }
  } catch (error) {
    console.error("Failed to decrypt provider settings:", error)
    return DEFAULT_PROVIDERS
  }
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
