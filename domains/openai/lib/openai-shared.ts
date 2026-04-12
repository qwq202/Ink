export function normalizeOpenAIEndpoint(providerEndpoint: string | undefined, requestPath: string): string {
  const fallbackBase = "https://api.openai.com"
  const endpoint = (providerEndpoint || fallbackBase).trim() || fallbackBase
  const requestPathNormalized = requestPath.replace(/^\/+/, "")

  try {
    const url = new URL(endpoint)
    const path = url.pathname.replace(/\/+$/, "")
    if (!path || path === "/") {
      return `${url.origin}/v1/${requestPathNormalized}`
    }

    const v1Match = path.match(/^(.*\/v1)(?:\/.*)?$/)
    if (v1Match) {
      let basePath = v1Match[1].replace(/\/+$/, "")
      if (basePath.endsWith("/images")) {
        basePath = basePath.slice(0, -"/images".length)
      }
      return `${url.origin}${basePath}/${requestPathNormalized}`
    }

    if (path.startsWith("/images")) {
      return `${url.origin}/v1/${requestPathNormalized}`
    }

    return `${url.origin}${path}/${requestPathNormalized}`
  } catch {
    return `${fallbackBase}/v1/${requestPathNormalized}`
  }
}

export function resolveOpenAIImageSize(imageSize: string): string {
  const normalized = imageSize.trim().replace(/\s+/g, "").toLowerCase()
  if (!normalized || normalized === "auto") {
    return "1024x1024"
  }
  return normalized
}

function collectValues(value: unknown, out: string[]): void {
  if (!value) return

  if (typeof value === "string") {
    if (/^data:/i.test(value) || /^https?:\/\//i.test(value)) {
      out.push(value)
    }
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectValues(item, out)
    }
    return
  }

  if (typeof value !== "object") return

  const record = value as Record<string, unknown>

  const candidate =
    record.url ||
    record.image ||
    record.uri ||
    (typeof record.image_url === "object" && record.image_url !== null
      ? (record.image_url as Record<string, unknown>).url
      : undefined)

  if (typeof candidate === "string") {
    collectValues(candidate, out)
  }

  if (typeof record.image_url === "string") {
    collectValues(record.image_url, out)
  }

  if (typeof record.b64_json === "string" && record.b64_json) {
    out.push(`data:image/png;base64,${record.b64_json}`)
  }

  if (typeof record.base64 === "string" && record.base64) {
    out.push(`data:image/png;base64,${record.base64}`)
  }

  if (typeof record.data === "string" && /^([A-Za-z0-9+/=\n]+)$/.test(record.data)) {
    out.push(`data:image/png;base64,${record.data}`)
  }

  const nestedKeys = [
    "images",
    "data",
    "output",
    "results",
    "choices",
    "content",
    "items",
    "file",
    "files",
    "payload",
    "response",
    "revisions",
    "output_image",
    "images_data",
  ]
  for (const key of nestedKeys) {
    const nested = record[key]
    if (nested !== undefined) {
      collectValues(nested, out)
    }
  }
}

export function extractOpenAIImageResults(response: unknown): string[] {
  const result: string[] = []
  collectValues(response, result)
  return Array.from(new Set(result))
}
