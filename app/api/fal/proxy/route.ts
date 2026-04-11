import { TARGET_URL_HEADER } from "@fal-ai/server-proxy"
import { createRouteHandler } from "@fal-ai/server-proxy/nextjs"
import { NextRequest, NextResponse } from "next/server"

interface LegacyFalProxyPayload {
  endpoint: string
  requestId?: string
  apiKey?: string
  resource: "status" | "result" | "generate"
  payload?: unknown
}

function resolveServerFalAuth(authorization: string | null): string | undefined {
  if (authorization?.trim()) {
    return authorization.startsWith("Key ")
      ? authorization
      : `Key ${authorization.replace(/^Key\s+/i, "")}`
  }

  const envKey = process.env.FAL_KEY?.trim()
  if (envKey) {
    return envKey.startsWith("Key ") ? envKey : `Key ${envKey}`
  }

  const envKeyId = process.env.FAL_KEY_ID?.trim()
  const envKeySecret = process.env.FAL_KEY_SECRET?.trim()
  if (envKeyId && envKeySecret) {
    return `Key ${envKeyId}:${envKeySecret}`
  }

  return undefined
}

const proxyRoute = createRouteHandler({
  allowedEndpoints: ["fal-ai/**"],
  allowUnauthorizedRequests: false,
  isAuthenticated: async (behavior) => Boolean(resolveServerFalAuth(behavior.getHeader("authorization"))),
  resolveFalAuth: async (behavior) => resolveServerFalAuth(behavior.getHeader("authorization")),
})

function ensureAbsoluteFalUrl(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint.replace(/\/$/, "")
  }

  const normalized = endpoint.replace(/^\/+/, "").replace(/\/$/, "")
  return `https://fal.run/${normalized}`
}

function buildLegacyTargetUrl(body: LegacyFalProxyPayload): string {
  const baseEndpoint = ensureAbsoluteFalUrl(body.endpoint)
  if (body.resource === "generate") {
    return baseEndpoint
  }

  const requestId = body.requestId?.trim()
  if (!requestId) {
    throw new Error("Missing requestId")
  }

  const suffix = body.resource === "status" ? `/requests/${requestId}/status` : `/requests/${requestId}`
  return `${baseEndpoint.replace(/\/$/, "")}${suffix}`
}

function normalizeAuthorizationHeader(apiKey?: string): string | null {
  if (!apiKey) return null
  const value = apiKey.trim()
  if (!value) return null
  return value.startsWith("Key ") ? value : `Key ${value.replace(/^Key\s+/i, "")}`
}

async function handleLegacyPost(request: NextRequest): Promise<Response> {
  let body: LegacyFalProxyPayload

  try {
    body = (await request.json()) as LegacyFalProxyPayload
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 })
  }

  if (!body?.endpoint || !body?.resource) {
    return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 })
  }

  if (body.resource !== "generate" && !body.requestId) {
    return NextResponse.json({ success: false, error: "Missing requestId" }, { status: 400 })
  }

  const targetUrl = buildLegacyTargetUrl(body)
  const headers = new Headers(request.headers)
  headers.set(TARGET_URL_HEADER, targetUrl)

  const normalizedAuth = normalizeAuthorizationHeader(body.apiKey)
  if (normalizedAuth) {
    headers.set("authorization", normalizedAuth)
  }

  const method = body.resource === "generate" ? "POST" : "GET"
  const proxiedRequest = new NextRequest(request.url, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body.payload ?? {}) : undefined,
  })

  if (method === "POST") {
    return proxyRoute.POST(proxiedRequest)
  }

  return proxyRoute.GET(proxiedRequest)
}

export async function POST(request: NextRequest) {
  if (request.headers.get(TARGET_URL_HEADER)) {
    return proxyRoute.POST(request)
  }

  return handleLegacyPost(request)
}

export const GET = proxyRoute.GET
export const PUT = proxyRoute.PUT
