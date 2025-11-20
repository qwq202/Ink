import { NextRequest, NextResponse } from "next/server"

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
    let baseUrl = endpoint.trim().replace(/\/+$/, "")
    if (baseUrl.includes("/v1/images")) {
      const match = baseUrl.match(/^(https?:\/\/[^/]+)/)
      baseUrl = match ? match[1] : baseUrl
    }

    const targetEndpoint = mode === "edit" 
      ? `${baseUrl}/v1/images/edits`
      : `${baseUrl}/v1/images/generations`

    console.log(`[NewAPI Proxy] Target: ${targetEndpoint}`)

    const maxAttempts = 3
    const baseDelayMs = 750

    const retryFetch = async (factory: () => Promise<Response>): Promise<Response> => {
      let attempt = 0
      let lastError: Error | null = null

      while (attempt < maxAttempts) {
        try {
          const result = await factory()
          if (result.status >= 500 && result.status !== 524) {
            throw new Error(`Server returned ${result.status}`)
          }
          return result
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          attempt += 1
          if (attempt >= maxAttempts) {
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
      
      response = await retryFetch(() =>
        fetch(targetEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        }),
      )
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
