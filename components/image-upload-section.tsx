"use client"

import type React from "react"

import { useState } from "react"
import Image from "next/image"

import { useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, X, GripVertical } from "lucide-react"
import { useImageUpload } from "@/hooks/use-image-upload"
import { cn } from "@/lib/utils"

interface ImageUploadSectionProps {
  upload?: ReturnType<typeof useImageUpload>
  maxImages?: number
}

export function ImageUploadSection({ upload, maxImages = 100 }: ImageUploadSectionProps = {}) {
  const internalUpload = useImageUpload(maxImages)
  const { images, isUploading, addImages, removeImage, clearImages } = upload ?? internalUpload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      dragCounter.current = 0

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        addImages(files)
      }
    },
    [addImages],
  )

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length > 0) {
        addImages(files)
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [addImages],
  )

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>上传图片</CardTitle>
            <CardDescription>已上传 {images.length} 张图片</CardDescription>
          </div>
          {images.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearImages}>
              清空
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDrop={handleDrop}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onClick={handleClick}
          className={cn(
            "flex min-h-[200px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-colors",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40",
            isUploading && "pointer-events-none opacity-50",
          )}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{isUploading ? "处理中..." : "拖拽图片到此处或点击上传"}</p>
            <p className="text-xs text-muted-foreground">支持 PNG, JPG, WEBP 格式</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {images.map((image, index) => (
              <div
                key={image.id}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
              >
                <Image
                  src={image.preview || "/placeholder.svg"}
                  alt={`上传的图片 ${index + 1}`}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex h-full items-center justify-center gap-2">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeImage(image.id)
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-xs text-white">
                  <GripVertical className="h-3 w-3" />
                  {index + 1}
                </div>
                <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
                  {image.width} × {image.height}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
