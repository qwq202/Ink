type LogLevel = "info" | "warn" | "error"

interface LogPayload {
  level?: LogLevel
  message: string
  details?: Record<string, unknown>
}

const isBrowser = typeof window !== "undefined"

export async function logDebug(payload: LogPayload): Promise<void> {
  const level = payload.level ?? "info"
  const timestamp = new Date().toISOString()

  if (!isBrowser) {
    const logger =
      level === "error" ? console.error : level === "warn" ? console.warn : console.info
    if (payload.details) {
      logger(`[${timestamp}] ${payload.message}`, payload.details)
    } else {
      logger(`[${timestamp}] ${payload.message}`)
    }
    return
  }

  try {
    await fetch("/api/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        level,
        timestamp,
      }),
    })
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Failed to send log payload", error)
    }
  }
}
