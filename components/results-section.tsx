"use client"

import { useState, useCallback, useRef, useMemo } from "react"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ImageIcon, Download, Maximize2, X } from "lucide-react"
import type { GenerationResult } from "@/lib/api-client"
import { parseImageSize } from "@/lib/image-utils"
import { cn } from "@/lib/utils"

interface ResultsSectionProps {
  results?: GenerationResult[]
}

export function ResultsSection({ results = [] }: ResultsSectionProps) {
  const [selectedImage, setSelectedImage] = useState<{ src: string; width: number; height: number } | null>(null)
  const [downloadBatchId] = useState(() => Date.now())
  const downloadCounterRef = useRef(0)

  const latestResult = results[0]

  // 根据图片数量自适应网格列数
  const gridColsClass = useMemo(() => {
    if (!latestResult) return "grid-cols-2"
    const imageCount = latestResult.images.length
    if (imageCount === 1) return "grid-cols-1"
    if (imageCount === 2) return "grid-cols-2"
    if (imageCount === 3) return "grid-cols-2 md:grid-cols-3"
    if (imageCount === 4) return "grid-cols-2 md:grid-cols-2"
    if (imageCount <= 6) return "grid-cols-2 md:grid-cols-3"
    if (imageCount <= 9) return "grid-cols-2 md:grid-cols-3 lg:grid-cols-3"
    return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
  }, [latestResult])

  const handleDownload = useCallback(async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      downloadCounterRef.current += 1
      a.download = `generated-image-${downloadBatchId}-${downloadCounterRef.current}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error("Download failed:", error)
    }
  }, [downloadBatchId])

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>生成结果</CardTitle>
          <CardDescription>{latestResult ? `使用 ${latestResult.provider} 生成` : "查看生成的图片"}</CardDescription>
        </CardHeader>
        <CardContent>
          {!latestResult || latestResult.images.length === 0 ? (
            <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
              <div className="flex flex-col items-center gap-2 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">生成的图片将显示在这里</p>
              </div>
            </div>
          ) : (
            <div className={cn("grid gap-4", gridColsClass)}>
              {latestResult.images.map((image, index) => {
                const { width, height } = parseImageSize(latestResult.params.imageSize)
                return (
                  <div
                    key={index}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border"
                  >
                    <Image
                      src={image || "/placeholder.svg"}
                      alt={`生成的图片 ${index + 1}`}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex h-full items-center justify-center gap-2">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setSelectedImage({ src: image, width, height })}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownload(image)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl overflow-hidden p-0" showCloseButton={false}>
          <DialogTitle className="sr-only">生成图片预览</DialogTitle>
          <DialogDescription className="sr-only">查看最新生成图片的大图内容</DialogDescription>
          {selectedImage && (
            <div className="relative">
              <Image
                src={selectedImage.src || "/placeholder.svg"}
                alt="预览"
                className="h-auto w-full"
                width={selectedImage.width}
                height={selectedImage.height}
                unoptimized
              />
              <div className="absolute right-4 top-4 flex gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full shadow-lg"
                  onClick={() => setSelectedImage(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full shadow-lg"
                  onClick={() => handleDownload(selectedImage.src)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
