"use client"

import { useState, useCallback } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { RotateCw, Check, X } from "lucide-react"
import Cropper from "react-easy-crop"
import type { Area, Point } from "react-easy-crop"

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener("load", () => resolve(image))
    image.addEventListener("error", (error) => reject(error))
    image.src = url
  })

const getRadianAngle = (degreeValue: number) => {
  return (degreeValue * Math.PI) / 180
}

const rotateSize = (width: number, height: number, rotation: number) => {
  const rotRad = getRadianAngle(rotation)
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
  flip = { horizontal: false, vertical: false },
): Promise<string> => {
  const image = await createImage(imageSrc)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("No 2d context")
  }

  const rotRad = getRadianAngle(rotation)

  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation)

  canvas.width = bBoxWidth
  canvas.height = bBoxHeight

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(rotRad)
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
  ctx.translate(-image.width / 2, -image.height / 2)

  ctx.drawImage(image, 0, 0)

  const data = ctx.getImageData(pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height)

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.putImageData(data, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas is empty"))
        return
      }
      const url = URL.createObjectURL(blob)
      resolve(url)
    }, "image/png")
  })
}

interface ImageEditorDialogProps {
  imageSrc: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: (editedImageUrl: string) => void
}

export function ImageEditorDialog({ imageSrc, open, onOpenChange, onSave }: ImageEditorDialogProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [mode, setMode] = useState<"crop" | "rotate">("crop")

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels) {
      return
    }

    try {
      const croppedImageUrl = await getCroppedImg(imageSrc, croppedAreaPixels, rotation)
      onSave?.(croppedImageUrl)
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to crop image:", error)
    }
  }, [imageSrc, croppedAreaPixels, rotation, onSave, onOpenChange])

  const handleRotate = (degrees: number) => {
    setRotation((prev) => (prev + degrees) % 360)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden" showCloseButton={false}>
        <DialogTitle className="sr-only">图片编辑</DialogTitle>
        <DialogDescription className="sr-only">裁剪和旋转图片</DialogDescription>

        <div className="flex flex-col h-[80vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Button
                variant={mode === "crop" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("crop")}
              >
                裁剪
              </Button>
              <Button
                variant={mode === "rotate" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("rotate")}
              >
                旋转
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Check className="mr-2 h-4 w-4" />
                保存
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 relative bg-gray-900">
            {mode === "crop" ? (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={onCropComplete}
                style={{
                  containerStyle: {
                    width: "100%",
                    height: "100%",
                    position: "relative",
                  },
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="relative max-w-full max-h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageSrc}
                    alt="编辑中"
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      maxWidth: "100%",
                      maxHeight: "100%",
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-4 border-t space-y-4">
            {mode === "crop" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">缩放</label>
                <Slider
                  value={[zoom]}
                  min={1}
                  max={3}
                  step={0.1}
                  onValueChange={(value) => setZoom(value[0])}
                />
              </div>
            )}
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRotate(-90)}
                className="gap-2"
              >
                <RotateCw className="h-4 w-4 rotate-180" />
                逆时针 90°
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRotate(90)}
                className="gap-2"
              >
                <RotateCw className="h-4 w-4" />
                顺时针 90°
              </Button>
              <div className="flex-1" />
              <span className="text-sm text-gray-600">旋转角度: {rotation}°</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
