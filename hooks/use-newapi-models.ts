"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export interface NewApiModel {
  id: string
  channel?: string
}

interface NewApiModelsApiResponse {
  success: boolean
  data?: Record<string, string[]>
  error?: string
  cachedAt?: number
}

interface UseNewApiModelsOptions {
  apiKey?: string
  endpoint?: string
  enabled?: boolean
}

const CACHE_NAMESPACE = "ai-image-tool:newapi-models:v1"

interface NewApiModelsCacheEntry {
  models: NewApiModel[]
  cachedAt: number
}

const memoryCache = new Map<string, NewApiModelsCacheEntry>()
const prefetchInFlight = new Map<string, Promise<void>>()

function hashString(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return hash.toString(16)
}

function createCacheKey(endpoint?: string, apiKey?: string) {
  const endpointSignature = endpoint ? hashString(endpoint) : "default"
  const keySignature = apiKey ? `key-${hashString(apiKey)}` : "anon"
  return `${CACHE_NAMESPACE}:${endpointSignature}:${keySignature}`
}

function readCache(key: string): NewApiModelsCacheEntry | null {
  const inMemory = memoryCache.get(key)
  if (inMemory) {
    return inMemory
  }

  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw)
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray(parsed.models) ||
      typeof parsed.cachedAt !== "number"
    ) {
      return null
    }
    memoryCache.set(key, parsed as NewApiModelsCacheEntry)
    return parsed as NewApiModelsCacheEntry
  } catch {
    return null
  }
}

function writeCache(key: string, entry: NewApiModelsCacheEntry) {
  memoryCache.set(key, entry)

  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // Swallow storage errors (e.g. quota exceeded, private mode)
  }
}

function convertDataToModels(data: Record<string, string[]>): NewApiModel[] {
  const models: NewApiModel[] = []
  for (const [channel, modelIds] of Object.entries(data)) {
    for (const id of modelIds) {
      models.push({ id, channel })
    }
  }
  return models
}

export function useNewApiModels(options: UseNewApiModelsOptions = {}) {
  const { apiKey, endpoint, enabled = true } = options
  const [models, setModels] = useState<NewApiModel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const isMountedRef = useRef(true)
  const cacheKey = useMemo(() => createCacheKey(endpoint, apiKey), [apiKey, endpoint])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadModels = useCallback(
    async (forceRefresh = false) => {
      if (!enabled || !apiKey || !endpoint) {
        setError(null)
        setIsLoading(false)
        setIsRefreshing(false)
        setModels([])
        return
      }

      try {
        setError(null)

        if (!forceRefresh) {
          const cached = readCache(cacheKey)
          if (cached && isMountedRef.current) {
            setModels(cached.models)
            setLastUpdatedAt(cached.cachedAt)
            setIsLoading(false)
            setIsRefreshing(false)
            return
          }
        }

        setIsLoading(true)
        if (forceRefresh) {
          setIsRefreshing(true)
        }

        const params = new URLSearchParams()
        params.set("endpoint", endpoint)
        params.set("apiKey", apiKey)
        if (forceRefresh) {
          params.set("refresh", "1")
        }

        const query = params.toString()
        const response = await fetch(`/api/newapi/models?${query}`)
        
        if (!response.ok) {
          let message = ""
          try {
            const errorPayload = await response.json()
            message = typeof errorPayload?.error === "string" ? errorPayload.error : ""
          } catch {
            const text = await response.text()
            message = text
          }

          throw new Error(message || `NewAPI models request failed with status ${response.status}`)
        }

        const data = (await response.json()) as NewApiModelsApiResponse
        if (!data.success) {
          throw new Error(data.error || "Failed to load NewAPI models")
        }

        const modelsList = data.data ? convertDataToModels(data.data) : []

        if (isMountedRef.current) {
          setModels(modelsList)
          const cachedAt = typeof data.cachedAt === "number" ? data.cachedAt : Date.now()
          setLastUpdatedAt(cachedAt)
          writeCache(cacheKey, {
            models: modelsList,
            cachedAt,
          })
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : "Unknown NewAPI models error")
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [apiKey, cacheKey, enabled, endpoint],
  )

  useEffect(() => {
    loadModels()
  }, [loadModels])

  const refresh = useCallback(() => loadModels(true), [loadModels])

  return {
    models,
    isLoading,
    isRefreshing,
    error,
    lastUpdatedAt,
    refresh,
  }
}

export function prefetchNewApiModels(
  endpoint: string,
  options: { apiKey?: string } = {},
): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve()
  }

  const { apiKey } = options
  if (!apiKey) {
    return Promise.resolve()
  }

  const cacheKey = createCacheKey(endpoint, apiKey)

  if (memoryCache.has(cacheKey) || readCache(cacheKey)) {
    return Promise.resolve()
  }

  const existing = prefetchInFlight.get(cacheKey)
  if (existing) {
    return existing
  }

  const params = new URLSearchParams()
  params.set("endpoint", endpoint)
  params.set("apiKey", apiKey)

  const query = params.toString()
  const promise = fetch(`/api/newapi/models?${query}`)
    .then(async (response) => {
      if (!response.ok) {
        return
      }
      const data = (await response.json()) as NewApiModelsApiResponse
      if (!data.success || !data.data) {
        return
      }
      const modelsList = convertDataToModels(data.data)
      writeCache(cacheKey, {
        models: modelsList,
        cachedAt: typeof data.cachedAt === "number" ? data.cachedAt : Date.now(),
      })
    })
    .catch(() => undefined)
    .finally(() => {
      prefetchInFlight.delete(cacheKey)
    })

  prefetchInFlight.set(cacheKey, promise)
  return promise
}
