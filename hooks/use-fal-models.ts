"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export interface FalModel {
  id: string
  title: string
  description: string
  tags: string[]
  thumbnailUrl: string
  deprecated: boolean
  unlisted: boolean
  groupLabel: string | null
  queueEndpoint: string
}

interface FalModelsApiResponse {
  success: boolean
  total: number
  items: FalModel[]
  nextCursor?: string | null
  error?: string
  cachedAt?: number
  source?: "v1" | "legacy"
}

interface UseFalModelsOptions {
  category?: string
  apiKey?: string
  enabled?: boolean
  search?: string
}

const AUTH_HEADER = "x-fal-key"
const CACHE_NAMESPACE = "ai-image-tool:fal-models:v1"

interface FalModelsCacheEntry {
  items: FalModel[]
  cachedAt: number
}

const memoryCache = new Map<string, FalModelsCacheEntry>()
const prefetchInFlight = new Map<string, Promise<void>>()

function hashString(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return hash.toString(16)
}

function createCacheKey(category?: string, search?: string, apiKey?: string) {
  const normalizedCategory = (category || "default").trim().toLowerCase()
  const normalizedSearch = (search || "").trim().toLowerCase()
  const keySignature = apiKey ? `key-${hashString(apiKey)}` : "anon"
  return `${CACHE_NAMESPACE}:${normalizedCategory}:${normalizedSearch}:${keySignature}`
}

function readCache(key: string): FalModelsCacheEntry | null {
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
      !Array.isArray(parsed.items) ||
      typeof parsed.cachedAt !== "number"
    ) {
      return null
    }
    memoryCache.set(key, parsed as FalModelsCacheEntry)
    return parsed as FalModelsCacheEntry
  } catch {
    return null
  }
}

function writeCache(key: string, entry: FalModelsCacheEntry) {
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

export function useFalModels(options: UseFalModelsOptions = {}) {
  const { category = "text-to-image", apiKey, enabled = true, search } = options
  const [models, setModels] = useState<FalModel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const isMountedRef = useRef(true)
  const cacheKey = useMemo(() => createCacheKey(category, search, apiKey), [apiKey, category, search])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadModels = useCallback(
    async (forceRefresh = false) => {
      if (!enabled) {
        setError(null)
        setIsLoading(false)
        setIsRefreshing(false)
        return
      }

      try {
        setError(null)

        if (!forceRefresh) {
          const cached = readCache(cacheKey)
          if (cached && isMountedRef.current) {
            setModels(cached.items)
            setLastUpdatedAt(cached.cachedAt)
            setIsLoading(false)
            setIsRefreshing(false)
            return
          }
        }

        // 如果本地没有缓存且未提供 Key，就不去请求远端，避免无意义的 401
        if (!apiKey) {
          setIsLoading(false)
          setIsRefreshing(false)
          setError(enabled ? "请先启用并填写 FAL Admin Key，再获取模型列表。" : null)
          return
        }

        setIsLoading(true)
        if (forceRefresh) {
          setIsRefreshing(true)
        }

        const params = new URLSearchParams()
        if (category) {
          params.set("category", category)
        }
        if (search) {
          params.set("search", search)
        }
        if (forceRefresh) {
          params.set("refresh", "1")
        }

        const query = params.toString()
        const response = await fetch(query ? `/api/fal/models?${query}` : "/api/fal/models", {
          headers: apiKey ? { [AUTH_HEADER]: apiKey } : undefined,
        })
        if (!response.ok) {
          let message = ""
          try {
            const errorPayload = await response.json()
            message = typeof errorPayload?.error === "string" ? errorPayload.error : ""
          } catch {
            const text = await response.text()
            message = text
          }

          throw new Error(message || `Fal models request failed with status ${response.status}`)
        }

        const data = (await response.json()) as FalModelsApiResponse
        if (!data.success) {
          throw new Error(data.error || "Failed to load fal models")
        }

        if (isMountedRef.current) {
          setModels(data.items)
          setLastUpdatedAt(typeof data.cachedAt === "number" ? data.cachedAt : Date.now())
          writeCache(cacheKey, {
            items: data.items,
            cachedAt: typeof data.cachedAt === "number" ? data.cachedAt : Date.now(),
          })
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : "Unknown fal models error")
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [apiKey, cacheKey, category, enabled, search],
  )

  useEffect(() => {
    loadModels()
  }, [loadModels])

  const refresh = useCallback(() => loadModels(true), [loadModels])

  const availableModels = useMemo(
    () => models.filter((model) => !model.deprecated && !model.unlisted),
    [models],
  )

  return {
    models: availableModels,
    rawModels: models,
    isLoading,
    isRefreshing,
    error,
    lastUpdatedAt,
    refresh,
  }
}

export function prefetchFalModels(
  category: string,
  options: { apiKey?: string; search?: string; enabled?: boolean } = {},
): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve()
  }

  const { apiKey, search, enabled = true } = options

  // 只有在供应商已启用且提供了 Key 时才预取
  if (!enabled || !apiKey) {
    return Promise.resolve()
  }

  const cacheKey = createCacheKey(category, search, apiKey)

  if (memoryCache.has(cacheKey) || readCache(cacheKey)) {
    return Promise.resolve()
  }

  const existing = prefetchInFlight.get(cacheKey)
  if (existing) {
    return existing
  }

  const params = new URLSearchParams()
  if (category) {
    params.set("category", category)
  }
  if (search) {
    params.set("search", search)
  }

  const query = params.toString()
  const promise = fetch(query ? `/api/fal/models?${query}` : "/api/fal/models", {
    headers: apiKey ? { [AUTH_HEADER]: apiKey } : undefined,
  })
    .then(async (response) => {
      if (!response.ok) {
        return
      }
      const data = (await response.json()) as FalModelsApiResponse
      if (!data.success || !Array.isArray(data.items)) {
        return
      }
      writeCache(cacheKey, {
        items: data.items,
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
