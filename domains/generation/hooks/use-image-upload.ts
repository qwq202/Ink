"use client"

import { useState, useCallback } from "react"
import { processImageFile, validateImageFile, type UploadedImage } from "@/domains/generation/lib/image-utils"
import { useToast } from "@/hooks/use-toast"

export function useImageUpload(maxImages = 4) {
  const [images, setImages] = useState<UploadedImage[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()

  const addImages = useCallback(
    async (files: File[]) => {
      if (images.length >= maxImages) {
        toast({
          title: "上传失败",
          description: `最多只能上传 ${maxImages} 张图片`,
          variant: "destructive",
        })
        return
      }

      const remainingSlots = maxImages - images.length
      const filesToProcess = files.slice(0, remainingSlots)

      setIsUploading(true)

      try {
        const processedImages: UploadedImage[] = []

        for (const file of filesToProcess) {
          const error = validateImageFile(file)
          if (error) {
            toast({
              title: "文件验证失败",
              description: error,
              variant: "destructive",
            })
            continue
          }

          try {
            const processed = await processImageFile(file)
            processedImages.push(processed)
          } catch (err) {
            toast({
              title: "图片处理失败",
              description: `无法处理 ${file.name}`,
              variant: "destructive",
            })
          }
        }

        if (processedImages.length > 0) {
          setImages((prev) => [...prev, ...processedImages])
          toast({
            title: "上传成功",
            description: `成功上传 ${processedImages.length} 张图片`,
          })
        }
      } finally {
        setIsUploading(false)
      }
    },
    [images.length, maxImages, toast],
  )

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id)
      if (image) {
        URL.revokeObjectURL(image.preview)
      }
      return prev.filter((img) => img.id !== id)
    })
  }, [])

  const reorderImages = useCallback((startIndex: number, endIndex: number) => {
    setImages((prev) => {
      const result = Array.from(prev)
      const [removed] = result.splice(startIndex, 1)
      result.splice(endIndex, 0, removed)
      return result
    })
  }, [])

  const clearImages = useCallback(() => {
    images.forEach((img) => URL.revokeObjectURL(img.preview))
    setImages([])
  }, [images])

  return {
    images,
    isUploading,
    addImages,
    removeImage,
    reorderImages,
    clearImages,
  }
}
