import { NextRequest, NextResponse } from "next/server"
import { fetchNewApiModels } from "@/domains/generation/lib/api-client"

async function readRequestConfig(request: NextRequest) {
  const body = (await request.json()) as { endpoint?: string; apiKey?: string }
  return {
    endpoint: typeof body.endpoint === "string" ? body.endpoint : null,
    apiKey: typeof body.apiKey === "string" ? body.apiKey : null,
  }
}

async function handleRequest(request: NextRequest) {
  try {
    const { endpoint, apiKey } = await readRequestConfig(request)

    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: "Missing endpoint parameter" },
        { status: 400 }
      )
    }

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Missing apiKey parameter" },
        { status: 400 }
      )
    }

    const result = await fetchNewApiModels({
      id: "newapi",
      name: "NewAPI Images",
      apiKey,
      endpoint,
      enabled: true,
    })

    return NextResponse.json({
      ...result,
      cachedAt: Date.now(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method not allowed. Use POST." },
    { status: 405 },
  )
}

export async function POST(request: NextRequest) {
  return handleRequest(request)
}
