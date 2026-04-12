import { NextRequest, NextResponse } from "next/server"
import { getNewApiImagesUrl, normalizeNewApiBaseUrl } from "@/lib/newapi-endpoint"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const endpoint = formData.get("endpoint") as string
    const apiKey = formData.get("apiKey") as string
    const mode = formData.get("mode") as string // "generation" or "edit"

    if (!endpoint || !apiKey) {
      return NextResponse.json(
        { error: "Missing endpoint or apiKey" },
        { status: 400 }
      )
    }

    // Log the request for debugging
    console.log(`[NewAPI Proxy] Mode: ${mode}, Endpoint: ${endpoint}`)

    // Remove our metadata fields
    formData.delete("endpoint")
    formData.delete("apiKey")
    formData.delete("mode")

    // Determine the actual endpoint
    const baseUrl = normalizeNewApiBaseUrl(endpoint)

    const targetEndpoint = getNewApiImagesUrl(baseUrl, mode === "edit" ? "edit" : "generation")

    console.log(`[NewAPI Proxy] Target: ${targetEndpoint}`)

    const maxAttempts = 3
    const baseDelayMs = 750

    const retryFetch = async (factory: () => Promise<Response>): Promise<Response> => {
      let attempt = 0
      let lastError: Error | null = null
      let lastResponse: Response | null = null

      while (attempt < maxAttempts) {
        try {
          const result = await factory()
          lastResponse = result
          
          // 对于 5xx 错误（包括 524 超时），都触发重试
          if (result.status >= 500) {
            throw new Error(`Server returned ${result.status}`)
          }
          return result
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          attempt += 1
          if (attempt >= maxAttempts) {
            // 如果有最后的响应，返回它（即使是错误状态）
            if (lastResponse) {
              console.warn(`[NewAPI Proxy] Max retry attempts reached, returning last response with status ${lastResponse.status}`)
              return lastResponse
            }
            throw lastError
          }
          const delay = baseDelayMs * attempt
          console.warn(`[NewAPI Proxy] Attempt ${attempt} failed (${lastError.message}), retrying in ${delay}ms`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }

      throw lastError ?? new Error("Unknown proxy error")
    }

    let response: Response

    // For generation mode without images, use JSON body
    if (mode === "generation") {
      const requestBody: Record<string, any> = {}
      formData.forEach((value, key) => {
        requestBody[key] = value
      })
      
      console.log(`[NewAPI Proxy] Generation request body:`, Object.keys(requestBody))
      
      const model = (requestBody.model || "").toString()
      const modelLower = model.toLowerCase()
      const isGemini = modelLower.startsWith("gemini")

      const mapAspectRatio = (size?: string) => {
        if (!size) return "1:1"
        const match = size.match(/(\d+)\s*x\s*(\d+)/i)
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

      const mapResolution = (size?: string) => {
        if (!size) return "1K"
        const match = size.match(/(\d+)\s*x\s*(\d+)/i)
        if (!match) return "1K"
        const w = Number(match[1])
        const h = Number(match[2])
        const maxSide = Math.max(w, h)
        if (maxSide >= 3800) return "4K"
        if (maxSide >= 1900) return "2K"
        return "1K"
      }

      const doFetch = async (body: Record<string, any>, url: string) => {
        // Gemini 图片生成可能需要较长时间，特别是 4K 分辨率
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 60000) // 60秒超时
        
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          })
          clearTimeout(timeoutId)
          return response
        } catch (error) {
          clearTimeout(timeoutId)
          throw error
        }
      }

      if (isGemini) {
        // Gemini 3: 使用 generateContent 接口
        const geminiEndpoint = `${baseUrl}/v1beta/models/${requestBody.model}:generateContent`
        
        // 优先使用用户选择的参数，否则从 size 推导
        const aspectRatio = requestBody.aspect_ratio || mapAspectRatio(requestBody.size)
        const imageSize = requestBody.media_resolution 
          ? (requestBody.media_resolution === "media_resolution_high" ? "4K"
            : requestBody.media_resolution === "media_resolution_medium" ? "2K"
            : "1K")
          : mapResolution(requestBody.size)
        
        const geminiBody: Record<string, any> = {
          contents: [
            {
              role: "user",
              parts: [{ text: requestBody.prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: "image/png",
            responseModalities: ["IMAGE"],
            imageConfig: {
              aspectRatio: aspectRatio,
              imageSize: imageSize,
            },
          },
        }

        // 添加 thinking_level 参数（如果提供）
        if (requestBody.thinking_level) {
          geminiBody.generationConfig.thinkingLevel = requestBody.thinking_level
        }

        console.log("[NewAPI Proxy][Gemini] Request config:", {
          endpoint: geminiEndpoint,
          aspectRatio,
          imageSize,
          thinkingLevel: requestBody.thinking_level || "default",
          promptLength: requestBody.prompt?.length,
        })
        
        console.log("[NewAPI Proxy][Gemini] Full request body:", JSON.stringify(geminiBody, null, 2))

        response = await retryFetch(() => doFetch(geminiBody, geminiEndpoint))

        console.log("[NewAPI Proxy][Gemini] Response status:", response.status)
        
        const text = await response.text()
        console.log("[NewAPI Proxy][Gemini] Response text length:", text.length, "Preview:", text.substring(0, 200))
        
        // 处理空响应（通常是 524 超时）
        if (!text || text.trim().length === 0) {
          console.error("[NewAPI Proxy][Gemini] Empty response, likely timeout")
          return NextResponse.json(
            { 
              error: response.status === 524 
                ? "Gemini API 请求超时，请稍后重试或降低图片分辨率（尝试 2K 或 1K）" 
                : "Gemini API 返回空响应",
              status: response.status 
            },
            { status: response.status === 524 ? 504 : 500 },
          )
        }
        
        let data: any
        try {
          data = JSON.parse(text)
        } catch (parseError) {
          console.error("[NewAPI Proxy][Gemini] Parse error:", parseError)
          return NextResponse.json(
            { error: "Failed to parse Gemini response", details: text.substring(0, 500) },
            { status: 500 },
          )
        }

        if (!response.ok) {
          console.error("[NewAPI Proxy][Gemini] Request failed:", JSON.stringify(data, null, 2))
          return NextResponse.json(
            { error: data.error?.message || data.message || "Gemini request failed", details: data },
            { status: response.status },
          )
        }

        console.log("[NewAPI Proxy][Gemini] Response structure:", {
          hasCandidates: !!data?.candidates,
          candidatesLength: data?.candidates?.length,
          firstCandidate: data?.candidates?.[0] ? Object.keys(data.candidates[0]) : null
        })

        const parts = data?.candidates?.[0]?.content?.parts ?? []
        const images = parts
          .map((p: any) => p?.inline_data)
          .filter(Boolean)
          .map((inline: any) => {
            const mime = inline.mime_type || "image/png"
            const base64 = inline.data
            if (!base64) return null
            return { b64_json: base64, mime }
          })
          .filter(Boolean)

        if (!images.length) {
          return NextResponse.json(
            { error: "Gemini did not return inline image data", details: data },
            { status: 502 },
          )
        }

        return NextResponse.json({ data: images })
      }

      const doFetchOpenAI = async (body: Record<string, any>) => doFetch(body, targetEndpoint)

      // 非 Gemini：保持 OpenAI 兼容，若 url 不支持则降级 b64_json
      if (model.startsWith("gpt-image-1")) {
        requestBody.response_format = "b64_json"
      }

      try {
        response = await retryFetch(() => doFetchOpenAI(requestBody))
      } catch (error) {
        // 某些服务端对 url 返回格式不兼容，自动降级到 b64_json 再试一次
        if (requestBody.response_format !== "b64_json") {
          console.warn("[NewAPI Proxy] Generation failed with url format, retrying with b64_json")
          requestBody.response_format = "b64_json"
          response = await retryFetch(() => doFetchOpenAI(requestBody))
        } else {
          throw error
        }
      }
    } else {
      // For edit mode, use FormData
      const newFormData = new FormData()
      
      // Copy all fields to new FormData
      for (const [key, value] of formData.entries()) {
        newFormData.append(key, value)
      }
      
      console.log(`[NewAPI Proxy] Edit request fields:`, Array.from(newFormData.keys()))
      
      response = await retryFetch(() =>
        fetch(targetEndpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: newFormData,
        }),
      )
    }

    console.log(`[NewAPI Proxy] Response status: ${response.status}`)

    const text = await response.text()
    console.log(`[NewAPI Proxy] Response text length: ${text.length}`)
    
    let data: any

    try {
      data = JSON.parse(text)
    } catch (error) {
      console.error(`[NewAPI Proxy] Failed to parse response:`, text.substring(0, 200))
      return NextResponse.json(
        { error: "Failed to parse NewAPI response", details: text.substring(0, 500) },
        { status: 500 }
      )
    }

    if (!response.ok) {
      console.error(`[NewAPI Proxy] Request failed:`, data)
      return NextResponse.json(
        { error: data.error?.message || data.message || "NewAPI request failed", details: data },
        { status: response.status }
      )
    }

    console.log(`[NewAPI Proxy] Success, returning ${data.data?.length || 0} images`)
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`[NewAPI Proxy] Exception:`, error)
    return NextResponse.json(
      { error: message, stack: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    )
  }
}
