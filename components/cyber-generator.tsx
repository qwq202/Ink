"use client"

import { memo, useState, useCallback, useEffect, useMemo, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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
  Trash2,
  Loader2,
  Search,
  X as XIcon,
  ChevronLeft,
  ChevronRight,
  Star,
  RotateCcw,
  Package,
  ChevronsUpDown
} from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { useProviderSettings } from "@/hooks/use-provider-settings"
import { TaskStatusPanel } from "@/components/task-status-panel"
import { OnboardingWizard } from "@/components/onboarding-wizard"
import { useOnboarding } from "@/hooks/use-onboarding"
import { VariantGeneratorDialog } from "@/components/variant-generator-dialog"
import { ImageComparisonView } from "@/components/image-comparison-view"
import { ImageEditorDialog } from "@/components/image-editor-dialog"
import type { GenerationParams, GenerationResult } from "@/lib/api-client"

interface CyberGeneratorProps {
  onBack?: () => void
}

type SelectedImageState = {
  src: string
  width: number
  height: number
  index: number
  images: string[]
}

interface ResultsPanelProps {
  latestResult?: GenerationResult
  resultImageSize: { width?: number; height?: number }
  onClearResults: () => void
  onDownload: (url: string) => void
  onOpenImage: (image: SelectedImageState) => void
  onCompare?: () => void
  onEdit?: (url: string) => void
}

const ResultsPanel = memo(function ResultsPanel({
  latestResult,
  resultImageSize,
  onClearResults,
  onDownload,
  onOpenImage,
  onCompare,
  onEdit,
}: ResultsPanelProps) {
  if (!latestResult || latestResult.images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <ImageIcon className="size-8 text-muted-foreground/50" />
        </div>
        <div>
          <p className="text-lg font-medium">暂无生成结果</p>
          <p className="text-sm text-muted-foreground mt-1">在右侧填写提示词并点击生成</p>
        </div>
      </div>
    )
  }

  const imgW = resultImageSize.width || 1024
  const imgH = resultImageSize.height || 1024
  const count = latestResult.images.length
  const gridCols = count === 1 ? "grid-cols-1 max-w-3xl mx-auto" : count === 2 ? "grid-cols-2 max-w-3xl" : "grid-cols-3 max-w-4xl"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {latestResult.provider.toUpperCase()} · <span className="font-mono text-xs">{latestResult.id.slice(0, 8)}</span>
        </p>
        <div className="flex gap-2">
          {count >= 2 && onCompare && (
            <Button variant="outline" size="sm" onClick={onCompare}>对比前两张</Button>
          )}
          <Button variant="outline" size="sm" onClick={onClearResults}>
            <Trash2 className="size-4 mr-1.5" />清空
          </Button>
        </div>
      </div>

      <div className={cn("grid gap-4 mx-auto", gridCols)}>
        {latestResult.images.map((image, idx) => (
          <div key={idx} className="group relative rounded-xl overflow-hidden border bg-card shadow-sm hover:shadow-md transition-shadow">
            <Image
              src={image}
              alt="Generated"
              width={imgW}
              height={imgH}
              className="w-full h-auto block"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            <div className="absolute bottom-0 left-0 right-0 p-4 flex gap-2 justify-end opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200">
              <Button
                size="icon"
                variant="secondary"
                className="size-9 bg-white/90 hover:bg-white text-black shadow-sm"
                onClick={() => onOpenImage({ src: image, width: imgW, height: imgH, index: idx, images: latestResult.images })}
              >
                <Maximize2 className="size-4" />
              </Button>
              {onEdit && (
                <Button size="icon" variant="secondary" className="size-9 bg-white/90 hover:bg-white text-black shadow-sm" onClick={() => onEdit(image)}>
                  <Sparkles className="size-4" />
                </Button>
              )}
              <Button size="icon" variant="secondary" className="size-9 bg-white/90 hover:bg-white text-black shadow-sm" onClick={() => onDownload(image)}>
                <Download className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

interface HistoryPanelProps {
  filteredHistory: GenerationResult[]
  onSelectItem: (item: GenerationResult) => void
  onDeleteItem: (id: string) => void
  selectedIds: Set<string>
  onToggleRow: (id: string, checked: boolean) => void
  onToggleAll: (checked: boolean) => void
  onDeleteSelected: () => void
  onRegenerate?: (item: GenerationResult) => void
  onToggleFavorite?: (id: string, isFavorite: boolean) => void
  onBatchDownload?: (ids: string[]) => void
  onApplyParams?: (item: GenerationResult) => void
}

const HistoryPanel = memo(function HistoryPanel({
  filteredHistory,
  onSelectItem,
  onDeleteItem,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onDeleteSelected,
  onRegenerate,
  onToggleFavorite,
  onBatchDownload,
  onApplyParams,
}: HistoryPanelProps) {
  const allIds = filteredHistory.map((item) => item.id)
  const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false}
            onCheckedChange={(checked) => onToggleAll(Boolean(checked))}
            aria-label="全选"
          />
          <span className="text-sm text-muted-foreground">{selectedIds.size}/{filteredHistory.length} 已选</span>
        </div>
        <div className="flex gap-2">
          {onBatchDownload && (
            <Button size="sm" variant="outline" disabled={selectedIds.size === 0} onClick={() => onBatchDownload(Array.from(selectedIds))}>
              <Package className="size-4 mr-1.5" />批量下载
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={selectedIds.size === 0}
            className="text-destructive hover:text-destructive border-destructive/40 hover:border-destructive"
            onClick={onDeleteSelected}>
            <Trash2 className="size-4 mr-1.5" />删除
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredHistory.map((item) => (
          <div
            key={item.id}
            className="group relative rounded-xl border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onSelectItem(item)}
          >
            <div className="absolute top-3 left-3">
              <Checkbox
                checked={selectedIds.has(item.id)}
                onCheckedChange={(checked) => onToggleRow(item.id, Boolean(checked))}
                aria-label={`选择 ${item.id}`}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {item.images[0] ? (
              <div className="relative aspect-video rounded-md overflow-hidden bg-muted mb-3">
                <Image src={item.images[0]} alt="" fill className="object-cover" />
                {item.images.length > 1 && (
                  <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                    +{item.images.length - 1}
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-video rounded-md bg-muted mb-3 flex items-center justify-center">
                <ImageIcon className="size-8 text-muted-foreground/30" />
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium line-clamp-2">{item.params.prompt || "(空提示词)"}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="font-normal">{item.provider}</Badge>
                {item.params.modelId && (
                  <span className="truncate max-w-[100px]">{item.params.modelId}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(item.timestamp).toLocaleString("zh-CN")}
              </p>
            </div>

            {onToggleFavorite && (
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="size-8"
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id, !!(item.isFavorite)) }}>
                  <Star className={cn("size-4", item.isFavorite ? "fill-amber-500 text-amber-500" : "")} />
                </Button>
              </div>
            )}

            <div className="absolute bottom-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onRegenerate && (
                <Button variant="secondary" size="icon" className="size-8"
                  onClick={(e) => { e.stopPropagation(); onRegenerate(item) }} title="重新生成">
                  <RotateCcw className="size-4" />
                </Button>
              )}
              {onApplyParams && (
                <Button variant="secondary" size="icon" className="size-8"
                  onClick={(e) => { e.stopPropagation(); onApplyParams(item) }} title="填入表单">
                  <ChevronsUpDown className="size-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id) }}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filteredHistory.length === 0 && (
        <div className="py-16 text-center">
          <ImageIcon className="size-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">暂无生成记录</p>
        </div>
      )}
    </div>
  )
})

export function CyberGenerator({ onBack }: CyberGeneratorProps) {
  const [mode, setMode] = useState<"img2img" | "txt2img">("txt2img")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<SelectedImageState | null>(null)
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<GenerationResult | null>(null)
  const [formResetSignal, setFormResetSignal] = useState(0)
  const [activeTab, setActiveTab] = useState("generate")
  const [historySearch, setHistorySearch] = useState("")
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set())
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>()
  const [initialParams, setInitialParams] = useState<Partial<GenerationParams> | undefined>()
  const [forceOnboarding, setForceOnboarding] = useState(false)
  const [dismissedOnboarding, setDismissedOnboarding] = useState(false)
  const [settingsTab, setSettingsTab] = useState<string | undefined>(undefined)
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [comparisonItems, setComparisonItems] = useState<GenerationResult[]>([])
  const [editingImage, setEditingImage] = useState<SelectedImageState | null>(null)
  const [variantBaseParams, setVariantBaseParams] = useState<(GenerationParams & { providerId?: string }) | null>(null)
  const [variantDialogOpen, setVariantDialogOpen] = useState(false)
  const [historyFilters, setHistoryFilters] = useState<{ favoritesOnly: boolean; minRating: number | null }>({
    favoritesOnly: false,
    minRating: null,
  })
  const [detailRating, setDetailRating] = useState<number | null>(null)
  const [detailTags, setDetailTags] = useState<string>("")
  const UI_STATE_KEY = "cyber-generator-ui"
  const { toast } = useToast()
  const { shouldShowOnboarding, completeOnboarding, hasEnabledProviders } = useOnboarding()
  const { getProvider: getProviderFromSettings } = useProviderSettings()

  const changeMode = useCallback((nextMode: "img2img" | "txt2img") => {
    setMode(nextMode)
  }, [])

  // Restore UI state
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(UI_STATE_KEY) : null
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<{ mode: "img2img" | "txt2img"; activeTab: string; historySearch: string }>
      if (parsed.mode === "img2img" || parsed.mode === "txt2img") {
        setMode(parsed.mode)
      }
      if (typeof parsed.activeTab === "string") {
        setActiveTab(parsed.activeTab)
      }
      if (typeof parsed.historySearch === "string") {
        setHistorySearch(parsed.historySearch)
      }
    } catch {
      // ignore
    }
  }, [])

  // Persist UI state
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const payload = { mode, activeTab, historySearch }
      window.localStorage.setItem(UI_STATE_KEY, JSON.stringify(payload))
    } catch {
      // ignore
    }
  }, [mode, activeTab, historySearch])

  const upload = useImageUpload(100)
  const addImages = upload.addImages
  const {
    results,
    history,
    generate,
    isGenerating,
    clearResults,
    clearHistory,
    deleteHistoryItem,
    cancelGeneration,
    refreshHistory,
    toggleFavorite,
    updateRating,
    updateTags,
    queueStatus,
  } = useGeneration()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  // 监听粘贴事件以支持 Ctrl+V 粘贴图片
  useEffect(() => {
    // 只在图生图模式下监听粘贴事件
    if (mode !== "img2img") return

    const handlePaste = async (e: ClipboardEvent) => {
      // 如果焦点在输入框/文本域中，不处理粘贴
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return
      }

      const items = e.clipboardData?.items
      if (!items) return

      const imageFiles: File[] = []
      
      // 遍历剪贴板项
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        
        // 检查是否为图片
        if (item.type.indexOf("image") !== -1) {
          const blob = item.getAsFile()
          if (blob) {
            // 生成唯一文件名
            const fileName = `pasted-image-${Date.now()}-${i}.png`
            const file = new File([blob], fileName, { type: blob.type })
            imageFiles.push(file)
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault()
        addImages(imageFiles)
        toast({
          title: "已粘贴图片",
          description: `成功添加 ${imageFiles.length} 张图片`,
        })
      }
    }

    window.addEventListener("paste", handlePaste)
    
    return () => {
      window.removeEventListener("paste", handlePaste)
    }
  }, [mode, addImages, toast])

  const latestResult = results[0]
  const resultImageSize = useMemo(() => parseImageSize(latestResult?.params.imageSize), [latestResult?.params.imageSize])
  const handleEditImage = useCallback(
    (url: string) => {
      const width = resultImageSize.width || 1024
      const height = resultImageSize.height || 1024
      setEditingImage({ src: url, width, height, index: 0, images: [url] })
    },
    [resultImageSize],
  )
  
  useEffect(() => {
    if (!selectedHistoryItem) {
      setDetailRating(null)
      setDetailTags("")
      return
    }
    setDetailRating(selectedHistoryItem.rating ?? null)
    setDetailTags(selectedHistoryItem.tags?.join(",") ?? "")
  }, [selectedHistoryItem])

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase()
    let data = history
    if (historyFilters.favoritesOnly) {
      data = data.filter((item) => item.isFavorite)
    }
    if (historyFilters.minRating !== null) {
      data = data.filter((item) => (item.rating ?? 0) >= historyFilters.minRating!)
    }
    if (query) {
      data = data.filter((item) => {
        const provider = item.provider?.toLowerCase() ?? ""
        const prompt = item.params.prompt?.toLowerCase() ?? ""
        const model = item.params.modelId?.toLowerCase() ?? ""
        return provider.includes(query) || prompt.includes(query) || model.includes(query)
      })
    }
    return data
  }, [history, historySearch, historyFilters])

  const visibleSelectedIds = useMemo(() => {
    const valid = new Set(filteredHistory.map((item) => item.id))
    const next = new Set<string>()
    selectedHistoryIds.forEach((id) => {
      if (valid.has(id)) next.add(id)
    })
    return next
  }, [filteredHistory, selectedHistoryIds])

  const handleToggleRow = useCallback((id: string, checked: boolean) => {
    setSelectedHistoryIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const handleToggleAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedHistoryIds(new Set(filteredHistory.map((item) => item.id)))
      } else {
        setSelectedHistoryIds(new Set())
      }
    },
    [filteredHistory],
  )

  const handleDeleteSelected = useCallback(async () => {
    for (const id of visibleSelectedIds) {
      await deleteHistoryItem(id)
    }
    setSelectedHistoryIds((prev) => {
      const next = new Set(prev)
      visibleSelectedIds.forEach((id) => next.delete(id))
      return next
    })
  }, [deleteHistoryItem, visibleSelectedIds])

  const handleClearAllHistory = useCallback(async () => {
    if (!window.confirm("确定要清空全部历史记录吗？此操作不可撤销。")) return
    await clearHistory()
    setSelectedHistoryIds(new Set())
  }, [clearHistory])

  const handleRegenerate = useCallback(
    async (item: GenerationResult) => {
      const provider = getProviderFromSettings(item.provider.toLowerCase())
      if (!provider) {
        toast({
          title: "供应商不可用",
          description: `无法找到供应商 ${item.provider}，请检查设置`,
          variant: "destructive",
        })
        return
      }
      await generate(provider, item.params)
      toast({
        title: "已开始重新生成",
        description: "使用相同的参数重新生成图片",
      })
    },
    [generate, getProviderFromSettings, toast],
  )

  const handleApplyParams = useCallback((item: GenerationResult) => {
    setInitialPrompt(item.params.prompt)
    setInitialParams({ ...item.params, providerId: item.provider.toLowerCase() } as Partial<GenerationParams>)
    setMode("txt2img")
    setActiveTab("generate")
    toast({
      title: "已填入表单",
      description: "你可以微调后再次生成",
    })
  }, [toast])

  const handleToggleFavorite = useCallback(
    async (id: string, isFavorite: boolean) => {
      try {
        await toggleFavorite(id, isFavorite)
        toast({
          title: isFavorite ? "已收藏" : "已取消收藏",
          description: isFavorite ? "此记录已添加到收藏" : "此记录已从收藏中移除",
        })
      } catch (error) {
        toast({
          title: "操作失败",
          description: error instanceof Error ? error.message : "无法更新收藏状态",
          variant: "destructive",
        })
      }
    },
    [toggleFavorite, toast],
  )

  const handleBatchDownload = useCallback(
    async (ids: string[]) => {
      try {
        // Dynamic import for JSZip
        const JSZip = (await import("jszip")).default
        const zip = new JSZip()

        const selectedItems = history.filter((item) => ids.includes(item.id))
        let downloadCount = 0

        for (const item of selectedItems) {
          for (let i = 0; i < item.images.length; i++) {
            try {
              const response = await fetch(item.images[i])
              const blob = await response.blob()
              const filename = `${item.id}-${i + 1}.png`
              zip.file(filename, blob)
              downloadCount++
            } catch (error) {
              console.error(`Failed to download image ${i + 1} of ${item.id}:`, error)
            }
          }
        }

        if (downloadCount === 0) {
          toast({
            title: "下载失败",
            description: "没有可下载的图片",
            variant: "destructive",
          })
          return
        }

        const zipBlob = await zip.generateAsync({ type: "blob" })
        const url = URL.createObjectURL(zipBlob)
        const a = document.createElement("a")
        a.href = url
        a.download = `ai-images-${Date.now()}.zip`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        toast({
          title: "下载成功",
          description: `已打包下载 ${downloadCount} 张图片`,
        })
      } catch (error) {
        toast({
          title: "下载失败",
          description: error instanceof Error ? error.message : "批量下载失败",
          variant: "destructive",
        })
      }
    },
    [history, toast],
  )

  const handleReset = () => {
    upload.clearImages()
    clearResults()
    setFormResetSignal((value) => value + 1)
  }
  
  const handleDownload = useCallback(async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `cyber-gen-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error("Download failed:", error)
    }
  }, [])
  
  const handleOpenImage = useCallback((next: SelectedImageState) => {
    setSelectedImage(next)
  }, [])

  // keep grid columns logic close by to avoid re-allocation each render
  const getGridColsClass = useCallback((imageCount: number) => {
    if (imageCount === 1) return "grid-cols-1"
    if (imageCount === 2) return "grid-cols-1 sm:grid-cols-2"
    if (imageCount === 3) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    if (imageCount === 4) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2"
    if (imageCount <= 6) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    if (imageCount <= 9) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  }, [])

  const showOnboarding = !dismissedOnboarding && (shouldShowOnboarding || forceOnboarding)

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* NAVBAR */}
      <nav className="h-14 border-b px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <ImageIcon className="size-5" />
            <span className="font-semibold text-lg">Ink</span>
          </div>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => v && changeMode(v as "txt2img" | "img2img")}
            className="bg-muted/50 p-0.5"
          >
            <ToggleGroupItem value="txt2img" className="text-sm px-3 py-1.5">
              文本生成
            </ToggleGroupItem>
            <ToggleGroupItem value="img2img" className="text-sm px-3 py-1.5">
              图生图
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex items-center gap-3">
          {queueStatus.tasks.length > 0 && (
            <Badge variant="secondary" className="gap-1.5">
              <Loader2 className="size-3 animate-spin" />
              {queueStatus.tasks.length} 个任务
            </Badge>
          )}
          <Button variant="ghost" size="icon" onClick={() => { setSettingsTab(undefined); setSettingsOpen(true) }}>
            <Settings className="size-4" />
          </Button>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex overflow-hidden">
        {/* CENTER CANVAS */}
        <main className="flex-1 overflow-y-auto p-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="generate">生成结果</TabsTrigger>
              <TabsTrigger value="history">
                历史记录
                {history.length > 0 && <Badge variant="secondary" className="ml-2">{history.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="generate" className="mt-0">
              {queueStatus.tasks.length > 0 && (
                <div className="mb-6">
                  <TaskStatusPanel tasks={queueStatus.tasks} onCancel={cancelGeneration} />
                </div>
              )}
              <ResultsPanel
                latestResult={latestResult}
                resultImageSize={resultImageSize}
                onClearResults={clearResults}
                onDownload={handleDownload}
                onOpenImage={handleOpenImage}
                onEdit={handleEditImage}
                onCompare={() => {
                  if (!latestResult || latestResult.images.length < 2) return
                  setComparisonItems([
                    { ...latestResult, images: [latestResult.images[0]] },
                    { ...latestResult, images: [latestResult.images[1]] },
                  ])
                  setComparisonOpen(true)
                }}
              />
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <div className="flex gap-3 mb-6">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="搜索提示词或模型..."
                    className="pl-9 h-9"
                  />
                  {historySearch && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setHistorySearch("")}
                    >
                      <XIcon className="size-4" />
                    </button>
                  )}
                </div>
                <Button
                  size="sm"
                  className="h-9"
                  variant={historyFilters.favoritesOnly ? "default" : "outline"}
                  onClick={() => setHistoryFilters((prev) => ({ ...prev, favoritesOnly: !prev.favoritesOnly }))}
                >
                  <Star className="size-4 mr-1.5" />
                  只看收藏
                </Button>
              </div>
              <HistoryPanel
                filteredHistory={filteredHistory}
                onSelectItem={setSelectedHistoryItem}
                onDeleteItem={deleteHistoryItem}
                selectedIds={visibleSelectedIds}
                onToggleRow={handleToggleRow}
                onToggleAll={handleToggleAll}
                onDeleteSelected={handleDeleteSelected}
                onRegenerate={handleRegenerate}
                onToggleFavorite={handleToggleFavorite}
                onBatchDownload={handleBatchDownload}
                onApplyParams={handleApplyParams}
              />
            </TabsContent>
          </Tabs>
        </main>

        {/* RIGHT PANEL */}
        <aside className="w-[380px] border-l flex flex-col shrink-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            {/* Image Upload (img2img mode) */}
            {mode === "img2img" && (
              <div className="space-y-3">
                <Label>上传源图</Label>
                <div
                  className="border border-dashed rounded-md p-6 cursor-pointer hover:bg-muted/50 transition-colors text-center"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">点击上传</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    支持 <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Ctrl+V</kbd> 粘贴
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { if (e.target.files) addImages(Array.from(e.target.files)) }}
                />
                {upload.images.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {upload.images.map((img, index) => (
                      <div key={img.id} className="relative aspect-square rounded-md overflow-hidden border bg-muted">
                        <Image src={img.preview} alt="" fill className="object-cover" />
                        <div className="absolute top-1 left-1 bg-primary/80 text-primary-foreground text-[10px] px-1.5 py-0.5 rounded">
                          #{index + 1}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); upload.removeImage(img.id) }}
                          className="absolute top-1 right-1 bg-background/90 hover:bg-background text-foreground p-0.5 rounded transition-colors"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <GenerationForm
              mode={mode}
              images={upload.images.map((img) => img.file)}
              isGenerating={isGenerating}
              onGenerate={generate}
              onReset={handleReset}
              resetSignal={formResetSignal}
              initialPrompt={initialPrompt}
              onPromptSet={() => setInitialPrompt(undefined)}
              initialParams={initialParams}
              onOpenSettings={(tab) => { setSettingsTab(tab); setSettingsOpen(true) }}
              onImagesChange={(files) => upload.addImages(files)}
              onModeChange={changeMode}
            />
          </div>
        </aside>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} activeTab={settingsTab} onTabChange={setSettingsTab} />

      {showOnboarding && (
        <OnboardingWizard
          hasEnabledProviders={hasEnabledProviders}
          onComplete={(finalized) => {
            if (finalized) { completeOnboarding() } else { setDismissedOnboarding(true) }
            setForceOnboarding(false)
          }}
          onOpenSettings={() => { setSettingsOpen(true); setSettingsTab(undefined) }}
          onSelectExample={(example) => {
            setInitialPrompt(example.prompt)
            setInitialParams({ prompt: example.prompt, images: undefined })
            changeMode(example.mode)
            completeOnboarding()
          }}
        />
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent
          className="max-w-6xl p-0 bg-black overflow-hidden"
          onKeyDown={(e) => {
            if (!selectedImage?.images || selectedImage.images.length <= 1) return
            if (e.key === "ArrowLeft") {
              const i = (selectedImage.index - 1 + selectedImage.images.length) % selectedImage.images.length
              setSelectedImage({ ...selectedImage, src: selectedImage.images[i], index: i })
            } else if (e.key === "ArrowRight") {
              const i = (selectedImage.index + 1) % selectedImage.images.length
              setSelectedImage({ ...selectedImage, src: selectedImage.images[i], index: i })
            }
          }}
        >
          <DialogTitle className="sr-only">图片预览</DialogTitle>
          <DialogDescription className="sr-only">图片预览</DialogDescription>
          {selectedImage && (
            <div className="relative flex items-center justify-center bg-black min-h-[70vh]">
              <Image
                src={selectedImage.src}
                alt="Full Preview"
                width={selectedImage.width}
                height={selectedImage.height}
                className="max-h-[85vh] max-w-full object-contain"
                unoptimized
              />
              <div className="absolute top-4 left-4">
                <span className="text-sm text-white/60 bg-black/50 px-3 py-1.5 rounded-md">
                  {selectedImage.width} × {selectedImage.height}
                </span>
              </div>
              <div className="absolute top-4 right-4 flex gap-2">
                <Button size="icon" variant="ghost" className="size-9 text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => handleDownload(selectedImage.src)}>
                  <Download className="size-5" />
                </Button>
                <Button size="icon" variant="ghost" className="size-9 text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => setSelectedImage(null)}>
                  <X className="size-5" />
                </Button>
              </div>
              {selectedImage.images && selectedImage.images.length > 1 && (
                <>
                  <Button size="icon" variant="ghost"
                    className="absolute left-4 top-1/2 -translate-y-1/2 size-10 text-white/70 hover:text-white hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation()
                      const i = (selectedImage.index - 1 + selectedImage.images.length) % selectedImage.images.length
                      setSelectedImage({ ...selectedImage, src: selectedImage.images[i], index: i })
                    }}>
                    <ChevronLeft className="size-6" />
                  </Button>
                  <Button size="icon" variant="ghost"
                    className="absolute right-4 top-1/2 -translate-y-1/2 size-10 text-white/70 hover:text-white hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation()
                      const i = (selectedImage.index + 1) % selectedImage.images.length
                      setSelectedImage({ ...selectedImage, src: selectedImage.images[i], index: i })
                    }}>
                    <ChevronRight className="size-6" />
                  </Button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/60 bg-black/50 px-3 py-1.5 rounded-md">
                    {selectedImage.index + 1} / {selectedImage.images.length}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Detail Dialog */}
      <Dialog open={!!selectedHistoryItem} onOpenChange={() => setSelectedHistoryItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>生成记录详情</DialogTitle>
          <DialogDescription className="sr-only">查看历史记录详情</DialogDescription>
          {selectedHistoryItem && (() => {
            const { width, height } = parseImageSize(selectedHistoryItem.params.imageSize)
            return (
              <div className="flex flex-col gap-5 pt-4">
                <div>
                  <Label className="text-xs text-muted-foreground">提示词</Label>
                  <p className="text-sm mt-1">{selectedHistoryItem.params.prompt}</p>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">生成信息</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                    <span className="text-muted-foreground">提供商</span><span>{selectedHistoryItem.provider}</span>
                    <span className="text-muted-foreground">模型</span><span className="truncate">{selectedHistoryItem.params.modelId || "—"}</span>
                    <span className="text-muted-foreground">图片数量</span><span>{selectedHistoryItem.images.length} 张</span>
                    <span className="text-muted-foreground">生成时间</span><span>{new Date(selectedHistoryItem.timestamp).toLocaleString("zh-CN")}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => handleApplyParams(selectedHistoryItem)}>填入表单</Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      setVariantBaseParams({ ...(selectedHistoryItem.params as GenerationParams), providerId: selectedHistoryItem.provider.toLowerCase() })
                      setVariantDialogOpen(true)
                    }}>生成变体</Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">评分</Label>
                  <div className="flex gap-1.5 mt-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Button key={n} size="sm" variant={detailRating === n ? "default" : "outline"}
                        onClick={() => setDetailRating(n)} className="size-9 p-0">
                        {n}★
                      </Button>
                    ))}
                    <Button size="sm" variant="ghost" onClick={() => setDetailRating(null)} className="size-9">清除</Button>
                    <Button size="sm" onClick={async () => {
                      await updateRating(selectedHistoryItem.id, detailRating)
                      await refreshHistory()
                      toast({ title: "已保存评分" })
                    }}>保存</Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">所有图片 ({selectedHistoryItem.images.length})</Label>
                  <div className={cn("grid gap-3 mt-2", getGridColsClass(selectedHistoryItem.images.length))}>
                    {selectedHistoryItem.images.map((image, index) => (
                      <div key={index} className="group relative rounded-md overflow-hidden border bg-muted">
                        <Image src={image || "/placeholder.svg"} alt={`图片 ${index + 1}`}
                          className="w-full h-auto cursor-pointer" width={width} height={height} unoptimized
                          onClick={() => setSelectedImage({ src: image, width, height, index, images: selectedHistoryItem.images })} />
                        <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="secondary" size="icon" className="size-8 bg-black/60 hover:bg-black/80 text-white border-0"
                            onClick={(e) => { e.stopPropagation(); setSelectedImage({ src: image, width, height, index, images: selectedHistoryItem.images }) }}>
                            <Maximize2 className="size-4" />
                          </Button>
                          <Button variant="secondary" size="icon" className="size-8 bg-black/60 hover:bg-black/80 text-white border-0"
                            onClick={(e) => { e.stopPropagation(); handleDownload(image) }}>
                            <Download className="size-4" />
                          </Button>
                        </div>
                        <div className="absolute top-2 left-2 text-xs text-white bg-black/60 px-2 py-0.5 rounded">
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

      <ImageEditorDialog
        imageSrc={editingImage?.src || ""}
        open={!!editingImage}
        onOpenChange={(open) => { if (!open) setEditingImage(null) }}
        onSave={async (editedUrl) => {
          try {
            const res = await fetch(editedUrl)
            const blob = await res.blob()
            const downloadUrl = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = downloadUrl
            a.download = `edited-${Date.now()}.png`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(downloadUrl)
            toast({ title: "保存成功", description: "裁剪后的图片已下载到本地" })
          } catch (error) {
            console.error(error)
            toast({ title: "保存失败", description: "无法保存裁剪后的图片", variant: "destructive" })
          } finally {
            setEditingImage(null)
          }
        }}
      />

      <ImageComparisonView items={comparisonItems} open={comparisonOpen} onOpenChange={setComparisonOpen} onDownload={handleDownload} />

      {variantBaseParams && (
        <VariantGeneratorDialog
          baseParams={variantBaseParams}
          open={variantDialogOpen}
          onOpenChange={(open) => { setVariantDialogOpen(open); if (!open) setVariantBaseParams(null) }}
          onGenerate={async (paramsList) => {
            const providerId = (variantBaseParams as any).providerId || "fal"
            const provider = getProviderFromSettings(providerId) || getProviderFromSettings("fal") || getProviderFromSettings("newapi") || getProviderFromSettings("openrouter")
            if (!provider) {
              toast({ title: "供应商未配置", description: "请先在设置中配置供应商", variant: "destructive" })
              setVariantDialogOpen(false)
              return
            }
            for (const p of paramsList) {
              await generate(provider, p)
            }
            toast({ title: "已提交变体生成", description: `共 ${paramsList.length} 个任务已加入队列` })
          }}
        />
      )}
    </div>
  )
}
