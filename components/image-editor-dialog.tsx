"use client"

import { useState, useCallback } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  cropShape: CropShapeType = "rect",
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

  // 如果需要应用特殊形状遮罩
  if (cropShape !== "rect") {
    const shapedCanvas = document.createElement("canvas")
    const shapedCtx = shapedCanvas.getContext("2d")
    
    if (!shapedCtx) {
      throw new Error("No 2d context")
    }

    shapedCanvas.width = pixelCrop.width
    shapedCanvas.height = pixelCrop.height

    const centerX = pixelCrop.width / 2
    const centerY = pixelCrop.height / 2
    const width = pixelCrop.width
    const height = pixelCrop.height

    shapedCtx.beginPath()

    switch (cropShape) {
      case "round":
        // 椭圆形
        shapedCtx.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, 2 * Math.PI)
        break

      case "star":
        // 五角星
        const spikes = 5
        const outerRadius = Math.min(width, height) / 2
        const innerRadius = outerRadius * 0.5
        let rot = (Math.PI / 2) * 3
        let x = centerX
        let y = centerY
        const step = Math.PI / spikes

        shapedCtx.moveTo(centerX, centerY - outerRadius)
        for (let i = 0; i < spikes; i++) {
          x = centerX + Math.cos(rot) * outerRadius
          y = centerY + Math.sin(rot) * outerRadius
          shapedCtx.lineTo(x, y)
          rot += step

          x = centerX + Math.cos(rot) * innerRadius
          y = centerY + Math.sin(rot) * innerRadius
          shapedCtx.lineTo(x, y)
          rot += step
        }
        shapedCtx.lineTo(centerX, centerY - outerRadius)
        break

      case "heart":
        // 心形
        const topCurveHeight = height * 0.3
        shapedCtx.moveTo(centerX, centerY + height * 0.3)
        shapedCtx.bezierCurveTo(
          centerX, centerY - height * 0.1,
          centerX - width * 0.5, centerY - height * 0.1,
          centerX - width * 0.5, centerY + height * 0.05
        )
        shapedCtx.bezierCurveTo(
          centerX - width * 0.5, centerY + height * 0.3,
          centerX, centerY + height * 0.5,
          centerX, centerY + height * 0.5
        )
        shapedCtx.bezierCurveTo(
          centerX, centerY + height * 0.5,
          centerX + width * 0.5, centerY + height * 0.3,
          centerX + width * 0.5, centerY + height * 0.05
        )
        shapedCtx.bezierCurveTo(
          centerX + width * 0.5, centerY - height * 0.1,
          centerX, centerY - height * 0.1,
          centerX, centerY + height * 0.3
        )
        break

      case "hexagon":
        // 六边形
        const hexRadius = Math.min(width, height) / 2
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i
          const px = centerX + hexRadius * Math.cos(angle)
          const py = centerY + hexRadius * Math.sin(angle)
          if (i === 0) shapedCtx.moveTo(px, py)
          else shapedCtx.lineTo(px, py)
        }
        shapedCtx.closePath()
        break

      case "triangle":
        // 三角形
        shapedCtx.moveTo(centerX, centerY - height / 2)
        shapedCtx.lineTo(centerX - width / 2, centerY + height / 2)
        shapedCtx.lineTo(centerX + width / 2, centerY + height / 2)
        shapedCtx.closePath()
        break

      case "diamond":
        // 菱形
        shapedCtx.moveTo(centerX, centerY - height / 2)
        shapedCtx.lineTo(centerX + width / 2, centerY)
        shapedCtx.lineTo(centerX, centerY + height / 2)
        shapedCtx.lineTo(centerX - width / 2, centerY)
        shapedCtx.closePath()
        break
    }

    shapedCtx.closePath()
    shapedCtx.clip()

    // 在裁剪区域内绘制图片
    shapedCtx.drawImage(canvas, 0, 0)

    // 使用特殊形状裁剪的 canvas
    return new Promise((resolve, reject) => {
      shapedCanvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"))
          return
        }
        const url = URL.createObjectURL(blob)
        resolve(url)
      }, "image/png")
    })
  }

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

type CropShapeType = "rect" | "round" | "star" | "heart" | "hexagon" | "triangle" | "diamond"

export function ImageEditorDialog({ imageSrc, open, onOpenChange, onSave }: ImageEditorDialogProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [mode, setMode] = useState<"crop" | "rotate">("crop")
  const [aspectRatio, setAspectRatio] = useState<number | undefined>(undefined)
  const [cropShape, setCropShape] = useState<CropShapeType>("rect")
  
  // react-easy-crop 只支持 rect 和 round，其他形状在保存时应用
  const displayCropShape = cropShape === "round" ? "round" : "rect"

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels) {
      return
    }

    try {
      const croppedImageUrl = await getCroppedImg(imageSrc, croppedAreaPixels, rotation, { horizontal: false, vertical: false }, cropShape)
      onSave?.(croppedImageUrl)
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to crop image:", error)
    }
  }, [imageSrc, croppedAreaPixels, rotation, cropShape, onSave, onOpenChange])

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
              <div className="relative w-full h-full">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={aspectRatio}
                  cropShape={displayCropShape}
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
                    cropAreaStyle: {
                      border: cropShape === "rect" || cropShape === "round" ? undefined : "none",
                    },
                  }}
                />
                {/* 自定义形状预览覆盖层 */}
                {cropShape !== "rect" && cropShape !== "round" && croppedAreaPixels && (
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      width: "100%",
                      height: "100%",
                    }}
                  >
                    <defs>
                      <mask id="crop-mask">
                        <rect width="100%" height="100%" fill="white" />
                        {(() => {
                          const containerWidth = croppedAreaPixels.width
                          const containerHeight = croppedAreaPixels.height
                          const centerX = croppedAreaPixels.x + containerWidth / 2
                          const centerY = croppedAreaPixels.y + containerHeight / 2

                          switch (cropShape) {
                            case "star":
                              const points: string[] = []
                              const spikes = 5
                              const outerRadius = Math.min(containerWidth, containerHeight) / 2
                              const innerRadius = outerRadius * 0.5
                              let rot = (Math.PI / 2) * 3
                              const step = Math.PI / spikes
                              
                              for (let i = 0; i < spikes; i++) {
                                let x = centerX + Math.cos(rot) * outerRadius
                                let y = centerY + Math.sin(rot) * outerRadius
                                points.push(`${x},${y}`)
                                rot += step
                                x = centerX + Math.cos(rot) * innerRadius
                                y = centerY + Math.sin(rot) * innerRadius
                                points.push(`${x},${y}`)
                                rot += step
                              }
                              return <polygon points={points.join(" ")} fill="black" />

                            case "heart":
                              const heartPath = `
                                M ${centerX} ${centerY + containerHeight * 0.3}
                                C ${centerX} ${centerY - containerHeight * 0.1},
                                  ${centerX - containerWidth * 0.5} ${centerY - containerHeight * 0.1},
                                  ${centerX - containerWidth * 0.5} ${centerY + containerHeight * 0.05}
                                C ${centerX - containerWidth * 0.5} ${centerY + containerHeight * 0.3},
                                  ${centerX} ${centerY + containerHeight * 0.5},
                                  ${centerX} ${centerY + containerHeight * 0.5}
                                C ${centerX} ${centerY + containerHeight * 0.5},
                                  ${centerX + containerWidth * 0.5} ${centerY + containerHeight * 0.3},
                                  ${centerX + containerWidth * 0.5} ${centerY + containerHeight * 0.05}
                                C ${centerX + containerWidth * 0.5} ${centerY - containerHeight * 0.1},
                                  ${centerX} ${centerY - containerHeight * 0.1},
                                  ${centerX} ${centerY + containerHeight * 0.3}
                                Z
                              `
                              return <path d={heartPath} fill="black" />

                            case "hexagon":
                              const hexPoints: string[] = []
                              const hexRadius = Math.min(containerWidth, containerHeight) / 2
                              for (let i = 0; i < 6; i++) {
                                const angle = (Math.PI / 3) * i
                                const x = centerX + hexRadius * Math.cos(angle)
                                const y = centerY + hexRadius * Math.sin(angle)
                                hexPoints.push(`${x},${y}`)
                              }
                              return <polygon points={hexPoints.join(" ")} fill="black" />

                            case "triangle":
                              return (
                                <polygon
                                  points={`
                                    ${centerX},${centerY - containerHeight / 2}
                                    ${centerX - containerWidth / 2},${centerY + containerHeight / 2}
                                    ${centerX + containerWidth / 2},${centerY + containerHeight / 2}
                                  `}
                                  fill="black"
                                />
                              )

                            case "diamond":
                              return (
                                <polygon
                                  points={`
                                    ${centerX},${centerY - containerHeight / 2}
                                    ${centerX + containerWidth / 2},${centerY}
                                    ${centerX},${centerY + containerHeight / 2}
                                    ${centerX - containerWidth / 2},${centerY}
                                  `}
                                  fill="black"
                                />
                              )
                          }
                        })()}
                      </mask>
                    </defs>
                    <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#crop-mask)" />
                  </svg>
                )}
              </div>
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
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">裁剪比例</label>
                    <Select
                      value={aspectRatio?.toString() || "free"}
                      onValueChange={(value) => {
                        if (value === "free") {
                          setAspectRatio(undefined)
                        } else {
                          setAspectRatio(Number.parseFloat(value))
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择比例" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">自由裁剪</SelectItem>
                        <SelectItem value="1">正方形 (1:1)</SelectItem>
                        <SelectItem value="1.3333">横向 (4:3)</SelectItem>
                        <SelectItem value="0.75">纵向 (3:4)</SelectItem>
                        <SelectItem value="1.7778">宽屏 (16:9)</SelectItem>
                        <SelectItem value="0.5625">竖屏 (9:16)</SelectItem>
                        <SelectItem value="2.3333">超宽 (21:9)</SelectItem>
                        <SelectItem value="1.5">照片 (3:2)</SelectItem>
                        <SelectItem value="0.6667">照片 (2:3)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">裁剪形状</label>
                    <Select
                      value={cropShape}
                      onValueChange={(value: CropShapeType) => setCropShape(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择形状" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rect">矩形</SelectItem>
                        <SelectItem value="round">圆形/椭圆</SelectItem>
                        <SelectItem value="star">⭐ 五角星</SelectItem>
                        <SelectItem value="heart">❤️ 心形</SelectItem>
                        <SelectItem value="hexagon">⬡ 六边形</SelectItem>
                        <SelectItem value="triangle">▲ 三角形</SelectItem>
                        <SelectItem value="diamond">◆ 菱形</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
              </>
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
