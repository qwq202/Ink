import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const apiKey = formData.get("apiKey") as string
    const model = formData.get("model") as string || "gemini-2.5-flash-image"
    const prompt = formData.get("prompt") as string
    const size = formData.get("size") as string
    const thinkingLevel = formData.get("thinking_level") as string
    const mediaResolution = formData.get("media_resolution") as string
    const aspectRatio = formData.get("aspect_ratio") as string

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing Gemini API key" },
        { status: 400 }
      )
    }

    if (!prompt) {
      return NextResponse.json(
        { error: "Missing prompt" },
        { status: 400 }
      )
    }

    console.log(`[Gemini Proxy] Model: ${model}`)

    // 构建 Gemini API endpoint
    const baseUrl = "https://generativelanguage.googleapis.com"
    const geminiEndpoint = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`

    // 解析宽高比和分辨率
    const mapAspectRatio = (sizeStr?: string, customAspectRatio?: string) => {
      if (customAspectRatio) return customAspectRatio
      if (!sizeStr) return "1:1"
      const match = sizeStr.match(/(\d+)\s*x\s*(\d+)/i)
      if (!match) return "1:1"
      const w = Number(match[1])
      const h = Number(match[2])
      if (!w || !h) return "1:1"
      const ratio = w / h
      const candidates: { key: string; value: number }[] = [
        { key: "1:1", value: 1 },
        { key: "2:3", value: 2 / 3 },
        { key: "3:2", value: 3 / 2 },
        { key: "3:4", value: 3 / 4 },
        { key: "4:3", value: 4 / 3 },
        { key: "4:5", value: 4 / 5 },
        { key: "5:4", value: 5 / 4 },
        { key: "9:16", value: 9 / 16 },
        { key: "16:9", value: 16 / 9 },
        { key: "21:9", value: 21 / 9 },
      ]
      let best = candidates[0]
      let bestDiff = Math.abs(ratio - best.value)
      for (const c of candidates.slice(1)) {
        const diff = Math.abs(ratio - c.value)
        if (diff < bestDiff) {
          best = c
          bestDiff = diff
        }
      }
      return best.key
    }

    const mapResolution = (sizeStr?: string, customMediaResolution?: string) => {
      if (customMediaResolution) {
        if (customMediaResolution === "media_resolution_high") return "4K"
        if (customMediaResolution === "media_resolution_medium") return "2K"
        return "1K"
      }
      if (!sizeStr) return "1K"
      const match = sizeStr.match(/(\d+)\s*x\s*(\d+)/i)
      if (!match) return "1K"
      const w = Number(match[1])
      const h = Number(match[2])
      const maxSide = Math.max(w, h)
      if (maxSide >= 3800) return "4K"
      if (maxSide >= 1900) return "2K"
      return "1K"
    }

    const finalAspectRatio = mapAspectRatio(size, aspectRatio)
    const finalImageSize = mapResolution(size, mediaResolution)

    // 构建请求体
    const requestBody: Record<string, any> = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "image/png",
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: finalAspectRatio,
          imageSize: finalImageSize,
        },
      },
    }

    // 添加 thinking level（仅 Gemini 3 Pro 支持）
    if (thinkingLevel && model.includes("pro")) {
      requestBody.generationConfig.thinkingLevel = thinkingLevel
    }

    console.log("[Gemini Proxy] Request config:", {
      endpoint: geminiEndpoint.replace(apiKey, "***"),
      model,
      aspectRatio: finalAspectRatio,
      imageSize: finalImageSize,
      thinkingLevel: thinkingLevel || "default",
      promptLength: prompt.length,
    })

    // 发送请求到 Gemini API（60秒超时）
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    let response: Response
    try {
      response = await fetch(geminiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === "AbortError") {
        return NextResponse.json(
          { error: "请求超时，请稍后重试或降低图片分辨率" },
          { status: 504 }
        )
      }
      throw error
    }

    console.log("[Gemini Proxy] Response status:", response.status)

    const text = await response.text()
    console.log("[Gemini Proxy] Response text length:", text.length)

    if (!text || text.trim().length === 0) {
      console.error("[Gemini Proxy] Empty response")
      return NextResponse.json(
        { error: "Gemini API 返回空响应，请稍后重试" },
        { status: 502 }
      )
    }

    let data: any
    try {
      data = JSON.parse(text)
    } catch (parseError) {
      console.error("[Gemini Proxy] Parse error:", parseError)
      return NextResponse.json(
        { error: "Failed to parse Gemini response", details: text.substring(0, 500) },
        { status: 500 }
      )
    }

    if (!response.ok) {
      console.error("[Gemini Proxy] Request failed:", data)
      return NextResponse.json(
        { error: data.error?.message || data.message || "Gemini request failed", details: data },
        { status: response.status }
      )
    }

    // 解析响应
    const parts = data?.candidates?.[0]?.content?.parts ?? []
    const images = parts
      .map((p: any) => p?.inline_data)
      .filter(Boolean)
      .map((inline: any) => {
        const base64 = inline.data
        if (!base64) return null
        return { b64_json: base64 }
      })
      .filter(Boolean)

    if (!images.length) {
      console.error("[Gemini Proxy] No images in response:", data)
      return NextResponse.json(
        { error: "Gemini did not return inline image data", details: data },
        { status: 502 }
      )
    }

    console.log(`[Gemini Proxy] Success, returning ${images.length} image(s)`)
    return NextResponse.json({ data: images })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`[Gemini Proxy] Exception:`, error)
    return NextResponse.json(
      { error: message, stack: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    )
  }
}

