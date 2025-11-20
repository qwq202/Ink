import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const endpoint = formData.get("endpoint") as string
    const apiKey = formData.get("apiKey") as string

    if (!endpoint || !apiKey) {
      return NextResponse.json(
        { error: "Missing endpoint or apiKey" },
        { status: 400 }
      )
    }

    console.log(`[OpenRouter Proxy] Endpoint: ${endpoint}`)

    // Remove metadata fields
    formData.delete("endpoint")
    formData.delete("apiKey")

    // Build request body
    const requestBody: Record<string, any> = {}
    formData.forEach((value, key) => {
      requestBody[key] = value
    })

    console.log(`[OpenRouter Proxy] Request body:`, Object.keys(requestBody))

    const model = requestBody.model as string | undefined
    const prompt = requestBody.prompt as string | undefined
    const n = Math.max(1, Number.parseInt((requestBody.n as string) ?? "1", 10) || 1)
    const size = (requestBody.size as string | undefined) || "1024x1024"
    const quality = requestBody.quality as string | undefined
    const style = requestBody.style as string | undefined

    if (!model || !prompt) {
      return NextResponse.json({ error: "Missing model or prompt" }, { status: 400 })
    }

    const [width, height] = size.split("x").map((value) => Number.parseInt(value, 10))
    const parsedWidth = Number.isFinite(width) ? width : 1024
    const parsedHeight = Number.isFinite(height) ? height : 1024

    const promptSegments = [prompt]
    if (style) {
      promptSegments.push(`Style: ${style}`)
    }
    if (quality) {
      promptSegments.push(`Quality: ${quality}`)
    }

    const messages = [
      {
        role: "user" as const,
        content: [{ type: "text" as const, text: promptSegments.join("\n\n") }],
      },
    ]

    const targetEndpoint = `${endpoint}/chat/completions`
    console.log(`[OpenRouter Proxy] Target: ${targetEndpoint}`)

    const chatPayload: Record<string, unknown> = {
      model,
      messages,
      modalities: ["image", "text"],
      max_output_tokens: 1024,
      extra_body: {
        image_dimensions: {
          width: parsedWidth,
          height: parsedHeight,
        },
        num_images: n,
      },
    }

    const response = await fetch(targetEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(chatPayload),
    })

    console.log(`[OpenRouter Proxy] Response status: ${response.status}`)

    const text = await response.text()
    console.log(`[OpenRouter Proxy] Response text length: ${text.length}`)

    let data: any

    try {
      data = JSON.parse(text)
    } catch (error) {
      console.error(`[OpenRouter Proxy] Failed to parse response:`, text.substring(0, 200))
      return NextResponse.json(
        { error: "Failed to parse OpenRouter response", details: text.substring(0, 500) },
        { status: 500 }
      )
    }

    if (!response.ok) {
      console.error(`[OpenRouter Proxy] Request failed:`, data)
      return NextResponse.json(
        { error: data.error?.message || data.message || "OpenRouter request failed", details: data },
        { status: response.status }
      )
    }

    console.log(`[OpenRouter Proxy] Success, returning ${data.choices?.length || 0} choices`)
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`[OpenRouter Proxy] Exception:`, error)
    return NextResponse.json(
      { error: message, stack: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    )
  }
}
