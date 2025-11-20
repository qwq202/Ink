import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get("endpoint")
    const apiKey = searchParams.get("apiKey")

    if (!endpoint || !apiKey) {
      return NextResponse.json(
        { error: "Missing endpoint or apiKey" },
        { status: 400 }
      )
    }

    // OpenRouter models endpoint
    const baseUrl = endpoint.replace(/\/+$/, "")
    const url = `${baseUrl}/models`

    console.log(`[OpenRouter Models] Fetching from: ${url}`)

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://ai-image-tool.local",
        "X-Title": process.env.OPENROUTER_TITLE || "AI Image Tool",
      },
    })

    if (!response.ok) {
      let errorPayload: unknown = null
      try {
        errorPayload = await response.json()
      } catch {
        errorPayload = await response.text()
      }
      console.error(`[OpenRouter Models] Error ${response.status}:`, errorPayload)
      return NextResponse.json(
        { error: `OpenRouter API error: ${response.status}`, details: errorPayload },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log(`[OpenRouter Models] Success, got ${data.data?.length || 0} models`)

    return NextResponse.json({
      ...data,
      cachedAt: Date.now(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`[OpenRouter Models] Exception:`, error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
