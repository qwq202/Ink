import { createFalClient, type RequestMiddleware } from "@fal-ai/client"

function createAuthMiddleware(apiKey: string): RequestMiddleware {
  const authorization = apiKey.startsWith("Key ") ? apiKey : `Key ${apiKey.replace(/^Key\s+/i, "")}`

  return async (request) => ({
    ...request,
    headers: {
      ...request.headers,
      authorization,
    },
  })
}

export function createBrowserFalClient(apiKey: string) {
  return createFalClient({
    proxyUrl: "/api/fal/proxy",
    requestMiddleware: createAuthMiddleware(apiKey),
  })
}
