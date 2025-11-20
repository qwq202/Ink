import { NextResponse } from "next/server"

type LogLevel = "info" | "warn" | "error"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body || typeof body.message !== "string") {
      return NextResponse.json({ success: false, error: "Invalid log payload" }, { status: 400 })
    }

    const level: LogLevel = ["info", "warn", "error"].includes(body.level) ? body.level : "info"
    const timestamp = body.timestamp || new Date().toISOString()
    const logger = level === "error" ? console.error : level === "warn" ? console.warn : console.info

    if (body.details) {
      logger(`[${timestamp}] ${body.message}`, body.details)
    } else {
      logger(`[${timestamp}] ${body.message}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to process log payload", error)
    return NextResponse.json({ success: false, error: "Unable to process log payload" }, { status: 500 })
  }
}
