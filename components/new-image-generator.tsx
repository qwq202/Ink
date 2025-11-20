"use client"

import { useState, useCallback, useEffect, useMemo, useRef, useTransition } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { GenerationForm } from "@/components/generation-form"
import { SettingsDialog } from "@/components/settings-dialog"
import { useImageUpload } from "@/hooks/use-image-upload"
import { useGeneration } from "@/hooks/use-generation"
import { cn } from "@/lib/utils"
import { parseImageSize } from "@/lib/image-utils"
import {
  ArrowLeft,
  Settings,
  Upload,
  X,
  Sparkles,
  ImageIcon,
  Download,
  Maximize2,
  Clock,
  Trash2,
  Loader2,
  Image as ImageIconLucide,
  Search,
  X as XIcon,
  Copy,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { GenerationResult } from "@/lib/api-client"

interface NewImageGeneratorProps {
  onBack?: () => void
}

export function NewImageGenerator({ onBack }: NewImageGeneratorProps) {
  const [mode, setMode] = useState<"img2img" | "txt2img">("txt2img")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ src: string; width: number; height: number; index: number; images: string[] } | null>(null)
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<GenerationResult | null>(null)
  const [formResetSignal, setFormResetSignal] = useState(0)
  const [activeTab, setActiveTab] = useState("generate")
  const [historySearch, setHistorySearch] = useState("")
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set())
  const [isModeTransitionPending, startModeTransition] = useTransition()
  const { toast } = useToast()
  const changeMode = useCallback(
    (nextMode: "img2img" | "txt2img") => {
      startModeTransition(() => {
        setMode(nextMode)
      })
    },
    [startModeTransition],
  )

  const upload = useImageUpload(4)
  const addImages = upload.addImages
  const {
    results,
    history,
    generate,
    isGenerating,
    clearResults,
    clearHistory,
    deleteHistoryItem,
  } = useGeneration()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  const latestResult = results[0]
  
  // 根据图片数量自适应网格列数
  const getGridColsClass = useCallback((imageCount: number) => {
    if (imageCount === 1) return "grid-cols-1"
    if (imageCount === 2) return "grid-cols-1 sm:grid-cols-2"
    if (imageCount === 3) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    if (imageCount === 4) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2"
    if (imageCount <= 6) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    if (imageCount <= 9) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  }, [])
  
  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase()
    if (!query) {
      return history
    }
    return history.filter((item) => {
      const provider = item.provider?.toLowerCase() ?? ""
      const prompt = item.params.prompt?.toLowerCase() ?? ""
      const model = item.params.modelId?.toLowerCase() ?? ""
      return provider.includes(query) || prompt.includes(query) || model.includes(query)
    })
  }, [history, historySearch])
  useEffect(() => {
    setSelectedHistoryIds((prev) => {
      if (prev.size === 0) {
        return prev
      }
      return new Set()
    })
  }, [activeTab, historySearch])

  useEffect(() => {
    const validIds = new Set(history.map((item) => item.id))
    setSelectedHistoryIds((prev) => {
      if (prev.size === 0) {
        return prev
      }

      let changed = false
      const next = new Set<string>()
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id)
        } else {
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [history])
  const formatHistoryTimestamp = useCallback(
    (timestamp: number) =>
      new Date(timestamp).toLocaleString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  )

  const handleReset = () => {
    upload.clearImages()
    clearResults()
    setFormResetSignal((value) => value + 1)
  }

  // 复选框处理
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedHistoryIds(new Set(filteredHistory.map((item) => item.id)))
      } else {
        setSelectedHistoryIds(new Set())
      }
    },
    [filteredHistory],
  )

  const handleSelectItem = useCallback((id: string, checked: boolean) => {
    setSelectedHistoryIds((prev) => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(id)
      } else {
        newSet.delete(id)
      }
      return newSet
    })
  }, [])

  const handleDeleteSelected = useCallback(async () => {
    for (const id of selectedHistoryIds) {
      await deleteHistoryItem(id)
    }
    setSelectedHistoryIds(new Set())
  }, [selectedHistoryIds, deleteHistoryItem])

  const handleCopyPrompt = useCallback(
    async (prompt: string) => {
      if (!prompt) {
        return
      }

      try {
        await navigator.clipboard.writeText(prompt)
        const preview = prompt.length > 40 ? `${prompt.slice(0, 40)}…` : prompt
        toast({
          title: "提示词已复制",
          description: preview,
        })
      } catch (error) {
        console.error("Failed to copy prompt", error)
        toast({
          title: "复制失败",
          description: "浏览器不支持复制或被拒绝访问剪贴板",
          variant: "destructive",
        })
      }
    },
    [toast],
  )

  const isAllSelected = filteredHistory.length > 0 && selectedHistoryIds.size === filteredHistory.length
  const isSomeSelected = selectedHistoryIds.size > 0 && selectedHistoryIds.size < filteredHistory.length

  // 拖拽处理
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      dragCounter.current = 0

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        addImages(files)
        changeMode("img2img")
      }
    },
    [addImages, changeMode],
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
        changeMode("img2img")
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [addImages, changeMode],
  )

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (mode !== "img2img" || activeTab !== "generate") {
        return
      }

      const target = event.target as HTMLElement | null
      if (target) {
        const isEditable =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target.isContentEditable
        if (isEditable) {
          return
        }
      }

      const clipboardData = event.clipboardData
      if (!clipboardData) {
        return
      }

      const files: File[] = []

      for (const item of clipboardData.items) {
        if (item.kind !== "file") {
          continue
        }

        const file = item.getAsFile()
        if (!file || !file.type.startsWith("image/")) {
          continue
        }

        if (file.name) {
          files.push(file)
          continue
        }

        const extension = file.type.split("/")[1] || "png"
        const normalizedName = `clipboard-image-${Date.now()}.${extension}`
        const normalizedFile = new File([file], normalizedName, {
          type: file.type,
          lastModified: Date.now(),
        })
        files.push(normalizedFile)
      }

      if (files.length === 0) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      changeMode("img2img")
      void addImages(files)
    }

    window.addEventListener("paste", handlePaste)
    return () => {
      window.removeEventListener("paste", handlePaste)
    }
  }, [mode, activeTab, changeMode, addImages])

  const [downloadBatchId] = useState(() => Date.now())
  const downloadCounterRef = useRef(0)

  const handleDownload = useCallback(async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      downloadCounterRef.current += 1
      a.download = `ai-generated-${downloadBatchId}-${downloadCounterRef.current}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error("Download failed:", error)
    }
  }, [downloadBatchId])

  return (
    <div className="min-h-screen bg-white">
      {/* 极简顶部导航栏 */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            {onBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-gray-900">AI</span>
              <span className="text-gray-400"> Image</span>
            </h1>
            <div className="hidden sm:block border-l border-gray-200 pl-4">
              <p className="text-sm font-medium text-gray-900">创作工作台</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isGenerating && (
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-gray-900" />
                <span className="text-sm font-medium text-gray-900">生成中...</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              className="text-gray-600 hover:text-gray-900"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Tab 导航和模式切换 */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="grid w-full max-w-sm grid-cols-3">
              <TabsTrigger value="generate" className="gap-2">
                <Sparkles className="h-4 w-4" />
                <span>创作</span>
              </TabsTrigger>
              <TabsTrigger value="results" className="gap-2">
                <ImageIcon className="h-4 w-4" />
                <span>结果</span>
                {latestResult && latestResult.images.length > 0 && (
                  <span className="ml-1 rounded-full bg-gray-900 px-2 py-0.5 text-xs text-white">
                    {latestResult.images.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <Clock className="h-4 w-4" />
                <span>历史</span>
                {history.length > 0 && (
                  <span className="ml-1 rounded-full bg-gray-400 px-2 py-0.5 text-xs text-white">
                    {history.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* 模式切换 - 仅在创作Tab显示 */}
            {activeTab === "generate" && (
              <div className="inline-flex rounded-lg border-2 border-gray-200 bg-gray-50 p-1">
                <Button
                  variant={mode === "txt2img" ? "default" : "ghost"}
                  onClick={() => changeMode("txt2img")}
                  disabled={isModeTransitionPending}
                  className={cn(
                    "rounded-md px-4 sm:px-6",
                    mode === "txt2img" ? "bg-gray-900 text-white hover:bg-gray-800" : "text-gray-600 hover:text-gray-900",
                  )}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  文本生图
                </Button>
                <Button
                  variant={mode === "img2img" ? "default" : "ghost"}
                  onClick={() => changeMode("img2img")}
                  disabled={isModeTransitionPending}
                  className={cn(
                    "rounded-md px-4 sm:px-6",
                    mode === "img2img" ? "bg-gray-900 text-white hover:bg-gray-800" : "text-gray-600 hover:text-gray-900",
                  )}
                >
                  <ImageIconLucide className="mr-2 h-4 w-4" />
                  图片编辑
                </Button>
              </div>
            )}
          </div>

          {/* 创作Tab */}
          <TabsContent value="generate" className="m-0 space-y-6">
            <div className="space-y-6">
              {/* 图片上传区域 - 仅在 img2img 模式显示 */}
              {mode === "img2img" && (
                <Card className="overflow-hidden border-2 border-gray-200">
                  <CardContent className="p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">上传图片</h3>
                        <p className="text-sm text-gray-600">
                          最多 4 张 ({upload.images.length}/4)
                        </p>
                      </div>
                      {upload.images.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={upload.clearImages}
                          className="gap-2"
                        >
                          <X className="h-4 w-4" />
                          清空
                        </Button>
                      )}
                    </div>

                    {/* 上传区域 */}
                    <div
                      onDrop={handleDrop}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "mb-6 flex min-h-[200px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed transition-all",
                        isDragging
                          ? "border-gray-900 bg-gray-50 scale-[1.02]"
                          : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100",
                        upload.isUploading && "pointer-events-none opacity-50",
                      )}
                    >
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                          <Upload className="h-8 w-8 text-gray-900" />
                        </div>
                        <div>
                          <p className="text-base font-medium text-gray-900">
                            {upload.isUploading ? "处理中..." : "拖拽图片到此处或点击上传"}
                          </p>
                          <p className="text-sm text-gray-600">
                            支持 PNG, JPG, WEBP 格式
                          </p>
                        </div>
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

                    {/* 已上传图片预览 */}
                    {upload.images.length > 0 && (
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {upload.images.map((image, index) => (
                          <div
                            key={image.id}
                            className="group relative aspect-square overflow-hidden rounded-lg border-2 border-gray-200 bg-gray-50 transition-all hover:border-gray-900"
                          >
                            <Image
                              src={image.preview || "/placeholder.svg"}
                              alt={`上传 ${index + 1}`}
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
                              className="object-cover"
                              unoptimized
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                              <div className="flex h-full items-end justify-center pb-3">
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className="h-8 w-8 rounded-full"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    upload.removeImage(image.id)
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                              {index + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 生成参数表单 */}
              <GenerationForm
                mode={mode}
                images={upload.images.map((img) => img.file)}
                isGenerating={isGenerating}
                onGenerate={generate}
                onReset={handleReset}
                resetSignal={formResetSignal}
              />
            </div>
          </TabsContent>

          {/* 结果Tab */}
          <TabsContent value="results" className="m-0">
            <div>
              {!latestResult || latestResult.images.length === 0 ? (
                <Card className="border-2 border-dashed border-gray-200">
                  <CardContent className="flex min-h-[400px] items-center justify-center">
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
                        <ImageIcon className="h-10 w-10 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="mb-2 text-xl font-semibold text-gray-900">暂无生成结果</h3>
                        <p className="text-gray-600">
                          前往创作页面开始生成图片
                        </p>
                      </div>
                      <Button
                        onClick={() => setActiveTab("generate")}
                        className="mt-4 gap-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800"
                      >
                        <Sparkles className="h-4 w-4" />
                        开始创作
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* 顶部工具栏 */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-gray-900">{latestResult.images.length}</span> 张图片 · {latestResult.provider}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearResults}
                      className="gap-1.5 text-gray-600 hover:text-gray-900"
                    >
                      <Trash2 className="h-4 w-4" />
                      清空
                    </Button>
                  </div>

                  {/* 图片网格 */}
                  <div className={cn("grid gap-4", getGridColsClass(latestResult.images.length))}>
                    {latestResult.images.map((image, index) => (
                      <div
                        key={index}
                        className="group relative overflow-hidden rounded-lg border-2 border-gray-200 bg-gray-50 transition-all hover:border-gray-900"
                      >
                        <div className="relative aspect-square overflow-hidden">
                          <Image
                            src={image || "/placeholder.svg"}
                            alt={`生成 ${index + 1}`}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-cover transition-transform group-hover:scale-105"
                            unoptimized
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="flex h-full items-end justify-center gap-2 p-3">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="gap-1.5 rounded-full shadow-lg"
                                  onClick={() => {
                                    const { width, height } = parseImageSize(latestResult.params.imageSize)
                                    setSelectedImage({ 
                                        src: image, 
                                        width, 
                                        height,
                                        index: index,
                                        images: latestResult.images
                                    })
                                  }}
                              >
                                <Maximize2 className="h-3.5 w-3.5" />
                                查看
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="gap-1.5 rounded-full shadow-lg"
                                onClick={() => handleDownload(image)}
                              >
                                <Download className="h-3.5 w-3.5" />
                                下载
                              </Button>
                            </div>
                          </div>
                          <div className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-gray-900 backdrop-blur-sm">
                            #{index + 1}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* 历史Tab */}
          <TabsContent value="history" className="m-0">
            <div>
              {history.length === 0 ? (
                <Card className="border-2 border-dashed border-gray-200">
                  <CardContent className="flex min-h-[400px] items-center justify-center">
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
                        <Clock className="h-10 w-10 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="mb-2 text-xl font-semibold text-gray-900">暂无历史记录</h3>
                        <p className="text-gray-600">
                          你的生成历史将会保存在这里
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* 顶部工具栏 */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span>
                          共 <span className="font-medium text-gray-900">{history.length}</span> 条记录
                        </span>
                        {historySearch.trim() ? (
                          <span className="text-xs text-gray-500">
                            筛选出 <span className="font-medium text-gray-900">{filteredHistory.length}</span> 条
                          </span>
                        ) : null}
                        {selectedHistoryIds.size > 0 && (
                          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            已选 {selectedHistoryIds.size} 条
                          </span>
                        )}
                      </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                      <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                          type="text"
                          value={historySearch}
                          onChange={(e) => setHistorySearch(e.target.value)}
                          placeholder="搜索模型、提示词或供应商..."
                          className="h-9 w-full rounded-lg border-2 border-gray-200 bg-white pl-10 pr-10 text-sm transition-all placeholder:text-gray-400 hover:border-gray-300 focus:border-gray-900 focus:ring-0"
                        />
                        {historySearch && (
                          <button
                            onClick={() => setHistorySearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                            aria-label="清除搜索"
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {selectedHistoryIds.size > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDeleteSelected}
                          className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                          删除选中
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setHistorySearch("")
                          clearHistory()
                        }}
                        className="gap-1.5 text-gray-600 hover:text-gray-900"
                      >
                        <Trash2 className="h-4 w-4" />
                        清空全部
                      </Button>
                    </div>
                    </div>
                  </div>

                  {/* 历史列表 */}
                  {filteredHistory.length === 0 ? (
                    <Card className="border-2 border-dashed border-gray-200">
                      <CardContent className="flex min-h-[240px] items-center justify-center">
                        <p className="text-sm text-gray-500">未找到匹配的历史记录</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="gap-0 border-2 border-gray-200 py-0">
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="w-[48px]">
                                <Checkbox
                                  checked={isAllSelected}
                                  onCheckedChange={handleSelectAll}
                                  aria-label="全选"
                                  className={cn(
                                    isSomeSelected && !isAllSelected && "border-gray-900 bg-gray-400"
                                  )}
                                />
                              </TableHead>
                              <TableHead className="w-[72px]">预览</TableHead>
                              <TableHead>供应商</TableHead>
                              <TableHead>模型</TableHead>
                              <TableHead className="max-w-[260px]">提示词</TableHead>
                              <TableHead>生成时间</TableHead>
                              <TableHead className="text-center">数量</TableHead>
                              <TableHead className="text-right">操作</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredHistory.map((item) => {
                              const primaryImage = item.images[0]
                              const isSelected = selectedHistoryIds.has(item.id)
                              return (
                                <TableRow 
                                    key={item.id} 
                                    className={cn(isSelected && "bg-blue-50/50", "cursor-pointer")}
                                    onClick={() => setSelectedHistoryItem(item)}
                                >
                                  <TableCell>
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        handleSelectItem(item.id, checked as boolean)
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      aria-label={`选择 ${item.provider}`}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {primaryImage ? (
                                      <div className="relative h-12 w-12 overflow-hidden rounded-md border border-gray-200 group/image cursor-pointer">
                                        <Image
                                          src={primaryImage || "/placeholder.svg"}
                                          alt="预览"
                                          fill
                                          sizes="48px"
                                          className="object-cover transition-transform group-hover/image:scale-110"
                                          unoptimized
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setSelectedHistoryItem(item)
                                          }}
                                        />
                                        {item.images.length > 1 && (
                                            <div className="absolute top-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 font-medium rounded-bl-md">
                                                +{item.images.length - 1}
                                            </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-400">无</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-medium text-gray-900">{item.provider}</span>
                                      <span className="text-xs text-gray-500">共 {item.images.length} 张</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="max-w-[160px] truncate text-gray-600">
                                    {item.params.modelId ? item.params.modelId : "—"}
                                  </TableCell>
                                  <TableCell className="max-w-[260px] text-gray-700">
                                    {item.params.prompt ? (
                                      <div className="flex items-center gap-2">
                                        <span className="flex-1 truncate" title={item.params.prompt}>
                                          {item.params.prompt}
                                        </span>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleCopyPrompt(item.params.prompt ?? "")}
                                          className="h-7 w-7 shrink-0 text-gray-500 hover:text-gray-900"
                                          aria-label="复制提示词"
                                        >
                                          <Copy className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                  <TableCell className="text-gray-600">
                                    {formatHistoryTimestamp(item.timestamp)}
                                  </TableCell>
                                  <TableCell className="text-center text-gray-700">
                                    {item.images.length}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={item.images.length === 0}
                                        className="h-8 w-8 text-gray-500 hover:text-gray-900 disabled:opacity-40"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (!item.images.length) return
                                          const { width, height } = parseImageSize(item.params.imageSize)
                                          setSelectedImage({ 
                                              src: item.images[0], 
                                              width, 
                                              height,
                                              index: 0,
                                              images: item.images
                                          })
                                        }}
                                      >
                                        <Maximize2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          deleteHistoryItem(item.id)
                                        }}
                                        className="h-8 w-8 text-gray-400 hover:text-gray-900"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 图片预览对话框 */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-screen-xl p-0 overflow-hidden border-none bg-black/90 outline-none" onKeyDown={(e) => {
            if (!selectedImage || !selectedImage.images || selectedImage.images.length <= 1) return
            if (e.key === "ArrowLeft") {
                const newIndex = (selectedImage.index - 1 + selectedImage.images.length) % selectedImage.images.length
                setSelectedImage({ ...selectedImage, src: selectedImage.images[newIndex], index: newIndex })
            } else if (e.key === "ArrowRight") {
                const newIndex = (selectedImage.index + 1) % selectedImage.images.length
                setSelectedImage({ ...selectedImage, src: selectedImage.images[newIndex], index: newIndex })
            }
        }}>
          <DialogTitle className="sr-only">图片预览</DialogTitle>
          <DialogDescription className="sr-only">显示所选生成图片的完整预览</DialogDescription>
          {selectedImage && (
            <div className="relative w-full h-[85vh] flex items-center justify-center">
              <Image
                src={selectedImage.src || "/placeholder.svg"}
                alt="预览"
                width={selectedImage.width}
                height={selectedImage.height}
                className="max-h-full max-w-full object-contain"
                unoptimized
              />
              
              {/* 顶部工具栏 */}
              <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                  <div className="text-white/80 text-sm">
                      {selectedImage.width} × {selectedImage.height}
                  </div>
                  <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white/80 hover:text-white hover:bg-white/20 rounded-full"
                        onClick={() => handleDownload(selectedImage.src)}
                      >
                        <Download className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white/80 hover:text-white hover:bg-white/20 rounded-full"
                        onClick={() => setSelectedImage(null)}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                  </div>
              </div>

              {/* 导航按钮 */}
              {selectedImage.images && selectedImage.images.length > 1 && (
                <>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-4 h-12 w-12 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition-colors"
                        onClick={(e) => {
                            e.stopPropagation()
                            const newIndex = (selectedImage.index - 1 + selectedImage.images.length) % selectedImage.images.length
                            setSelectedImage({ ...selectedImage, src: selectedImage.images[newIndex], index: newIndex })
                        }}
                    >
                        <ChevronLeft className="h-8 w-8" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-4 h-12 w-12 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition-colors"
                        onClick={(e) => {
                            e.stopPropagation()
                            const newIndex = (selectedImage.index + 1) % selectedImage.images.length
                            setSelectedImage({ ...selectedImage, src: selectedImage.images[newIndex], index: newIndex })
                        }}
                    >
                        <ChevronRight className="h-8 w-8" />
                    </Button>
                    
                    {/* 底部指示器 */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white/90 text-sm font-medium">
                        {selectedImage.index + 1} / {selectedImage.images.length}
                    </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* 日志详情对话框 */}
      <Dialog open={!!selectedHistoryItem} onOpenChange={() => setSelectedHistoryItem(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">生成记录详情</DialogTitle>
          <DialogDescription className="sr-only">查看选中历史记录的完整信息和所有图片</DialogDescription>
          {selectedHistoryItem && (() => {
            const { width, height } = parseImageSize(selectedHistoryItem.params.imageSize)
            return (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">提示词</h3>
                  <p className="text-sm text-gray-600">{selectedHistoryItem.params.prompt}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">生成信息</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>提供商: {selectedHistoryItem.provider}</p>
                    <p>模型: {selectedHistoryItem.params.modelId || "—"}</p>
                    <p>图片数量: {selectedHistoryItem.images.length} 张</p>
                    <p>生成时间: {formatHistoryTimestamp(selectedHistoryItem.timestamp)}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">所有图片 ({selectedHistoryItem.images.length})</h3>
                  <div className={cn("grid gap-4", getGridColsClass(selectedHistoryItem.images.length))}>
                    {selectedHistoryItem.images.map((image, index) => (
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
                        <div className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs font-semibold text-white">
                          #{index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
