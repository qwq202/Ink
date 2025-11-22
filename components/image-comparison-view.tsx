"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { X, ChevronLeft, ChevronRight, Maximize2, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GenerationResult } from "@/lib/api-client"

interface ImageComparisonViewProps {
  items: GenerationResult[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownload?: (url: string) => void
}

export function ImageComparisonView({ items, open, onOpenChange, onDownload }: ImageComparisonViewProps) {
  const [layout, setLayout] = useState<"side-by-side" | "top-bottom">("side-by-side")
  const [dividerPosition, setDividerPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback(() => {
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      let position: number

      if (layout === "side-by-side") {
        position = ((e.clientX - rect.left) / rect.width) * 100
      } else {
        position = ((e.clientY - rect.top) / rect.height) * 100
      }

      position = Math.max(10, Math.min(90, position))
      setDividerPosition(position)
    },
    [isDragging, layout],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
      return () => {
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  if (items.length === 0) return null

  const item1 = items[0]
  const item2 = items[1] || item1
  const image1 = item1.images[0] || "/placeholder.svg"
  const image2 = item2.images[0] || "/placeholder.svg"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
        <DialogTitle className="sr-only">图片对比</DialogTitle>
        <DialogDescription className="sr-only">对比两张图片的差异</DialogDescription>

        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLayout(layout === "side-by-side" ? "top-bottom" : "side-by-side")}
            >
              {layout === "side-by-side" ? "切换为上下对比" : "切换为左右对比"}
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div
          ref={containerRef}
          className={cn(
            "relative flex-1 overflow-hidden",
            layout === "side-by-side" ? "flex" : "flex-col",
          )}
        >
          {/* Image 1 */}
          <div
            className={cn(
              "relative bg-gray-100 flex items-center justify-center overflow-hidden",
              layout === "side-by-side" ? "h-full" : "w-full",
            )}
            style={
              layout === "side-by-side"
                ? { width: `${dividerPosition}%` }
                : { height: `${dividerPosition}%` }
            }
          >
            <Image
              src={image1}
              alt="对比图片 1"
              fill
              className="object-contain"
              unoptimized
            />
            <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 text-xs font-mono">
              {item1.params.prompt.substring(0, 30)}...
            </div>
            {onDownload && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute bottom-2 right-2"
                onClick={() => onDownload(image1)}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Divider */}
          <div
            className={cn(
              "bg-gray-300 cursor-col-resize hover:bg-gray-400 transition-colors relative z-10 flex items-center justify-center",
              layout === "side-by-side" ? "w-1 h-full cursor-col-resize" : "h-1 w-full cursor-row-resize",
            )}
            onMouseDown={handleMouseDown}
          >
            <div className="absolute inset-0" />
            <div className="bg-white rounded-full p-1 shadow-lg">
              <div className={cn("w-1 h-4 bg-gray-600", layout === "top-bottom" && "rotate-90")} />
            </div>
          </div>

          {/* Image 2 */}
          <div
            className={cn(
              "relative bg-gray-100 flex items-center justify-center overflow-hidden",
              layout === "side-by-side" ? "h-full" : "w-full",
            )}
            style={
              layout === "side-by-side"
                ? { width: `${100 - dividerPosition}%` }
                : { height: `${100 - dividerPosition}%` }
            }
          >
            <Image
              src={image2}
              alt="对比图片 2"
              fill
              className="object-contain"
              unoptimized
            />
            <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 text-xs font-mono">
              {item2.params.prompt.substring(0, 30)}...
            </div>
            {onDownload && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute bottom-2 right-2"
                onClick={() => onDownload(image2)}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Parameters comparison */}
        <div className="p-4 border-t grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-semibold mb-1">图片 1 参数</p>
            <p className="text-gray-600">模型: {item1.params.modelId || "—"}</p>
            <p className="text-gray-600">尺寸: {item1.params.imageSize}</p>
            {item1.params.seed && <p className="text-gray-600">Seed: {item1.params.seed}</p>}
          </div>
          <div>
            <p className="font-semibold mb-1">图片 2 参数</p>
            <p className="text-gray-600">模型: {item2.params.modelId || "—"}</p>
            <p className="text-gray-600">尺寸: {item2.params.imageSize}</p>
            {item2.params.seed && <p className="text-gray-600">Seed: {item2.params.seed}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

