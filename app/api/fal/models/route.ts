interface FalModelItem {
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

interface FalV1Model {
  endpoint_id?: string
  metadata?: {
    display_name?: string
    description?: string
    tags?: string[]
    thumbnail_url?: string
    status?: string | null
    highlighted?: boolean | null
    pinned?: boolean | null
    group?: {
      key?: string | null
      label?: string | null
    } | null
    unlisted?: boolean | null
  }
}

interface FalV1ModelsResponse {
  models?: FalV1Model[]
  next_cursor?: string | null
}

export const revalidate = 3600 // 1 hour

const DEFAULT_TOTAL_LIMIT = 500
const MAX_TOTAL_LIMIT = 500
const V1_MAX_PAGE_SIZE = 50
const V1_MODELS_URL = "https://api.fal.ai/v1/models"
const AUTH_HEADER_KEY = "authorization"
const FALLBACK_AUTH_HEADER_KEY = "x-fal-key"
const V1_MAX_RETRY_ATTEMPTS = 3
const V1_RETRY_BASE_DELAY_MS = 200

interface FalModelsCacheEntry {
  items: FalModelItem[]
  timestamp: number
}

class FalModelsFetchError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.name = "FalModelsFetchError"
    this.status = status
  }
}

const falModelsCache = new Map<string, FalModelsCacheEntry>()
const falModelsInFlight = new Map<string, Promise<FalModelsCacheEntry>>()

function getCacheKey(category: string, authorizationHeader: string | null): string {
  const normalizedCategory = category || "default"
  const normalizedAuth = authorizationHeader ? authorizationHeader.trim() : "public"
  return `${normalizedCategory}::${normalizedAuth}`
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function fetchFalV1ModelsPage({
  category,
  cursor,
  limit,
  query,
  authorization,
}: {
  category: string
  cursor?: string | null
  limit: number
  query?: string | null
  authorization?: string | null
}): Promise<FalV1ModelsResponse> {
  const url = new URL(V1_MODELS_URL)
  url.searchParams.set("category", category)
  url.searchParams.set("limit", limit.toString())
  if (query) {
    url.searchParams.set("q", query)
  }
  if (cursor) {
    url.searchParams.set("cursor", cursor)
  }

  const headers: HeadersInit = {
    Accept: "application/json",
  }

  if (authorization) {
    headers.Authorization = authorization.startsWith("Key ") ? authorization : `Key ${authorization.replace(/^Key\s+/i, "")}`
  }

  const response = await fetch(url, {
    headers,
    next: {
      revalidate,
    },
  })

  if (!response.ok) {
    const errorPayload = await response.text()
    const error = new Error(
      `Failed to fetch fal.ai v1 models (status ${response.status}). Response: ${errorPayload || "Unknown error"}`,
    )
    ;(error as { status?: number }).status = response.status
    throw error
  }

  return (await response.json()) as FalV1ModelsResponse
}

function normalizeV1Models(models: FalV1Model[]): FalModelItem[] {
  return models
    .map((model) => {
      const id = model.endpoint_id
      if (!id) return null

      const metadata = model.metadata ?? {}
      const title = metadata.display_name || id
      const description = metadata.description ?? ""
      const tags = Array.isArray(metadata.tags) ? metadata.tags : []
      const thumbnailUrl = typeof metadata.thumbnail_url === "string" ? metadata.thumbnail_url : ""
      const status = metadata.status?.toLowerCase()

      return {
        id,
        title,
        description,
        tags,
        thumbnailUrl,
        deprecated: status ? status !== "active" : false,
        unlisted: Boolean(metadata.unlisted),
        groupLabel: metadata.group?.label ?? null,
        queueEndpoint: `https://queue.fal.run/${id}`,
      }
    })
    .filter((item): item is FalModelItem => Boolean(item))
}

async function loadFalModelsFromRemote({
  category,
  authorizationHeader,
  logContext,
}: {
  category: string
  authorizationHeader: string | null
  logContext: Record<string, unknown>
}): Promise<FalModelsCacheEntry> {
  console.info("[api/fal/models] Fetching fal.ai v1 models", logContext)

  const targetFetchLimit = MAX_TOTAL_LIMIT
  const items: FalModelItem[] = []
  let cursor: string | null = null
  let safetyCounter = 0

  const fetchPageWithRetry = async (): Promise<FalV1ModelsResponse> => {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= V1_MAX_RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await fetchFalV1ModelsPage({
          category,
          cursor,
          limit: Math.min(targetFetchLimit - items.length, V1_MAX_PAGE_SIZE),
          query: null,
          authorization: authorizationHeader,
        })
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        const status = (lastError as { status?: number })?.status

        if (status === 401 || status === 403) {
          throw new FalModelsFetchError(
            authorizationHeader
              ? "FAL API 密钥无效或权限不足，请检查后重试。"
              : "fal.ai 模型列表接口当前拒绝匿名访问，请提供 FAL API Key 后重试。",
            403,
          )
        }

        if (status && status >= 500) {
          console.warn("[api/fal/models] v1 models request failed, retrying", {
            ...logContext,
            status,
            attempt,
            maxAttempts: V1_MAX_RETRY_ATTEMPTS,
            cursor,
          })

          if (attempt < V1_MAX_RETRY_ATTEMPTS) {
            await sleep(V1_RETRY_BASE_DELAY_MS * attempt)
            continue
          }

          throw new FalModelsFetchError(
            `fal.ai v1 模型列表接口多次返回服务端错误（HTTP ${status}）。请稍后再试。`,
            502,
          )
        }

        if (status && status >= 400) {
          throw new FalModelsFetchError(
            `fal.ai v1 模型列表接口返回错误（HTTP ${status}）。请检查请求参数或稍后再试。`,
            status,
          )
        }

        console.error("[api/fal/models] Unexpected non-HTTP error when fetching v1 models", logContext, lastError)
        throw new FalModelsFetchError(`无法连接 fal.ai 模型列表接口：${lastError.message}`, 502)
      }
    }

    throw new FalModelsFetchError("fal.ai 模型列表接口连续失败，请稍后再试。", 502)
  }

  while (items.length < targetFetchLimit) {
    const data = await fetchPageWithRetry()

    const pageItems = normalizeV1Models(data.models ?? [])
    items.push(...pageItems)
    cursor = data.next_cursor ?? null

    console.debug("[api/fal/models] Loaded v1 models page", {
      ...logContext,
      fetched: pageItems.length,
      accumulated: items.length,
      nextCursor: cursor,
      loop: safetyCounter + 1,
    })

    safetyCounter += 1
    if (!cursor || pageItems.length === 0 || safetyCounter >= 20 || items.length >= targetFetchLimit) {
      break
    }
  }

  console.info("[api/fal/models] Refreshed cache from remote", {
    ...logContext,
    fetchedTotal: items.length,
  })

  return {
    items,
    timestamp: Date.now(),
  }
}

export async function GET(request: Request) {
  const startedAt = Date.now()
  const url = new URL(request.url)
  const searchParams = url.searchParams
  const categoryParam = searchParams.get("category") ?? searchParams.get("categories")
  const category = categoryParam?.trim() || "text-to-image"
  const searchQuery = searchParams.get("q") ?? searchParams.get("search")
  const limitParam = Number(searchParams.get("limit"))
  const requestedLimit =
    Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_TOTAL_LIMIT) : DEFAULT_TOTAL_LIMIT
  const forceRefreshParam = searchParams.get("refresh")
  const forceRefresh = forceRefreshParam === "1" || forceRefreshParam === "true"

  const authorizationHeader = request.headers.get(AUTH_HEADER_KEY) ?? request.headers.get(FALLBACK_AUTH_HEADER_KEY) ?? null
  const cacheKey = getCacheKey(category, authorizationHeader)

  const logContext = {
    category,
    searchQuery: searchQuery ?? null,
    requestedLimit,
    hasAuthorization: Boolean(authorizationHeader),
    authHeaderPreview: authorizationHeader ? `${authorizationHeader.slice(0, 4)}...len${authorizationHeader.length}` : null,
    cacheKey,
    forceRefresh,
  }

  console.info("[api/fal/models] Incoming request", logContext)

  let cacheEntry: FalModelsCacheEntry | undefined

  if (!forceRefresh) {
    cacheEntry = falModelsCache.get(cacheKey)
    if (cacheEntry) {
      console.debug("[api/fal/models] Serving models from cache", {
        ...logContext,
        cachedAt: cacheEntry.timestamp,
        cachedCount: cacheEntry.items.length,
      })
    }
  }

  if (!cacheEntry) {
    let inFlight = falModelsInFlight.get(cacheKey)

    if (!inFlight || forceRefresh) {
      const loadPromise = loadFalModelsFromRemote({
        category,
        authorizationHeader,
        logContext,
      })
      falModelsInFlight.set(cacheKey, loadPromise)
      inFlight = loadPromise
    }

    try {
      cacheEntry = await inFlight
      falModelsCache.set(cacheKey, cacheEntry)
    } catch (error) {
      const durationMs = Date.now() - startedAt
      const message = error instanceof Error ? error.message : "Failed to load fal.ai models"
      const status =
        error instanceof FalModelsFetchError
          ? error.status
          : (error as { status?: number })?.status ?? 500

      console.error("[api/fal/models] Failed to refresh cache", {
        ...logContext,
        durationMs,
        status,
      }, error)

      return Response.json(
        {
          success: false,
          error: message,
        },
        { status },
      )
    } finally {
      falModelsInFlight.delete(cacheKey)
    }
  }

  if (!cacheEntry) {
    const durationMs = Date.now() - startedAt
    console.error("[api/fal/models] Cache entry missing after refresh", {
      ...logContext,
      durationMs,
    })
    return Response.json(
      {
        success: false,
        error: "Fal model cache unavailable",
      },
      { status: 500 },
    )
  }

  const filteredItems = searchQuery
    ? cacheEntry.items.filter((item) => {
        const haystack = [item.id, item.title, item.description, ...item.tags].join(" ").toLowerCase()
        return haystack.includes(searchQuery.toLowerCase())
      })
    : cacheEntry.items

  const limitedItems =
    requestedLimit >= filteredItems.length ? filteredItems : filteredItems.slice(0, requestedLimit)

  const durationMs = Date.now() - startedAt
  console.info("[api/fal/models] Responded successfully", {
    ...logContext,
    totalReturned: limitedItems.length,
    cacheCount: cacheEntry.items.length,
    cachedAt: cacheEntry.timestamp,
    durationMs,
  })

  return Response.json({
    success: true,
    total: limitedItems.length,
    items: limitedItems,
    nextCursor: null,
    cachedAt: cacheEntry.timestamp,
    source: "v1",
  })
}
