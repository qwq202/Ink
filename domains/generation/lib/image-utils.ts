export const FAL_IMAGE_SIZE_PRESETS: Record<string, { width: number; height: number }> = {
  square: { width: 1024, height: 1024 },
  landscape_4_3: { width: 1024, height: 768 },
  landscape_16_9: { width: 1280, height: 720 },
  portrait_4_3: { width: 768, height: 1024 },
  portrait_16_9: { width: 720, height: 1280 },
}

export const FAL_IMAGE_SIZE_ENUMS = new Set(Object.keys(FAL_IMAGE_SIZE_PRESETS))
const DEFAULT_IMAGE_SIZE = FAL_IMAGE_SIZE_PRESETS.square

export function parseImageSize(size?: string | null): { width: number; height: number } {
  if (!size) {
    return DEFAULT_IMAGE_SIZE
  }

  const preset = FAL_IMAGE_SIZE_PRESETS[size]
  if (preset) {
    return preset
  }

  const match = size.match(/(\d+)\s*x\s*(\d+)/i)
  if (!match) {
    return DEFAULT_IMAGE_SIZE
  }

  const width = Number.parseInt(match[1], 10)
  const height = Number.parseInt(match[2], 10)

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return DEFAULT_IMAGE_SIZE
  }

  return { width, height }
}

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"])
const MAX_IMAGE_SIZE_MB = 10
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

export interface UploadedImage {
  id: string
  file: File
  preview: string
  name: string
  size: number
  type: string
  width?: number
  height?: number
}

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "仅支持 PNG、JPG、WEBP 格式的图片"
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `图片 ${file.name} 大小不能超过 ${MAX_IMAGE_SIZE_MB}MB`
  }

  return null
}

export async function processImageFile(file: File): Promise<UploadedImage> {
  const preview = URL.createObjectURL(file)
  let width: number | undefined
  let height: number | undefined

  try {
    const dims = await getImageDimensions(preview)
    width = dims.width
    height = dims.height
  } catch (error) {
    console.warn("Failed to read image dimensions", error)
  }

  return {
    id: generateImageId(),
    file,
    preview,
    name: file.name,
    size: file.size,
    type: file.type,
    width,
    height,
  }
}

function generateImageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      })
    }
    image.onerror = reject
    image.src = url
  })
}
