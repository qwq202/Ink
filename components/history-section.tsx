"use client"

import type React from "react"

import { useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock, Trash2, Eye, Box, Download, Maximize2 } from "lucide-react"
import type { GenerationResult } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { parseImageSize } from "@/lib/image-utils"

interface HistorySectionProps {
  history?: GenerationResult[]
  onHistoryChange?: () => void
  onClearHistory?: () => Promise<void> | void
  onDeleteHistory?: (id: string) => Promise<void> | void
}

export function HistorySection({ history = [], onHistoryChange, onClearHistory, onDeleteHistory }: HistorySectionProps) {
  const [selectedResult, setSelectedResult] = useState<GenerationResult | null>(null)
  const [selectedImage, setSelectedImage] = useState<{ src: string; width: number; height: number } | null>(null)
  const { toast } = useToast()

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `generated-image-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
      toast({
        title: "下载成功",
        description: "图片已开始下载",
      })
    } catch (error) {
      console.error("Download failed:", error)
      toast({
        title: "下载失败",
        description: "无法下载图片",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      if (onDeleteHistory) {
        await onDeleteHistory(id)
      }
      onHistoryChange?.()
      toast({
        title: "删除成功",
        description: "历史记录已删除",
      })
    } catch (error) {
      toast({
        title: "删除失败",
        description: "无法删除历史记录",
        variant: "destructive",
      })
    }
  }

  const handleClearAll = async () => {
    try {
      if (onClearHistory) {
        await onClearHistory()
      }
      setSelectedResult(null)
      onHistoryChange?.()
      toast({
        title: "清空成功",
        description: "所有历史记录已清空",
      })
    } catch (error) {
      toast({
        title: "清空失败",
        description: "无法清空历史记录",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>历史记录</CardTitle>
              <CardDescription>最近 20 条生成记录 ({history.length})</CardDescription>
            </div>
            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearAll}>
                清空
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
              <div className="flex flex-col items-center gap-2 text-center">
                <Clock className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">暂无历史记录</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="group flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
                    onClick={() => setSelectedResult(item)}
                  >
                    <div 
                      className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded border border-border group/image cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (item.images[0]) {
                          const { width, height } = parseImageSize(item.params.imageSize)
                          setSelectedImage({ src: item.images[0], width, height })
                        }
                      }}
                    >
                      {item.images[0] ? (
                        <>
                          <Image
                            src={item.images[0] || "/placeholder.svg"}
                            alt="预览"
                            fill
                            sizes="48px"
                            className="object-cover transition-transform group-hover/image:scale-110"
                            unoptimized
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center gap-1">
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation()
                                const { width, height } = parseImageSize(item.params.imageSize)
                                setSelectedImage({ src: item.images[0], width, height })
                              }}
                            >
                              <Maximize2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDownload(item.images[0])
                              }}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.params.prompt}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{item.provider}</span>
                        <span>•</span>
                        <span>{new Date(item.timestamp).toLocaleString("zh-CN")}</span>
                        {item.params.modelId ? (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <Box className="h-3.5 w-3.5" />
                              {item.params.modelId}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleDelete(item.id, e)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedResult} onOpenChange={() => setSelectedResult(null)}>
        <DialogContent className="max-w-4xl">
          <DialogTitle className="sr-only">生成记录详情</DialogTitle>
          <DialogDescription className="sr-only">查看选中历史记录的完整信息和图片</DialogDescription>
          {selectedResult && (() => {
            const { width, height } = parseImageSize(selectedResult.params.imageSize)
            return (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">提示词</h3>
                  <p className="text-sm text-muted-foreground">{selectedResult.params.prompt}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {selectedResult.images.map((image, index) => (
                    <div key={index} className="relative group/image-detail">
                      <Image
                        src={image || "/placeholder.svg"}
                        alt={`生成的图片 ${index + 1}`}
                        className="h-auto w-full rounded-lg cursor-pointer transition-transform group-hover/image-detail:scale-105"
                        width={width}
                        height={height}
                        unoptimized
                        onClick={() => {
                          setSelectedImage({ src: image, width, height })
                        }}
                      />
                      <div className="absolute top-2 right-2 opacity-0 group-hover/image-detail:opacity-100 transition-opacity flex gap-2">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedImage({ src: image, width, height })
                          }}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownload(image)
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0">
          <DialogTitle className="sr-only">图片预览</DialogTitle>
          <DialogDescription className="sr-only">查看图片大图</DialogDescription>
          {selectedImage && (
            <div className="relative">
              <Image
                src={selectedImage.src || "/placeholder.svg"}
                alt="预览"
                width={selectedImage.width}
                height={selectedImage.height}
                className="h-auto w-full rounded-lg"
                unoptimized
              />
              <Button
                variant="secondary"
                size="icon"
                className="absolute bottom-4 right-4 rounded-full shadow-lg"
                onClick={() => handleDownload(selectedImage.src)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
