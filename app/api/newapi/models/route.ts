import { NextRequest, NextResponse } from "next/server"
import { fetchNewApiModels } from "@/lib/api-client"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get("endpoint")
    const apiKey = searchParams.get("apiKey")

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
