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
  Clock,
  Trash2,
  Loader2,
  Image as ImageIconLucide,
  Search,
  X as XIcon,
  Copy,
  Terminal,
  Cpu,
  Share2,
  ChevronLeft,
  ChevronRight,
  Star,
  RotateCcw,
  Package,
  ChevronsUpDown
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
      <div className="h-full flex flex-col items-center justify-center">
        <div className="w-64 h-64 border border-border flex items-center justify-center relative animate-pulse">
          <div className="absolute inset-0 border-t border-primary/20"></div>
          <div className="absolute inset-0 border-b border-primary/20 transform scale-y-50"></div>
          <Terminal className="h-16 w-16 text-primary/20" />
        </div>
        <p className="mt-8 font-mono text-xs tracking-[0.2em] uppercase text-muted-foreground">等待输入指令...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-xs text-muted-foreground">
          ID: {latestResult.id.slice(0, 8)} · {latestResult.provider.toUpperCase()}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onClearResults}
          className="h-7 text-xs border-border rounded-none font-mono hover:bg-destructive/20 hover:text-destructive hover:border-destructive transition-colors"
        >
          <Trash2 className="h-3 w-3 mr-2" /> 清空结果
        </Button>
        {latestResult.images.length >= 2 && onCompare && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-border rounded-none font-mono"
            onClick={onCompare}
          >
            对比前两张
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {latestResult.images.map((image, idx) => (
          <div key={idx} className="group relative bg-white border border-border overflow-hidden hover:border-primary transition-colors duration-500">
            <div className="max-h-[70vh] overflow-auto bg-gradient-to-br from-white via-white to-muted/30">
              <Image
                src={image}
                alt="Generated"
                width={resultImageSize.width || 1024}
                height={resultImageSize.height || 1024}
                className="w-full h-auto block"
                unoptimized
              />
            </div>

            {/* Overlay UI */}
            <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6 pointer-events-none">
              <div className="flex gap-3 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 pointer-events-auto">
                <Button
                  size="icon"
                  className="rounded-none bg-primary text-primary-foreground hover:bg-black hover:text-white"
                  onClick={() =>
                    onOpenImage({
                      src: image,
                      width: resultImageSize.width || 1024,
                      height: resultImageSize.height || 1024,
                      index: idx,
                      images: latestResult.images,
                    })
                  }
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                {onEdit && (
                  <Button
                    size="icon"
                    className="rounded-none border border-black text-black hover:bg-black hover:text-white"
                    onClick={() => onEdit(image)}
                  >
                    <Sparkles className="h-4 w-4" />
                  </Button>
                )}
                <Button size="icon" className="rounded-none border border-black text-black hover:bg-black hover:text-white" onClick={() => onDownload(image)}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Corner Accents */}
            <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-black/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-black/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-black/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-black/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
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
    <div className="border border-border bg-white/40 backdrop-blur-sm">
      <div className="flex items-center justify-between pr-4 py-3 border-b border-border">
        <div className="flex items-center gap-3 pl-4">
          <Checkbox
            checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
            onCheckedChange={(checked) => onToggleAll(Boolean(checked))}
            className="h-4 w-4"
            aria-label="全选"
          />
          <span className="text-xs font-mono text-muted-foreground">
            {selectedIds.size}/{filteredHistory.length} 已选
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onBatchDownload && (
            <Button
              size="sm"
              variant="outline"
              disabled={selectedIds.size === 0}
              className="rounded-none"
              onClick={() => onBatchDownload(Array.from(selectedIds))}
            >
              <Package className="h-4 w-4 mr-2" />
              批量下载
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={selectedIds.size === 0}
            className="rounded-none border-destructive text-destructive hover:bg-destructive hover:text-white"
            onClick={onDeleteSelected}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            批量删除
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader className="bg-muted/20">
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-[36px] pl-4"></TableHead>
            <TableHead className="font-mono text-xs text-primary">ID</TableHead>
            <TableHead className="font-mono text-xs text-primary">预览</TableHead>
            <TableHead className="font-mono text-xs text-primary">提示词</TableHead>
            <TableHead className="font-mono text-xs text-primary text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredHistory.map((item) => (
            <TableRow
              key={item.id}
              className="border-border hover:bg-primary/5 group cursor-pointer"
              onClick={() => onSelectItem(item)}
            >
              <TableCell className="w-[36px] pl-4 align-middle" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={(checked) => onToggleRow(item.id, Boolean(checked))}
                  className="h-4 w-4"
                  aria-label={`选择 ${item.id}`}
                />
              </TableCell>
              <TableCell
                className="font-mono text-[10px] text-muted-foreground"
                onClick={() => onSelectItem(item)}
              >
                {item.id.slice(0, 6)}
              </TableCell>
              <TableCell>
                {item.images[0] ? (
                  <div className="w-12 h-12 relative bg-muted group/image cursor-pointer overflow-hidden">
                    <Image 
                      src={item.images[0]} 
                      alt=""
                      fill
                      className="object-cover transition-transform group-hover/image:scale-110"
                      unoptimized
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectItem(item)
                      }}
                    />
                    {item.images.length > 1 && (
                      <div className="absolute top-0 right-0 bg-black/60 text-white text-[10px] px-1 font-mono">
                        +{item.images.length - 1}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-12 h-12 relative bg-muted"></div>
                )}
              </TableCell>
              <TableCell className="max-w-[200px]">
                <p className="truncate font-mono text-xs text-foreground">{item.params.prompt}</p>
                <p className="text-[10px] text-muted-foreground uppercase mt-1">
                  {item.provider} :: {item.params.modelId}
                </p>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {onToggleFavorite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleFavorite(item.id, !item.isFavorite)
                      }}
                      className={cn(
                        "h-7 w-7",
                        item.isFavorite ? "text-yellow-500 hover:text-yellow-600" : "hover:text-yellow-500"
                      )}
                    >
                      <Star className={cn("h-4 w-4", item.isFavorite && "fill-current")} />
                    </Button>
                  )}
                  {onRegenerate && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRegenerate(item)
                      }}
                      className="h-7 w-7 hover:text-primary"
                      title="用此参数重新生成"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                  {onApplyParams && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        onApplyParams(item)
                      }}
                      className="h-7 w-7 hover:text-primary/80"
                      title="填入表单以微调"
                    >
                      <ChevronsUpDown className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteItem(item.id)
                    }}
                    className="h-7 w-7 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {filteredHistory.length === 0 && (
        <div className="p-12 text-center font-mono text-xs text-muted-foreground">
          暂无生成记录
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
    setInitialParams({ ...item.params, providerId: item.provider.toLowerCase() })
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
    <div className="min-h-screen bg-background text-foreground font-sans overflow-hidden flex flex-col lg:flex-row">
      {/* LEFT PANEL: CONTROLS */}
      <aside className="w-full lg:w-[450px] flex flex-col border-r border-border bg-sidebar/50 backdrop-blur-md h-screen overflow-hidden relative z-10">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-sidebar/80">
            <div className="flex items-center gap-3">
            {onBack && (
                <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-primary/20 hover:text-primary rounded-none">
                <ArrowLeft className="h-5 w-5" />
                </Button>
            )}
            <div>
                <h1 className="text-2xl font-mono font-black tracking-tighter text-primary glitch-text uppercase">
                Cyber<span className="text-foreground">Gen</span>
                </h1>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono uppercase">
                    <span className="w-2 h-2 bg-green-500 animate-pulse rounded-full"></span>
                    系统在线
                </div>
            </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setForceOnboarding(true)
                  setDismissedOnboarding(false)
                }}
                className="rounded-none hover:bg-primary/20 text-primary"
                title="查看新手引导"
              >
                <Sparkles className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSettingsTab(undefined)
                  setSettingsOpen(true)
                }}
                className="rounded-none hover:bg-primary/20 text-primary"
                title="打开设置"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>
        </div>

        {/* Scrollable Form Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
            {/* Mode Switcher - Cyber Style */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/30 border border-border">
                <button
                    onClick={() => changeMode("txt2img")}
                    className={cn(
                        "py-2 text-xs font-mono font-bold uppercase tracking-wider transition-all duration-300",
                        mode === "txt2img" 
                            ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(var(--primary),0.5)]" 
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    文本模式
                </button>
                <button
                    onClick={() => changeMode("img2img")}
                    className={cn(
                        "py-2 text-xs font-mono font-bold uppercase tracking-wider transition-all duration-300",
                        mode === "img2img" 
                            ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(var(--primary),0.5)]" 
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    图生图
                </button>
            </div>

            {/* Image Upload Area (kept mounted to avoid costly remounts when toggling modes) */}
            <div
              className={cn(
                "border border-dashed border-primary/50 bg-primary/5 p-6 relative group transition-all hover:bg-primary/10",
                mode === "img2img" ? "block" : "hidden"
              )}
            >
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary"></div>
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-primary"></div>
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-primary"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary"></div>
              
              <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center cursor-pointer gap-3"
              >
                  <Upload className="h-8 w-8 text-primary animate-pulse" />
                  <div className="text-center">
                      <p className="text-xs font-mono text-primary font-bold">上传源图</p>
                      <p className="text-[10px] text-muted-foreground mt-1">已上传 {upload.images.length} 张</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        支持点击上传或 <kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Ctrl+V</kbd> 粘贴
                      </p>
                  </div>
              </div>
               <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                    if(e.target.files) addImages(Array.from(e.target.files))
                }}
              />
              {/* Preview Thumbnails */}
              {upload.images.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-4">
                      {upload.images.map((img) => (
                          <div key={img.id} className="relative aspect-square border border-border bg-white">
                              <Image src={img.preview} alt="" fill className="object-cover opacity-70 hover:opacity-100 transition-opacity" />
                              <button 
                                  onClick={(e) => { e.stopPropagation(); upload.removeImage(img.id) }}
                                  className="absolute top-0 right-0 bg-destructive text-white p-0.5"
                              >
                                  <X className="h-3 w-3" />
                              </button>
                          </div>
                      ))}
                  </div>
              )}
            </div>

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
                onOpenSettings={(tab) => {
                  setSettingsTab(tab)
                  setSettingsOpen(true)
                }}
            />
        </div>
      </aside>

      {/* RIGHT PANEL: VISUALIZATION */}
      <main className="flex-1 bg-background relative overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            {/* Background Grid */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#e5e5e5_1px,transparent_1px),linear-gradient(to_bottom,#e5e5e5_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] opacity-50"></div>
            
            {/* Top Bar */}
            <div className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 z-20 shrink-0">
                <div className="flex items-center gap-4">
                    <TabsList className="bg-transparent p-0 gap-4 h-auto">
                        <TabsTrigger value="generate" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-2 font-mono text-xs tracking-widest">
                            实时视图
                        </TabsTrigger>
                        <TabsTrigger value="history" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-2 font-mono text-xs tracking-widest">
                            生成日志
                        </TabsTrigger>
                    </TabsList>
                </div>
                
                {isGenerating && (
                    <div className="flex items-center gap-2 text-primary font-mono text-xs animate-pulse">
                        <Cpu className="h-4 w-4" />
                        <span>正在处理...</span>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 z-10 relative">
              {queueStatus.tasks.length > 0 && (
                <div className="mb-6">
                  <TaskStatusPanel
                    tasks={queueStatus.tasks}
                    onCancel={cancelGeneration}
                  />
                </div>
              )}
              <TabsContent value="generate" className="m-0">
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

              <TabsContent value="history" className="h-full m-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <div className="text-xs text-muted-foreground font-mono space-x-2">
                    <span>共 {history.length} 条</span>
                    {historySearch.trim() && <span>筛选出 {filteredHistory.length} 条</span>}
                    {selectedHistoryIds.size > 0 && (
                      <span className="text-primary">已选 {selectedHistoryIds.size} 条</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative">
                      <Input
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        placeholder="搜索模型/提示词/供应商..."
                        className="pr-8 h-9"
                      />
                      {historySearch && (
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                          onClick={() => setHistorySearch("")}
                          aria-label="清空搜索"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <Button
                      variant={historyFilters.favoritesOnly ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        setHistoryFilters((prev) => ({ ...prev, favoritesOnly: !prev.favoritesOnly }))
                      }
                    >
                      只看收藏
                    </Button>
                    <Button
                      variant={historyFilters.minRating ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        setHistoryFilters((prev) => ({
                          ...prev,
                          minRating: prev.minRating ? null : 4,
                        }))
                      }
                    >
                      {historyFilters.minRating ? `评分≥${historyFilters.minRating}` : "评分筛选"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAllHistory}
                      className="text-red-600 hover:text-red-700"
                    >
                      清空全部
                    </Button>
                  </div>
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
            </div>
        </Tabs>
      </main>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        activeTab={settingsTab}
        onTabChange={setSettingsTab}
      />

      {showOnboarding && (
        <OnboardingWizard
          hasEnabledProviders={hasEnabledProviders}
          onComplete={(finalized) => {
            if (finalized) {
              completeOnboarding()
            } else {
              setDismissedOnboarding(true)
            }
            setForceOnboarding(false)
          }}
          onOpenSettings={() => {
            setSettingsOpen(true)
            setSettingsTab(undefined)
          }}
          onSelectExample={(example) => {
            setInitialPrompt(example.prompt)
            setInitialParams({ prompt: example.prompt, images: undefined })
            changeMode(example.mode)
            completeOnboarding()
          }}
        />
      )}
      
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-screen-xl border-primary/50 bg-black/90 p-0 backdrop-blur-xl overflow-hidden outline-none" onKeyDown={(e) => {
            if (!selectedImage || !selectedImage.images || selectedImage.images.length <= 1) return
            if (e.key === "ArrowLeft") {
                const newIndex = (selectedImage.index - 1 + selectedImage.images.length) % selectedImage.images.length
                setSelectedImage({ ...selectedImage, src: selectedImage.images[newIndex], index: newIndex })
            } else if (e.key === "ArrowRight") {
                const newIndex = (selectedImage.index + 1) % selectedImage.images.length
                setSelectedImage({ ...selectedImage, src: selectedImage.images[newIndex], index: newIndex })
            }
        }}>
             <DialogTitle className="sr-only">预览</DialogTitle>
             <DialogDescription className="sr-only">图片预览</DialogDescription>
             {selectedImage && (
                 <div className="relative w-full h-[85vh] flex items-center justify-center bg-[url('/grid.svg')] bg-repeat opacity-100">
                     <div className="absolute inset-0 bg-black/40 pointer-events-none"></div>
                     <Image 
                        src={selectedImage.src} 
                        alt="Full Preview" 
                        width={selectedImage.width} 
                        height={selectedImage.height}
                        className="max-h-full max-w-full object-contain shadow-[0_0_50px_rgba(var(--primary),0.3)] relative z-10"
                        unoptimized
                    />
                    
                    {/* Top Bar */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-20">
                        <div className="flex items-center gap-2 text-primary font-mono text-xs">
                            <span className="w-2 h-2 bg-primary animate-pulse"></span>
                            {selectedImage.width} x {selectedImage.height}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-primary hover:text-primary-foreground hover:bg-primary rounded-none border border-primary/30 h-8 w-8"
                                onClick={() => handleDownload(selectedImage.src)}
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-primary hover:text-primary-foreground hover:bg-primary rounded-none border border-primary/30 h-8 w-8"
                                onClick={() => setSelectedImage(null)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {selectedImage.images && selectedImage.images.length > 1 && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-none border border-primary/30 bg-black/40 hover:bg-primary/20 text-primary backdrop-blur-sm z-20 transition-all hover:scale-110"
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
                                className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-none border border-primary/30 bg-black/40 hover:bg-primary/20 text-primary backdrop-blur-sm z-20 transition-all hover:scale-110"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    const newIndex = (selectedImage.index + 1) % selectedImage.images.length
                                    setSelectedImage({ ...selectedImage, src: selectedImage.images[newIndex], index: newIndex })
                                }}
                            >
                                <ChevronRight className="h-8 w-8" />
                            </Button>
                            
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                                <div className="px-4 py-1 border border-primary/30 bg-black/60 backdrop-blur-md text-primary text-xs font-mono tracking-widest uppercase">
                                    IMG_0{selectedImage.index + 1} / 0{selectedImage.images.length}
                                </div>
                            </div>
                        </>
                    )}
                    
                    {/* Decorative Corners */}
                    <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-primary pointer-events-none z-10"></div>
                    <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-primary pointer-events-none z-10"></div>
                    <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-primary pointer-events-none z-10"></div>
                    <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-primary pointer-events-none z-10"></div>
                 </div>
             )}
        </DialogContent>
      </Dialog>

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
                  <p className="text-sm text-muted-foreground">{selectedHistoryItem.params.prompt}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">生成信息</h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>提供商: {selectedHistoryItem.provider}</p>
                    <p>模型: {selectedHistoryItem.params.modelId || "—"}</p>
                    <p>图片数量: {selectedHistoryItem.images.length} 张</p>
                    <p>生成时间: {new Date(selectedHistoryItem.timestamp).toLocaleString("zh-CN")}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApplyParams(selectedHistoryItem)}
                    >
                      填入表单
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setVariantBaseParams({ ...(selectedHistoryItem.params as GenerationParams), providerId: selectedHistoryItem.provider.toLowerCase() })
                        setVariantDialogOpen(true)
                      }}
                    >
                      生成变体
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">评分与标签</h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Button
                        key={n}
                        size="sm"
                        variant={detailRating === n ? "default" : "outline"}
                        onClick={() => setDetailRating(n)}
                        className="h-8 w-8 p-0"
                      >
                        {n}★
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDetailRating(null)}
                    >
                      清除
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await updateRating(selectedHistoryItem.id, detailRating)
                        await refreshHistory()
                        toast({ title: "已保存评分" })
                      }}
                    >
                      保存评分
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      value={detailTags}
                      onChange={(e) => setDetailTags(e.target.value)}
                      placeholder="添加标签，逗号分隔"
                      className="w-64"
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        const tags = detailTags
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean)
                        await updateTags(selectedHistoryItem.id, tags)
                        await refreshHistory()
                        toast({ title: "已保存标签" })
                      }}
                    >
                      保存标签
                    </Button>
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
                            setSelectedImage({ 
                                src: image, 
                                width, 
                                height,
                                index: index,
                                images: selectedHistoryItem.images
                            })
                          }}
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover/image-detail:opacity-100 transition-opacity flex gap-2">
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedImage({ 
                                  src: image, 
                                  width, 
                                  height,
                                  index: index,
                                  images: selectedHistoryItem.images
                              })
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

      <ImageEditorDialog
        imageSrc={editingImage?.src || ""}
        open={!!editingImage}
        onOpenChange={(open) => {
          if (!open) setEditingImage(null)
        }}
        onSave={async (editedUrl) => {
          try {
            const res = await fetch(editedUrl)
            const blob = await res.blob()
            const file = new File([blob], `edited-${Date.now()}.png`, { type: "image/png" })
            upload.addImages([file])
            setMode("img2img")
            toast({ title: "已添加到图生图输入", description: "编辑后的图片已放入上传区" })
          } catch (error) {
            console.error(error)
            toast({ title: "添加失败", description: "无法将编辑结果加入输入", variant: "destructive" })
          } finally {
            setEditingImage(null)
          }
        }}
      />

      <ImageComparisonView
        items={comparisonItems}
        open={comparisonOpen}
        onOpenChange={setComparisonOpen}
        onDownload={handleDownload}
      />

      {variantBaseParams && (
        <VariantGeneratorDialog
          baseParams={variantBaseParams}
          open={variantDialogOpen}
          onOpenChange={(open) => {
            setVariantDialogOpen(open)
            if (!open) {
              setVariantBaseParams(null)
            }
          }}
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
