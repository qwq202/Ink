export function normalizeNewApiBaseUrl(endpoint: string): string {
  let baseUrl = endpoint.trim().replace(/\/+$/, "")

  const removableSuffixes = [
    /\/v1\/images\/generations$/i,
    /\/v1\/images\/edits$/i,
    /\/v1\/images$/i,
    /\/v1\/models$/i,
    /\/v1$/i,
  ]

  for (const suffix of removableSuffixes) {
    baseUrl = baseUrl.replace(suffix, "")
  }

  return baseUrl.replace(/\/+$/, "")
}

export function getNewApiModelsUrl(endpoint: string): string {
  return `${normalizeNewApiBaseUrl(endpoint)}/v1/models`
}

export function getNewApiImagesUrl(endpoint: string, mode: "generation" | "edit"): string {
  const route = mode === "edit" ? "edits" : "generations"
  return `${normalizeNewApiBaseUrl(endpoint)}/v1/images/${route}`
}

