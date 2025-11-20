import { useState, useEffect, useCallback, useRef } from "react"

interface OpenRouterModel {
  id: string
  name?: string
  owned_by?: string
  input_modalities?: string[]
  output_modalities?: string[]
  modalities?: string[]
  tags?: string[]
  context_window?: number
  pricing?: {
    input?: number
    output?: number
  }
}

interface UseOpenRouterModelsOptions {
  apiKey?: string
  endpoint?: string
  enabled?: boolean
}

interface UseOpenRouterModelsReturn {
  models: OpenRouterModel[]
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  lastUpdatedAt: number | null
  refresh: () => Promise<void>
}

const CACHE_KEY_PREFIX = "openrouter-models"
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

// In-memory cache
const modelCache = new Map<string, { models: OpenRouterModel[]; timestamp: number }>()

function getCacheKey(endpoint: string, apiKey: string): string {
  const combined = `${endpoint}:${apiKey}`
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return `${CACHE_KEY_PREFIX}-${Math.abs(hash).toString(36)}`
}

function getFromMemoryCache(key: string): { models: OpenRouterModel[]; timestamp: number } | null {
  const cached = modelCache.get(key)
  if (!cached) return null

  const now = Date.now()
  if (now - cached.timestamp > CACHE_DURATION) {
    modelCache.delete(key)
    return null
  }

  return cached
}

function saveToMemoryCache(key: string, models: OpenRouterModel[], timestamp: number) {
  modelCache.set(key, { models, timestamp })
}

function getFromLocalStorage(key: string): { models: OpenRouterModel[]; timestamp: number } | null {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return null

    const parsed = JSON.parse(stored)
    const now = Date.now()
    if (now - parsed.timestamp > CACHE_DURATION) {
      localStorage.removeItem(key)
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function saveToLocalStorage(key: string, models: OpenRouterModel[], timestamp: number) {
  try {
    localStorage.setItem(key, JSON.stringify({ models, timestamp }))
  } catch (error) {
    console.warn("Failed to save OpenRouter models to localStorage:", error)
  }
}

async function fetchOpenRouterModels(
  endpoint: string,
  apiKey: string
): Promise<{ models: OpenRouterModel[]; timestamp: number }> {
  const cacheKey = getCacheKey(endpoint, apiKey)

  // Check memory cache first
  const memCached = getFromMemoryCache(cacheKey)
  if (memCached && memCached.models.length > 0) {
    return memCached
  }

  // Check localStorage
  const lsCached = getFromLocalStorage(cacheKey)
  if (lsCached && lsCached.models.length > 0) {
    saveToMemoryCache(cacheKey, lsCached.models, lsCached.timestamp)
    return lsCached
  }

  // Fetch from API
  const timestamp = Date.now()
  const response = await fetch(`/api/openrouter/models?endpoint=${encodeURIComponent(endpoint)}&apiKey=${encodeURIComponent(apiKey)}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch OpenRouter models: ${error}`)
  }

  const data = await response.json()
  
  // Filter models that support image output
  const rawModels: OpenRouterModel[] = Array.isArray(data.data) ? data.data : []

  const filtered = rawModels.filter((model: OpenRouterModel) => {
    const candidates = [
      ...(model.output_modalities ?? []),
      ...(model.input_modalities ?? []),
      ...(model.modalities ?? []),
      ...(model.tags ?? []),
    ].map((value) => value?.toLowerCase?.())

    if (candidates.some((value) => value === "image" || value === "images" || value === "vision")) {
      return true
    }

    return /image|vision|photo/.test(model.id.toLowerCase())
  })

  const imageModels = filtered.length > 0 ? filtered : rawModels

  if (imageModels.length > 0) {
    saveToMemoryCache(cacheKey, imageModels, timestamp)
    saveToLocalStorage(cacheKey, imageModels, timestamp)
  } else {
    modelCache.delete(cacheKey)
    try {
      localStorage.removeItem(cacheKey)
    } catch {
      /* ignore */
    }
  }

  return { models: imageModels, timestamp }
}

export function useOpenRouterModels(options: UseOpenRouterModelsOptions): UseOpenRouterModelsReturn {
  const { apiKey, endpoint, enabled = true } = options
  const [models, setModels] = useState<OpenRouterModel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const fetchedRef = useRef(false)

  const loadModels = useCallback(
    async (isRefresh = false) => {
      // For manual refresh, only check apiKey and endpoint
      // For auto-load, also check enabled
      if (!isRefresh && !enabled) {
        console.log('[OpenRouter Models] Skipping auto-load: not enabled')
        return
      }
      
      if (!apiKey || !endpoint) {
        console.log('[OpenRouter Models] Skipping load:', { enabled, hasApiKey: !!apiKey, hasEndpoint: !!endpoint })
        return
      }

      console.log('[OpenRouter Models] Loading models...', { endpoint, isRefresh })

      if (isRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      try {
        const cacheKey = getCacheKey(endpoint, apiKey)

        if (isRefresh) {
          // Clear caches on refresh
          modelCache.delete(cacheKey)
          localStorage.removeItem(cacheKey)
        }

        const { models: fetchedModels, timestamp } = await fetchOpenRouterModels(endpoint, apiKey)
        console.log('[OpenRouter Models] Loaded', fetchedModels.length, 'models')
        setModels(fetchedModels)
        setLastUpdatedAt(timestamp)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        setError(message)
        console.error("Failed to load OpenRouter models:", err)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [enabled, apiKey, endpoint]
  )

  const refresh = useCallback(async () => {
    console.log('[OpenRouter Models] Refresh called', { enabled, hasApiKey: !!apiKey, hasEndpoint: !!endpoint })
    if (!apiKey || !endpoint) {
      console.warn('[OpenRouter Models] Cannot refresh: missing apiKey or endpoint')
      return
    }
    await loadModels(true)
  }, [loadModels, enabled, apiKey, endpoint])

  useEffect(() => {
    if (fetchedRef.current || !enabled || !apiKey || !endpoint) {
      return
    }
    
    fetchedRef.current = true
    void loadModels(false)
  }, [enabled, apiKey, endpoint, loadModels])
  
  // Reset fetchedRef when key parameters change
  useEffect(() => {
    fetchedRef.current = false
  }, [apiKey, endpoint])

  return {
    models,
    isLoading,
    isRefreshing,
    error,
    lastUpdatedAt,
    refresh,
  }
}

// Prefetch function for eager loading
export async function prefetchOpenRouterModels(endpoint: string, options: { apiKey: string }): Promise<void> {
  try {
    await fetchOpenRouterModels(endpoint, options.apiKey)
  } catch (error) {
    console.warn("Failed to prefetch OpenRouter models:", error)
  }
}
