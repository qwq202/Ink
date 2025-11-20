import { NextResponse } from "next/server"

interface FalProxyPayload {
  endpoint: string
  requestId?: string
  apiKey: string
  resource: "status" | "result" | "generate"
  payload?: unknown
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<FalProxyPayload>
    const { endpoint, requestId, apiKey, resource, payload } = body

    if (!endpoint || !apiKey || !resource) {
      return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 })
    }

    if (resource !== "generate" && !requestId) {
      return NextResponse.json({ success: false, error: "Missing requestId" }, { status: 400 })
    }

    const normalizedEndpoint = endpoint.replace(/\/$/, "")
    let url = normalizedEndpoint
    let response: Response | null = null

    if (resource === "generate") {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload ?? {}),
      })
    } else {
      const urlCandidates = new Set<string>()
      const suffix = resource === "result" ? `/requests/${requestId}` : `/requests/${requestId}/status`

      // Attempt with progressively trimmed endpoints
      const parts = normalizedEndpoint.split("/")
      for (let i = parts.length; i >= 3; i -= 1) {
        const base = parts.slice(0, i).join("/")
        urlCandidates.add(`${base}${suffix}`)
      }
      urlCandidates.add(`https://queue.fal.run${suffix}`)
      if (resource === "result") {
        urlCandidates.add(`https://queue.fal.run/requests/${requestId}/outputs`)
      }

      for (const candidate of urlCandidates) {
        url = candidate
        response = await fetch(candidate, {
          method: "GET",
          headers: {
            Authorization: `Key ${apiKey}`,
            Accept: "application/json",
          },
        })

        if (response.status !== 405 && response.status !== 404) {
          break
        }
      }
    }

    if (!response) {
      return NextResponse.json({ success: false, error: "Unable to contact FAL endpoint" }, { status: 500 })
    }

    console.info("[FAL proxy]", {
      url,
      status: response.status,
      ok: response.ok,
      resource,
    })

    const contentType = response.headers.get("content-type") || "application/json"
    const responsePayload = await response.text()

    return new NextResponse(responsePayload, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
      },
    })
  } catch (error) {
    console.error("FAL proxy request failed:", error)
    return NextResponse.json({ success: false, error: "Failed to proxy request" }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
