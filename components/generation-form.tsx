"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Check,
  ChevronsUpDown,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Wand2,
  Loader2,
  Clock,
  Trash2,
  Download,
} from "lucide-react"
import { useProviderSettings } from "@/hooks/use-provider-settings"
import { useToast } from "@/hooks/use-toast"
import { useGenerationHistory, type GenerationHistoryItem } from "@/hooks/use-generation-history"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import type { ProviderConfig } from "@/lib/providers"
import type { GenerationParams, GenerationResult } from "@/lib/api-client"
import { useFalModels, prefetchFalModels } from "@/hooks/use-fal-models"
import { useNewApiModels } from "@/hooks/use-newapi-models"
import { useOpenRouterModels } from "@/hooks/use-openrouter-models"
import { useGeminiModels } from "@/hooks/use-gemini-models"
import { cn } from "@/lib/utils"
import {
  DEFAULT_FAL_MODEL_ID,
  getFalBaseModelId,
  getFalModelCapability,
  resolveFalModelIdForMode,
} from "@/lib/fal-capabilities"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { OpenAISettingsSection } from "@/components/openai/openai-settings-section"
import { NewAPISettingsSection } from "@/components/newapi/newapi-settings-section"
import {
  buildOpenAIHistoryMetadata,
  buildOpenAIHistoryParams,
  getOpenAIImageSizeOptions,
  getOpenAIModelOptions,
  getOpenAIResponsesModes,
  getOpenAINumImages,
  OPENAI_ENDPOINT_PROFILE_KEY,
  OPENAI_IMAGE_ENDPOINT_DEFAULT,
  OPENAI_RESPONSES_ENDPOINT_DEFAULT,
  type OpenAIModelMode,
  type OpenAIResponsesMode,
} from "@/lib/openai-form-utils"
import {
  getNewApiImageSizeOptions,
  getNewApiSafeNumImages,
  getNewApiSafeQuality,
  isNewApiGeminiModel,
  isNewApiOpenAICompatModel,
  supportsNewApiBackground,
  supportsNewApiEdits,
  supportsNewApiModeration,
  supportsNewApiStyle,
  type NewApiBackground,
  type NewApiModeration,
} from "@/lib/newapi-openai-compat"
import type { OpenAIApiMode, GenerationOperationType, OpenAIResponseChainMetadata } from "@/hooks/use-generation-history"

function normalizeEndpointValue(value: string, fallback: string) {
  const trimmed = value.trim()
  return trimmed.length ? trimmed : fallback
}

function inferOpenAIMode(endpoint: string): OpenAIModelMode {
  if (!endpoint) return "image"
  return endpoint.includes("/responses") ? "responses" : "image"
}

function loadOpenAIEndpointProfile() {
  if (typeof window === "undefined") {
    return {
      mode: "image" as OpenAIModelMode,
      imageEndpoint: OPENAI_IMAGE_ENDPOINT_DEFAULT,
      responsesEndpoint: OPENAI_RESPONSES_ENDPOINT_DEFAULT,
    }
  }
  try {
    const raw = localStorage.getItem(OPENAI_ENDPOINT_PROFILE_KEY)
    if (!raw) throw new Error("no-profile")
    const parsed = JSON.parse(raw) as {
      mode?: OpenAIModelMode
      imageEndpoint?: string
      responsesEndpoint?: string
    }
    return {
      mode: parsed.mode === "responses" ? "responses" : "image",
      imageEndpoint: normalizeEndpointValue(parsed.imageEndpoint || "", OPENAI_IMAGE_ENDPOINT_DEFAULT),
      responsesEndpoint: normalizeEndpointValue(parsed.responsesEndpoint || "", OPENAI_RESPONSES_ENDPOINT_DEFAULT),
    }
  } catch {
    return {
      mode: "image" as OpenAIModelMode,
      imageEndpoint: OPENAI_IMAGE_ENDPOINT_DEFAULT,
      responsesEndpoint: OPENAI_RESPONSES_ENDPOINT_DEFAULT,
    }
  }
}

interface GenerationFormProps {
  mode: "img2img" | "txt2img"
  images?: File[]
  isGenerating: boolean
  onReset?: () => void
  resetSignal?: number
  onGenerate: (provider: ProviderConfig, params: GenerationParams) => Promise<GenerationResult>
  initialPrompt?: string
  onPromptSet?: () => void
  initialParams?: Partial<GenerationParams>
  onOpenSettings?: (tab?: string) => void
  onImagesChange?: (files: File[]) => void
  onModeChange?: (mode: "img2img" | "txt2img") => void
}

export function GenerationForm({
  mode,
  images = [],
  isGenerating,
  onGenerate,
  onReset,
  resetSignal,
  initialPrompt,
  onPromptSet,
  initialParams,
  onOpenSettings,
  onImagesChange,
  onModeChange,
}: GenerationFormProps) {
  // 注意：为避免服务端/客户端初始 HTML 不一致导致的 Hydration 报错
  // 这里不在初始 state 读取 localStorage，而是统一在后续 effect 中恢复

  const [prompt, setPrompt] = useState(initialPrompt || "")
  const [selectedProvider, setSelectedProvider] = useState("fal")
  const [imageSizeSelection, setImageSizeSelection] = useState("square")
  const [numImages, setNumImages] = useState(1)
  const [seed, setSeed] = useState<number | undefined>()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [safetyChecker, setSafetyChecker] = useState(true)
  const [syncMode, setSyncMode] = useState(true)
  const [selectedFalModel, setSelectedFalModel] = useState<string>(DEFAULT_FAL_MODEL_ID)
  const falModelByCategoryRef = useRef<Record<string, string>>({
    "text-to-image": DEFAULT_FAL_MODEL_ID,
    "image-to-image": DEFAULT_FAL_MODEL_ID,
  })
  const [isFalModelPopoverOpen, setIsFalModelPopoverOpen] = useState(false)
  const [falSearch, setFalSearch] = useState("")
  const falListRef = useRef<HTMLDivElement>(null)
  const falPrevSearchRef = useRef("")
  const prefetchedCategoriesRef = useRef<Set<string>>(new Set())
  const hasInitializedResetSignalRef = useRef(false)
  const prevResetSignalRef = useRef<number | undefined>(undefined)
  
  // NewAPI states
  const [selectedNewapiModel, setSelectedNewapiModel] = useState<string>("dall-e-2")
  const [isNewapiModelPopoverOpen, setIsNewapiModelPopoverOpen] = useState(false)
  const [newapiSearch, setNewapiSearch] = useState("")
  const newapiListRef = useRef<HTMLDivElement>(null)
  const newapiPrevSearchRef = useRef("")
  const [newapiQuality, setNewapiQuality] = useState<string>("standard")
  const [newapiStyle, setNewapiStyle] = useState<string>("vivid")
  const [newapiBackground, setNewapiBackground] = useState<NewApiBackground>("auto")
  const [newapiModeration, setNewapiModeration] = useState<NewApiModeration>("auto")
  // OpenAI states
  const [openAIMode, setOpenAIMode] = useState<OpenAIModelMode>("image")
  const [openAIModel, setOpenAIModel] = useState<string>("gpt-image-1.5")
  const [openAIImageQuality, setOpenAIImageQuality] = useState<"standard" | "hd">("standard")
  const [openAIImageStyle, setOpenAIImageStyle] = useState<"vivid" | "natural">("vivid")
  const [openAIResponsesMode, setOpenAIResponsesMode] = useState<OpenAIResponsesMode>("image")
  const [openAIResponsesMaxOutputTokens, setOpenAIResponsesMaxOutputTokens] = useState<number>(1024)
  const [openAIResponsesTemperature, setOpenAIResponsesTemperature] = useState<number>(1)
  const [openAIResponsesPreviousResponseId, setOpenAIResponsesPreviousResponseId] = useState<string | undefined>()
  const [customWidth, setCustomWidth] = useState<string>("")
  const [customHeight, setCustomHeight] = useState<string>("")
  const [customSizeApplied, setCustomSizeApplied] = useState<string | null>(null)
  const [customSizeFeedback, setCustomSizeFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  )
  const [customApplyState, setCustomApplyState] = useState<"idle" | "success" | "error">("idle")
  const [customSizeAppliedAt, setCustomSizeAppliedAt] = useState<string | null>(null)
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [enhanceAvailable, setEnhanceAvailable] = useState(false)
  
  // 历史记录状态
  const { history, addHistoryItem, deleteHistoryItem, clearHistory } = useGenerationHistory()
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [historyToDelete, setHistoryToDelete] = useState<string | null>(null)
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false)
  const [openAIEndpointProfile, setOpenAIEndpointProfile] = useState(loadOpenAIEndpointProfile())
  const openAIModelOptions = getOpenAIModelOptions(openAIMode)
  const openAIResponsesModeOptions = getOpenAIResponsesModes()



  useEffect(() => {
    fetch("/api/prompt/enhance")
      .then((r) => r.json())
      .then((d) => setEnhanceAvailable(!!d.available))
      .catch(() => setEnhanceAvailable(false))
  }, [])

  // 只保存用户主动应用的自定义尺寸，不包括预设尺寸
  const customAppliedValue = useMemo(() => {
    if (customSizeApplied) {
      return customSizeApplied.replace(/\s+/g, "").toLowerCase()
    }
    return null
  }, [customSizeApplied])

  // 判断是否应该显示自定义尺寸输入框
  const isCustomSelection = useMemo(() => {
    // 1. 用户明确选择了"自定义尺寸"选项
    if (imageSizeSelection === "custom") return true
    
    // 2. 用户应用了自定义尺寸后，继续保持显示（方便修改）
    if (customSizeApplied && imageSizeSelection === customSizeApplied) return true
    
    return false
  }, [imageSizeSelection, customSizeApplied])

  // OpenRouter states
  const [selectedOpenRouterModel, setSelectedOpenRouterModel] = useState<string>("google/gemini-2.5-flash-image")
  const [isOpenRouterModelPopoverOpen, setIsOpenRouterModelPopoverOpen] = useState(false)
  const [openrouterSearch, setOpenrouterSearch] = useState("")
  const openrouterListRef = useRef<HTMLDivElement>(null)
  const openrouterPrevSearchRef = useRef("")
  // Gemini 供应商状态
  const [selectedGeminiModel, setSelectedGeminiModel] = useState<string>("gemini-2.5-flash-image")
  const { models: geminiModels, isLoading: isLoadingGeminiModels } = useGeminiModels()
  
  // Gemini 专用参数（用于 NewAPI 的 Gemini 模型）
  const [geminiThinkingLevel, setGeminiThinkingLevel] = useState<"low" | "high">("high")
  const [geminiMediaResolution, setGeminiMediaResolution] = useState<
    "media_resolution_low" | "media_resolution_medium" | "media_resolution_high"
  >("media_resolution_medium")
  const [geminiAspectRatio, setGeminiAspectRatio] = useState<
    "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9"
  >("1:1")

  // FAL nano-banana-pro 专用参数
  const [falNanoBananaAspectRatio, setFalNanoBananaAspectRatio] = useState<
    "21:9" | "16:9" | "3:2" | "4:3" | "5:4" | "1:1" | "4:5" | "3:4" | "2:3" | "9:16"
  >("1:1")
  const [falNanoBananaResolution, setFalNanoBananaResolution] = useState<"1K" | "2K" | "4K">("2K")
  const [falNanoBananaOutputFormat, setFalNanoBananaOutputFormat] = useState<"jpeg" | "png" | "webp">("png")
  
  // FAL gemini-3-pro-image-preview (Nano Banana 2) 专用状态
  const [falGemini3ProAspectRatio, setFalGemini3ProAspectRatio] = useState<
    "21:9" | "16:9" | "3:2" | "4:3" | "5:4" | "1:1" | "4:5" | "3:4" | "2:3" | "9:16"
  >("1:1")
  const [falGemini3ProResolution, setFalGemini3ProResolution] = useState<"1K" | "2K" | "4K">("2K")
  const [falGemini3ProOutputFormat, setFalGemini3ProOutputFormat] = useState<"jpeg" | "png" | "webp">("png")

  // 根据外部传入的参数预填表单
  useEffect(() => {
    if (!initialParams) return
    if (initialParams.prompt !== undefined) {
      setPrompt(initialParams.prompt)
      onPromptSet?.()
    }
    const providerFromParams = (initialParams as any).providerId as string | undefined
    if (providerFromParams) {
      setSelectedProvider(providerFromParams)
    }
    if (initialParams.imageSize) {
      const size = initialParams.imageSize.toLowerCase()
      if (/^\d+\s*x\s*\d+$/.test(size)) {
        const [w, h] = size.split("x").map((v) => v.trim())
        setCustomWidth(w)
        setCustomHeight(h)
        setImageSizeSelection("custom")
        setCustomSizeApplied(`${w}x${h}`)
      } else {
        setImageSizeSelection(size)
      }
    }
    if (initialParams.numImages !== undefined) setNumImages(initialParams.numImages)
    if (initialParams.seed !== undefined) setSeed(initialParams.seed)
    if (initialParams.safetyChecker !== undefined) setSafetyChecker(initialParams.safetyChecker)
    if (initialParams.syncMode !== undefined) setSyncMode(initialParams.syncMode)
    if (initialParams.quality) setNewapiQuality(initialParams.quality as any)
    if (initialParams.style) setNewapiStyle(initialParams.style as any)
    if (initialParams.background) setNewapiBackground(initialParams.background as NewApiBackground)
    if (initialParams.moderation) setNewapiModeration(initialParams.moderation as NewApiModeration)
    if (initialParams.thinkingLevel) setGeminiThinkingLevel(initialParams.thinkingLevel)
    if (initialParams.mediaResolution) setGeminiMediaResolution(initialParams.mediaResolution)
    if (initialParams.aspectRatio) setGeminiAspectRatio(initialParams.aspectRatio as any)
    if (initialParams.falNanoBananaAspectRatio) setFalNanoBananaAspectRatio(initialParams.falNanoBananaAspectRatio)
    if (initialParams.falNanoBananaResolution) setFalNanoBananaResolution(initialParams.falNanoBananaResolution)
    if (initialParams.falNanoBananaOutputFormat) setFalNanoBananaOutputFormat(initialParams.falNanoBananaOutputFormat)
    if (initialParams.falGemini3ProAspectRatio) setFalGemini3ProAspectRatio(initialParams.falGemini3ProAspectRatio)
    if (initialParams.falGemini3ProResolution) setFalGemini3ProResolution(initialParams.falGemini3ProResolution)
    if (initialParams.falGemini3ProOutputFormat) setFalGemini3ProOutputFormat(initialParams.falGemini3ProOutputFormat)
    if (initialParams.modelId) {
      if (providerFromParams === "fal") {
        setSelectedFalModel(getFalBaseModelId(initialParams.modelId))
      } else if (providerFromParams === "newapi") {
        setSelectedNewapiModel(initialParams.modelId)
      } else if (providerFromParams === "openrouter") {
        setSelectedOpenRouterModel(initialParams.modelId)
      } else if (providerFromParams === "openai") {
        setOpenAIModel(initialParams.modelId)
      }
    }

    const openaiExtra = initialParams as Record<string, unknown>
    if (providerFromParams === "openai") {
      const mappedMode =
        openaiExtra.openaiMode === "responses-api" ||
        openaiExtra.openaiApiMode === "responses" ||
        openaiExtra.openAIApiMode === "responses"
          ? "responses"
          : "image"

      setOpenAIMode(mappedMode)
      setOpenAIImageQuality((openaiExtra.openAIImageQuality as "standard" | "hd") || "standard")
      setOpenAIImageStyle((openaiExtra.openAIImageStyle as "vivid" | "natural") || "vivid")
      setOpenAIResponsesMode((openaiExtra.openAIResponsesMode as OpenAIResponsesMode) || "image")

      if (typeof openaiExtra.openAIResponsesMaxOutputTokens === "number") {
        setOpenAIResponsesMaxOutputTokens(openaiExtra.openAIResponsesMaxOutputTokens)
      }

      if (typeof openaiExtra.openAIResponsesTemperature === "number") {
        setOpenAIResponsesTemperature(openaiExtra.openAIResponsesTemperature)
      }

      if (typeof openaiExtra.openAIResponseId === "string") {
        setOpenAIResponsesPreviousResponseId(openaiExtra.openAIResponseId)
      } else if (typeof openaiExtra.openaiPreviousResponseId === "string") {
        setOpenAIResponsesPreviousResponseId(openaiExtra.openaiPreviousResponseId)
      } else {
        setOpenAIResponsesPreviousResponseId(undefined)
      }
    }
  }, [initialParams, onPromptSet])

  const { getEnabledProviders: getEnabledProviderSettings, getProvider, settings } = useProviderSettings()
  const { toast } = useToast()
  const falCategory = mode === "img2img" ? "image-to-image" : "text-to-image"
  const falProvider = getProvider("fal")
  const newapiProvider = getProvider("newapi")
  const openrouterProvider = getProvider("openrouter")
  const openaiProvider = getProvider("openai")
  const openAIImageEndpoint = openAIEndpointProfile.imageEndpoint
  const openAIResponsesEndpoint = openAIEndpointProfile.responsesEndpoint
  const openAIEndpointByMode = useCallback(
    (mode: OpenAIModelMode) => {
      if (mode === "responses") {
        return normalizeEndpointValue(openAIResponsesEndpoint, OPENAI_RESPONSES_ENDPOINT_DEFAULT)
      }
      return normalizeEndpointValue(openAIImageEndpoint, OPENAI_IMAGE_ENDPOINT_DEFAULT)
    },
    [openAIImageEndpoint, openAIResponsesEndpoint],
  )
  const getCurrentOpenAIApiMode = useCallback((): "image" | "responses" => {
    return openAIMode === "responses" ? "responses" : "image"
  }, [openAIMode])
  const currentOpenAIMetadataMode = useMemo<OpenAIApiMode>(() => {
    return openAIMode === "responses" ? "responses-api" : "image-api"
  }, [openAIMode])
  const operationType = useMemo<GenerationOperationType>(() => {
    return mode === "img2img" ? "img2img" : "txt2img"
  }, [mode])

  useEffect(() => {
    setOpenAIEndpointProfile(loadOpenAIEndpointProfile())
  }, [])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === OPENAI_ENDPOINT_PROFILE_KEY) {
        setOpenAIEndpointProfile(loadOpenAIEndpointProfile())
      }
    }

    window.addEventListener("storage", handleStorage)
    return () => {
      window.removeEventListener("storage", handleStorage)
    }
  }, [])

  useEffect(() => {
    const safeMode = inferOpenAIMode(openaiProvider?.endpoint || "")
    setOpenAIMode(safeMode)
  }, [openaiProvider?.endpoint])
  const updateFalModel = useCallback(
    (modelId: string) => {
      const nextModelId = getFalBaseModelId(modelId)
      falModelByCategoryRef.current = {
        ...falModelByCategoryRef.current,
        [falCategory]: nextModelId,
      }
      setSelectedFalModel(nextModelId)
    },
    [falCategory],
  )
  // Restore last chosen FAL model per类别，在浏览器绘制前同步，避免切换时标签闪烁
  useLayoutEffect(() => {
    const saved = falModelByCategoryRef.current[falCategory]
    if (saved && saved !== selectedFalModel) {
      setSelectedFalModel(saved)
    }
  }, [falCategory, selectedFalModel])
  const openrouterEndpoint = openrouterProvider?.endpoint?.trim() || "https://openrouter.ai/api/v1"
  const customSizeValue = useMemo(() => {
    const width = Number.parseInt(customWidth.trim(), 10)
    const height = Number.parseInt(customHeight.trim(), 10)
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null
    if (width < 64 || height < 64) return null
    if (width > 4096 || height > 4096) return null
    return `${width}x${height}`
  }, [customWidth, customHeight])

  const handleFalSearchChange = useCallback((value: string) => {
    setFalSearch(value)
    falPrevSearchRef.current = value.trim()
  }, [])

  const handleNewapiSearchChange = useCallback((value: string) => {
    setNewapiSearch(value)
    newapiPrevSearchRef.current = value.trim()
  }, [])

  const handleOpenrouterSearchChange = useCallback((value: string) => {
    setOpenrouterSearch(value)
    openrouterPrevSearchRef.current = value.trim()
  }, [])

  // 搜索词变化时自动滚动到顶部
  useEffect(() => {
    if (falListRef.current) {
      falListRef.current.scrollTop = 0
    }
  }, [falSearch])

  useEffect(() => {
    if (newapiListRef.current) {
      newapiListRef.current.scrollTop = 0
    }
  }, [newapiSearch])

  useEffect(() => {
    if (openrouterListRef.current) {
      openrouterListRef.current.scrollTop = 0
    }
  }, [openrouterSearch])

  // Handle initial prompt from onboarding
  useEffect(() => {
    if (initialPrompt && initialPrompt !== prompt) {
      setPrompt(initialPrompt)
      onPromptSet?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt])

  const handleCustomWidthChange = useCallback(
    (value: string) => {
      setCustomWidth(value)
      if (customApplyState !== "idle") {
        setCustomApplyState("idle")
      }
      if (!value && !customHeight) {
        setCustomSizeFeedback(null)
      }
    },
    [customApplyState, customHeight],
  )

  const handleCustomHeightChange = useCallback(
    (value: string) => {
      setCustomHeight(value)
      if (customApplyState !== "idle") {
        setCustomApplyState("idle")
      }
      if (!customWidth && !value) {
        setCustomSizeFeedback(null)
      }
    },
    [customApplyState, customWidth],
  )

  const handleApplyCustomSize = useCallback(() => {
    const width = Number.parseInt(customWidth.trim(), 10)
    const height = Number.parseInt(customHeight.trim(), 10)

    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      setCustomSizeFeedback({ type: "error", message: "请填写自定义宽度和高度（整数）。" })
      setCustomApplyState("error")
      toast({
        title: "请输入宽高",
        description: "请填写自定义宽度和高度（整数）。",
        variant: "destructive",
      })
      return
    }

    if (width < 64 || height < 64 || width > 4096 || height > 4096) {
      setCustomSizeFeedback({ type: "error", message: "宽高需在 64 - 4096 之间。" })
      setCustomApplyState("error")
      toast({
        title: "尺寸超出范围",
        description: "宽高需在 64 - 4096 之间。",
        variant: "destructive",
      })
      return
    }

    const value = `${width}x${height}`
    const now = new Date().toLocaleTimeString()
    console.info("[CustomSize] apply click", { value, now })

    setImageSizeSelection(value)
    setCustomSizeApplied(value)
    setCustomSizeAppliedAt(now)
    setCustomSizeFeedback({ type: "success", message: `当前尺寸：${value.replace("x", " × ")}` })
    setCustomApplyState("success")
    toast({
      title: "已应用",
      description: value.replace("x", " × "),
    })
  }, [customHeight, customWidth, toast])

  const providerOptions = useMemo(() => {
    const enabledProviders = getEnabledProviderSettings()
    return enabledProviders.map((provider) => ({
      id: provider.id,
      label: provider.name,
    }))
  }, [getEnabledProviderSettings])

  const safeSelectedProvider = useMemo(() => {
    if (providerOptions.length === 0) return ""
    return providerOptions.some((option) => option.id === selectedProvider)
      ? selectedProvider
      : providerOptions[0].id
  }, [providerOptions, selectedProvider])
  const shouldLoadFalModels = safeSelectedProvider === "fal"
  const shouldLoadNewApiModels = safeSelectedProvider === "newapi"
  const shouldLoadOpenRouterModels = safeSelectedProvider === "openrouter"
  const {
    models: falModels,
    isLoading: isLoadingFalModels,
    isRefreshing: isRefreshingFalModels,
    lastUpdatedAt: falModelsUpdatedAt,
    error: falModelsError,
    refresh: refreshFalModels,
  } = useFalModels({
    category: falCategory,
    apiKey: falProvider?.apiKey,
    enabled: shouldLoadFalModels,
  })
  const {
    models: newapiModels,
    isLoading: isLoadingNewApiModels,
    isRefreshing: isRefreshingNewApiModels,
    lastUpdatedAt: newapiModelsUpdatedAt,
    refresh: refreshNewApiModels,
  } = useNewApiModels({
    apiKey: newapiProvider?.apiKey,
    endpoint: newapiProvider?.endpoint,
    enabled: shouldLoadNewApiModels,
  })
  const {
    models: openrouterModels,
    isLoading: isLoadingOpenRouterModels,
    isRefreshing: isRefreshingOpenRouterModels,
    lastUpdatedAt: openrouterModelsUpdatedAt,
    refresh: refreshOpenRouterModels,
  } = useOpenRouterModels({
    apiKey: openrouterProvider?.apiKey,
    endpoint: openrouterEndpoint,
    enabled: shouldLoadOpenRouterModels && openrouterProvider?.enabled,
  })
  const deferredFalModels = useDeferredValue(falModels)
  const hasFalModels = deferredFalModels.length > 0
  const effectiveFalModelId = useMemo(
    () => resolveFalModelIdForMode(selectedFalModel, mode),
    [mode, selectedFalModel],
  )
  const selectedFalCapability = useMemo(
    () => getFalModelCapability(selectedFalModel, mode),
    [mode, selectedFalModel],
  )
  const selectedFalModelOption = useMemo(
    () =>
      deferredFalModels.find((model) => model.id === selectedFalModel) ||
      deferredFalModels.find((model) => model.id === effectiveFalModelId),
    [deferredFalModels, effectiveFalModelId, selectedFalModel],
  )
  
  // 辅助函数：检查当前是否选中 nano-banana-pro（能力驱动）
  const isNanoBananaProSelected = useMemo(
    () => safeSelectedProvider === "fal" && selectedFalCapability.specialConfig === "nano-banana-pro",
    [safeSelectedProvider, selectedFalCapability.specialConfig]
  )
  
  // 辅助函数：检查当前是否选中 gemini-3-pro-image-preview（能力驱动）
  const isGemini3ProPreviewSelected = useMemo(
    () => safeSelectedProvider === "fal" && selectedFalCapability.specialConfig === "gemini-3-pro-image-preview",
    [safeSelectedProvider, selectedFalCapability.specialConfig]
  )
  
  const falModelButtonLabel =
    selectedFalModelOption?.title ??
    selectedFalModel ??
    (isLoadingFalModels ? "加载模型列表..." : hasFalModels ? "选择 FAL 模型" : "暂无可用模型")
  
  const deferredNewapiModels = useDeferredValue(newapiModels)
  const hasNewapiModels = deferredNewapiModels.length > 0
  const selectedNewapiModelOption = useMemo(
    () => deferredNewapiModels.find((model) => model.id === selectedNewapiModel),
    [deferredNewapiModels, selectedNewapiModel],
  )
  const newapiModelButtonLabel = isLoadingNewApiModels 
    ? "加载模型列表..." 
    : (selectedNewapiModel || (hasNewapiModels ? "选择 NewAPI 模型" : "dall-e-2"))

  const deferredOpenRouterModels = useDeferredValue(openrouterModels)
  const hasOpenRouterModels = deferredOpenRouterModels.length > 0
  const selectedOpenRouterModelOption = useMemo(
    () => deferredOpenRouterModels.find((model) => model.id === selectedOpenRouterModel),
    [deferredOpenRouterModels, selectedOpenRouterModel],
  )
  const openrouterModelButtonLabel = isLoadingOpenRouterModels 
    ? "加载模型列表..." 
    : (selectedOpenRouterModel || (hasOpenRouterModels ? "选择 OpenRouter 模型" : "google/gemini-2.5-flash-image"))

  const openAIParamsForHistory = useMemo(
    () =>
      buildOpenAIHistoryParams({
        openAIMode,
        openAIImageQuality,
        openAIImageStyle,
        openAIResponsesMode,
        openAIResponsesMaxOutputTokens,
        openAIResponsesTemperature,
        openAIResponsesPreviousResponseId,
      }),
    [
      openAIMode,
      openAIImageQuality,
      openAIImageStyle,
      openAIResponsesMode,
      openAIResponsesMaxOutputTokens,
      openAIResponsesPreviousResponseId,
      openAIResponsesTemperature,
    ],
  )

  const buildOpenAIHistoryMetadataByMode = useCallback(
    (providerOperationType: GenerationOperationType): OpenAIResponseChainMetadata => {
      return buildOpenAIHistoryMetadata({
        openAIEndpointByMode,
        openAIMode,
        openAIModel,
        openAIImageQuality,
        openAIImageStyle,
        openAIResponsesMode,
        openAIResponsesPreviousResponseId,
        openAIResponsesTemperature,
        openAIResponsesMaxOutputTokens,
        operationType: providerOperationType,
      })
    },
    [
      openAIEndpointByMode,
      openAIMode,
      openAIImageQuality,
      openAIImageStyle,
      openAIModel,
      openAIResponsesMode,
      openAIResponsesPreviousResponseId,
      openAIResponsesTemperature,
      openAIResponsesMaxOutputTokens,
    ],
  )

  useEffect(() => {
    if (safeSelectedProvider !== "openai") return
    const currentModeModels = getOpenAIModelOptions(openAIMode)
    if (currentModeModels.some((model) => model.value === openAIModel)) return
    setOpenAIModel(currentModeModels[0]?.value || "gpt-image-1")
  }, [safeSelectedProvider, openAIMode, openAIModel])
  const selectedOpenAIModelOption = useMemo(
    () => openAIModelOptions.find((model) => model.value === openAIModel),
    [openAIModel, openAIModelOptions],
  )
  const openAIModelLabel = selectedOpenAIModelOption?.label || openAIModel
    
  const falModelsUpdatedAtLabel = useMemo(() => {
    if (!falModelsUpdatedAt) return null
    const date = new Date(falModelsUpdatedAt)
    if (Number.isNaN(date.getTime())) {
      return null
    }
    try {
      return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date)
    } catch {
      return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date
        .getSeconds()
        .toString()
        .padStart(2, "0")}`
    }
  }, [falModelsUpdatedAt])

  const newapiModelsUpdatedAtLabel = useMemo(() => {
    if (!newapiModelsUpdatedAt) return null
    const date = new Date(newapiModelsUpdatedAt)
    if (Number.isNaN(date.getTime())) {
      return null
    }
    try {
      return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date)
    } catch {
      return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date
        .getSeconds()
        .toString()
        .padStart(2, "0")}`
    }
  }, [newapiModelsUpdatedAt])

  const openrouterModelsUpdatedAtLabel = useMemo(() => {
    if (!openrouterModelsUpdatedAt) return null
    const date = new Date(openrouterModelsUpdatedAt)
    if (Number.isNaN(date.getTime())) {
      return null
    }
    try {
      return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date)
    } catch {
      return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date
        .getSeconds()
        .toString()
        .padStart(2, "0")}`
    }
  }, [openrouterModelsUpdatedAt])

  const imageSizeOptions = useMemo(() => {
    if (safeSelectedProvider === "openai") {
      return getOpenAIImageSizeOptions({
        openAIMode,
        openAIModel,
        generationMode: mode,
        customAppliedValue,
      })
    }

    // NewAPI size options based on model
    if (safeSelectedProvider === "newapi") {
      const openAICompatSizeOptions = getNewApiImageSizeOptions({
        modelId: selectedNewapiModel,
        generationMode: mode,
        customAppliedValue,
      })
      if (openAICompatSizeOptions) {
        return openAICompatSizeOptions
      }

      if (selectedNewapiModel === "dall-e-2") {
        const options = [
          { value: "256x256", label: "小图 · 256 x 256" },
          { value: "512x512", label: "中图 · 512 x 512" },
          { value: "1024x1024", label: "大图 · 1024 x 1024" },
          { value: "custom", label: "自定义尺寸" },
        ]
        if (customAppliedValue && !options.some((o) => o.value === customAppliedValue)) {
          options.splice(options.length - 1, 0, { value: customAppliedValue, label: `自定义 · ${customAppliedValue.replace("x", " x ")}` })
        }
        return mode === "img2img"
          ? [{ value: "auto", label: "与原图相同（推荐）" }, ...options]
          : options
      }
      
      if (selectedNewapiModel === "dall-e-3") {
        const options = [
          { value: "1024x1024", label: "方形 · 1024 x 1024" },
          { value: "1792x1024", label: "横向 · 1792 x 1024" },
          { value: "1024x1792", label: "纵向 · 1024 x 1792" },
          { value: "custom", label: "自定义尺寸" },
        ]
        if (customAppliedValue && !options.some((o) => o.value === customAppliedValue)) {
          options.splice(options.length - 1, 0, { value: customAppliedValue, label: `自定义 · ${customAppliedValue.replace("x", " x ")}` })
        }
        return options
      }
      
      if (selectedNewapiModel === "gpt-image-1") {
        const options = [
          { value: "1024x1024", label: "方形 · 1024 x 1024" },
          { value: "1536x1024", label: "横向 · 1536 x 1024" },
          { value: "1024x1536", label: "纵向 · 1024 x 1536" },
          { value: "custom", label: "自定义尺寸" },
        ]
        if (customAppliedValue && !options.some((o) => o.value === customAppliedValue)) {
          options.splice(options.length - 1, 0, { value: customAppliedValue, label: `自定义 · ${customAppliedValue.replace("x", " x ")}` })
        }
        return mode === "img2img"
          ? [{ value: "auto", label: "与原图相同（推荐）" }, ...options]
          : options
      }
    }
    
    // FAL/OpenAI default options
    const baseOptions = [
      { value: "square", label: "方形 · 1024 x 1024" },
      { value: "landscape_4_3", label: "横向 · 1024 x 768" },
      { value: "landscape_16_9", label: "横向 · 1280 x 720" },
      { value: "portrait_4_3", label: "纵向 · 768 x 1024" },
      { value: "portrait_16_9", label: "纵向 · 720 x 1280" },
      { value: "512x512", label: "快速预览 · 512 x 512" },
      { value: "custom", label: "自定义尺寸" },
    ]
    if (customAppliedValue && !baseOptions.some((o) => o.value === customAppliedValue)) {
      baseOptions.splice(baseOptions.length - 1, 0, {
        value: customAppliedValue,
        label: `自定义 · ${customAppliedValue.replace("x", " x ")}`,
      })
    }

    if (mode === "img2img") {
      return [{ value: "auto", label: "与原图相同（推荐）" }, ...baseOptions]
    }

    return baseOptions
  }, [mode, safeSelectedProvider, selectedNewapiModel, customAppliedValue, openAIMode, openAIModel])

  const safeImageSizeSelection = useMemo(() => {
    const validSizes = imageSizeOptions.map((opt) => opt.value)
    let next = imageSizeSelection
    if (!validSizes.includes(next)) {
      next = imageSizeOptions[0]?.value || "square"
    }
    if (mode === "img2img" && next === "square") {
      next = "auto"
    }
    if (mode === "txt2img" && next === "auto") {
      next = imageSizeOptions.find((opt) => opt.value !== "auto")?.value || "square"
    }
    return next
  }, [imageSizeOptions, imageSizeSelection, mode])

  const effectiveImageSize = useMemo(() => {
    const selection = safeImageSizeSelection
    if (selection === "custom") {
      return customSizeValue ?? "1024x1024"
    }
    if (/^\d+\s*x\s*\d+$/i.test(selection)) {
      return selection.replace(/\s+/g, "").toLowerCase()
    }
    return selection
  }, [safeImageSizeSelection, customSizeValue])

  useEffect(() => {
    if (!shouldLoadFalModels || !falProvider || falModels.length === 0) {
      return
    }

    const targetCategory = mode === "img2img" ? "text-to-image" : "image-to-image"
    const signature = `${falProvider.apiKey || "anon"}:${targetCategory}`
    if (prefetchedCategoriesRef.current.has(signature)) {
      return
    }

    const prefetchPromise = prefetchFalModels(targetCategory, {
      apiKey: falProvider.apiKey,
      enabled: falProvider?.enabled,
    })
    prefetchedCategoriesRef.current.add(signature)

    prefetchPromise.catch(() => {
      prefetchedCategoriesRef.current.delete(signature)
    })
  }, [falModels.length, falProvider, mode, shouldLoadFalModels])
  
  // Auto-adjust NewAPI quality when model changes
  const safeNewapiQuality = useMemo(() => {
    if (safeSelectedProvider !== "newapi") return newapiQuality
    if (isNewApiOpenAICompatModel(selectedNewapiModel)) {
      return getNewApiSafeQuality(selectedNewapiModel, newapiQuality)
    }
    return newapiQuality
  }, [newapiQuality, selectedNewapiModel, safeSelectedProvider])
  
  const safeNumImages = useMemo(() => {
    if (safeSelectedProvider === "openai") {
      return getOpenAINumImages({
        openAIMode,
        openAIModel,
        numImages,
      })
    }
    if (safeSelectedProvider === "newapi" && isNewApiOpenAICompatModel(selectedNewapiModel)) {
      return getNewApiSafeNumImages(selectedNewapiModel, numImages)
    }
    return numImages
  }, [numImages, selectedNewapiModel, safeSelectedProvider, openAIMode, openAIModel])

  const resetForm = useCallback(() => {
    const providers = getEnabledProviderSettings()
    if (providers.length === 0) {
      setPrompt("")
      setImageSizeSelection("square")
      setCustomWidth("")
      setCustomHeight("")
      setCustomSizeApplied(null)
      setCustomSizeFeedback(null)
      setNumImages(1)
      setSeed(undefined)
      setSafetyChecker(true)
      setSyncMode(true)
      setGeminiThinkingLevel("high")
      setGeminiMediaResolution("media_resolution_high")
      setGeminiAspectRatio("1:1")
      falModelByCategoryRef.current = {
        "text-to-image": DEFAULT_FAL_MODEL_ID,
        "image-to-image": DEFAULT_FAL_MODEL_ID,
      }
      setSelectedFalModel(DEFAULT_FAL_MODEL_ID)
      setSelectedNewapiModel("dall-e-2")
      setNewapiQuality("standard")
      setNewapiStyle("vivid")
      setNewapiBackground("auto")
      setNewapiModeration("auto")
      setOpenAIMode("image")
      setOpenAIModel("gpt-image-1.5")
      setOpenAIImageQuality("standard")
      setOpenAIImageStyle("vivid")
      setOpenAIResponsesMode("image")
      setOpenAIResponsesMaxOutputTokens(1024)
      setOpenAIResponsesTemperature(1)
      setOpenAIResponsesPreviousResponseId(undefined)
      setSelectedProvider("")
      return
    }
    setPrompt("")
    setImageSizeSelection("square")
    setCustomWidth("")
    setCustomHeight("")
    setCustomSizeApplied(null)
    setCustomSizeFeedback(null)
    setNumImages(1)
    setSeed(undefined)
    setSafetyChecker(true)
    setSyncMode(true)
    setGeminiThinkingLevel("high")
    setGeminiMediaResolution("media_resolution_high")
    setGeminiAspectRatio("1:1")
    falModelByCategoryRef.current = {
      "text-to-image": DEFAULT_FAL_MODEL_ID,
      "image-to-image": DEFAULT_FAL_MODEL_ID,
    }
    setSelectedFalModel(DEFAULT_FAL_MODEL_ID)
    setSelectedNewapiModel("dall-e-2")
    setNewapiQuality("standard")
    setNewapiStyle("vivid")
    setNewapiBackground("auto")
    setNewapiModeration("auto")
    setOpenAIMode("image")
    setOpenAIModel("gpt-image-1.5")
    setOpenAIImageQuality("standard")
    setOpenAIImageStyle("vivid")
    setOpenAIResponsesMode("image")
    setOpenAIResponsesMaxOutputTokens(1024)
    setOpenAIResponsesTemperature(1)
    setOpenAIResponsesPreviousResponseId(undefined)
    setSelectedProvider((prev) => (providers.some((provider) => provider.id === prev) ? prev : providers[0]?.id || ""))
  }, [getEnabledProviderSettings])

  useEffect(() => {
    if (resetSignal === undefined) return
    
    // 初始化：记录初始值，不触发重置
    if (!hasInitializedResetSignalRef.current) {
      hasInitializedResetSignalRef.current = true
      prevResetSignalRef.current = resetSignal
      return
    }
    
    // 只有当 resetSignal 真正变化时才触发重置
    if (prevResetSignalRef.current === resetSignal) {
      return
    }
    
    prevResetSignalRef.current = resetSignal
    const frame = requestAnimationFrame(() => {
      resetForm()
    })
    return () => cancelAnimationFrame(frame)
  }, [resetSignal, resetForm])

  const currentOpenAIMode = useMemo<OpenAIApiMode>(
    () => (openAIMode === "responses" ? "responses-api" : "image-api"),
    [openAIMode],
  )
  const currentOperationType = useMemo<GenerationOperationType>(
    () => (mode === "img2img" ? "img2img" : "txt2img"),
    [mode],
  )
  const currentOpenAIChainMetadata = useMemo<OpenAIResponseChainMetadata | undefined>(() => {
    if (safeSelectedProvider !== "openai") return undefined

    return {
      endpoint: openAIEndpointByMode(openAIMode),
      modelId: openAIModel,
      openaiMode: currentOpenAIMode,
      operationType: currentOperationType,
      requestId: openAIMode === "responses" ? openAIResponsesPreviousResponseId : undefined,
      temperature: openAIMode === "responses" ? openAIResponsesTemperature : undefined,
      maxOutputTokens: openAIMode === "responses" ? openAIResponsesMaxOutputTokens : undefined,
      extras: {
        openAIImageQuality: openAIImageQuality,
        openAIImageStyle: openAIImageStyle,
        openAIResponsesMode: openAIResponsesMode,
      },
    }
  }, [
    currentOpenAIMode,
    currentOperationType,
    openAIEndpointByMode,
    openAIMode,
    openAIImageQuality,
    openAIImageStyle,
    openAIModel,
    openAIResponsesMaxOutputTokens,
    openAIResponsesMode,
    openAIResponsesPreviousResponseId,
    openAIResponsesTemperature,
    safeSelectedProvider,
  ])

  useEffect(() => {
    if (!falModels.length) return

    const currentPreferred = falModelByCategoryRef.current[falCategory] ?? selectedFalModel
    if (currentPreferred && falModels.some((model) => model.id === currentPreferred)) {
      if (currentPreferred !== selectedFalModel) {
        updateFalModel(currentPreferred)
      }
      return
    }

    let fallback: string | null = null

    if (!fallback) {
      fallback = falModels[0]?.id ?? DEFAULT_FAL_MODEL_ID
    }

    if (fallback) {
      updateFalModel(fallback)
    }
  }, [falModels, falCategory, safeSelectedProvider, selectedFalModel, updateFalModel])

  useEffect(() => {
    if (!newapiModels.length) return
    const frame = requestAnimationFrame(() => {
      setSelectedNewapiModel((prev) => {
        // If current selection exists in the list, keep it
        if (prev && newapiModels.some((model) => model.id === prev)) {
          return prev
        }

        // Otherwise select the first model
        return newapiModels[0]?.id ?? "dall-e-2"
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [newapiModels])

  useEffect(() => {
    if (!openrouterModels.length) return
    const frame = requestAnimationFrame(() => {
      setSelectedOpenRouterModel((prev) => {
        // If current selection exists in the list, keep it
        if (prev && openrouterModels.some((model) => model.id === prev)) {
          return prev
        }

        // Otherwise select the first model
        return openrouterModels[0]?.id ?? "google/gemini-2.5-flash-image"
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [openrouterModels])

  // 手动保存当前参数
  const saveCurrentParams = useCallback(async () => {
    if (!prompt.trim()) {
      toast({
        title: "无法保存",
        description: "提示词不能为空",
        variant: "destructive",
      })
      return
    }
    
    const enabledProviders = getEnabledProviderSettings()
    const provider = enabledProviders.find((p) => p.id === safeSelectedProvider)
    
    if (!provider) {
      toast({
        title: "无法保存",
        description: "请先选择一个供应商",
        variant: "destructive",
      })
      return
    }
    
    const modelId = provider.id === "fal"
      ? effectiveFalModelId
      : provider.id === "newapi"
      ? selectedNewapiModel
      : provider.id === "openrouter"
      ? selectedOpenRouterModel
      : provider.id === "gemini"
      ? selectedGeminiModel
      : provider.id === "openai"
      ? openAIModel
      : undefined
    
    // 如果是图生图模式，将上传的图片转换为 base64 保存
    let sourceImages: string[] | undefined
    if (mode === "img2img" && images.length > 0) {
      sourceImages = []
      for (const file of images) {
        try {
          const reader = new FileReader()
          const base64 = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(file)
          })
          sourceImages.push(base64)
        } catch (error) {
          console.error("转换图片失败:", error)
        }
      }
    }
    
    addHistoryItem({
      prompt,
      providerId: provider.id,
      modelId,
      sourceImages,
      params: {
        imageSize: effectiveImageSize,
        numImages: safeNumImages,
        seed: provider.id === "fal" && !selectedFalCapability.supportsSeed ? undefined : seed,
        safetyChecker:
          provider.id === "fal" && !selectedFalCapability.supportsSafetyChecker ? undefined : safetyChecker,
        syncMode: provider.id === "fal" && !selectedFalCapability.supportsSyncMode ? undefined : syncMode,
        quality: provider.id === "newapi" ? safeNewapiQuality : undefined,
        style: provider.id === "newapi" ? newapiStyle : undefined,
        background: provider.id === "newapi" && supportsNewApiBackground(selectedNewapiModel) ? newapiBackground : undefined,
        moderation: provider.id === "newapi" && supportsNewApiModeration(selectedNewapiModel) ? newapiModeration : undefined,
        thinkingLevel: (
          (provider.id === "newapi" && isNewApiGeminiModel(selectedNewapiModel)) ||
          (provider.id === "gemini" && selectedGeminiModel.includes("pro"))
        ) ? geminiThinkingLevel : undefined,
        mediaResolution: (
          (provider.id === "newapi" && isNewApiGeminiModel(selectedNewapiModel)) ||
          provider.id === "gemini"
        ) ? geminiMediaResolution : undefined,
        aspectRatio: (
          (provider.id === "newapi" && isNewApiGeminiModel(selectedNewapiModel)) ||
          provider.id === "gemini"
        ) ? geminiAspectRatio : undefined,
        falNanoBananaAspectRatio: isNanoBananaProSelected ? falNanoBananaAspectRatio : undefined,
        falNanoBananaResolution: isNanoBananaProSelected ? falNanoBananaResolution : undefined,
        falNanoBananaOutputFormat: isNanoBananaProSelected ? falNanoBananaOutputFormat : undefined,
        // FAL gemini-3-pro-image-preview (Nano Banana 2) 专用参数
        falGemini3ProAspectRatio: isGemini3ProPreviewSelected ? falGemini3ProAspectRatio : undefined,
        falGemini3ProResolution: isGemini3ProPreviewSelected ? falGemini3ProResolution : undefined,
        falGemini3ProOutputFormat: isGemini3ProPreviewSelected ? falGemini3ProOutputFormat : undefined,
        ...(provider.id === "openai" ? openAIParamsForHistory : {}),
      },
      openaiMode: provider.id === "openai" ? currentOpenAIMetadataMode : undefined,
      operationType: provider.id === "openai" ? operationType : undefined,
      responseChainMetadata: provider.id === "openai" ? buildOpenAIHistoryMetadataByMode(operationType) : undefined,
    })
    
    toast({
      title: "已保存参数",
      description: "当前配置已保存到历史记录",
    })
  }, [
    prompt,
    mode,
    images,
    safeSelectedProvider, 
    effectiveFalModelId,
    selectedNewapiModel,
    selectedOpenRouterModel,
    selectedGeminiModel,
    buildOpenAIHistoryMetadataByMode,
    currentOpenAIMetadataMode,
    operationType,
    openAIParamsForHistory,
    selectedFalCapability.supportsSafetyChecker,
    selectedFalCapability.supportsSeed,
    selectedFalCapability.supportsSyncMode,
    openAIModel,
    effectiveImageSize,
    safeNumImages,
    seed,
    safetyChecker,
    syncMode,
    safeNewapiQuality,
    newapiStyle,
    newapiBackground,
    newapiModeration,
    geminiThinkingLevel,
    geminiMediaResolution,
    geminiAspectRatio,
    isNanoBananaProSelected,
    falNanoBananaAspectRatio,
    falNanoBananaResolution,
    falNanoBananaOutputFormat,
    isGemini3ProPreviewSelected,
    falGemini3ProAspectRatio,
    falGemini3ProResolution,
    falGemini3ProOutputFormat,
    toast,
    getEnabledProviderSettings,
    addHistoryItem,
  ])

  // 加载历史记录参数
  const loadHistoryParams = useCallback(async (historyItem: GenerationHistoryItem) => {
    setPrompt(historyItem.prompt)
    setSelectedProvider(historyItem.providerId)
    
    if (historyItem.modelId) {
      if (historyItem.providerId === "fal") {
        updateFalModel(getFalBaseModelId(historyItem.modelId))
      } else if (historyItem.providerId === "newapi") {
        setSelectedNewapiModel(historyItem.modelId)
      } else if (historyItem.providerId === "openrouter") {
        setSelectedOpenRouterModel(historyItem.modelId)
      } else if (historyItem.providerId === "gemini") {
        setSelectedGeminiModel(historyItem.modelId)
      } else if (historyItem.providerId === "openai") {
        setOpenAIModel(historyItem.modelId)
      }
    }

    const resolvedOpenAIMode =
      historyItem.openaiMode === "responses-api"
        ? "responses"
        : historyItem.openaiMode === "image-api"
          ? "image"
          : historyItem.responseChainMetadata?.openaiMode === "responses-api"
            ? "responses"
            : historyItem.responseChainMetadata?.openaiMode === "image-api"
              ? "image"
              : historyItem.params && historyItem.params.openaiApiMode === "responses"
                ? "responses"
                : "image"

    if (historyItem.providerId === "openai") {
      setOpenAIMode(resolvedOpenAIMode)
      setOpenAIImageQuality((historyItem.params.openaiImageQuality as "standard" | "hd") || "standard")
      setOpenAIImageStyle((historyItem.params.openaiImageStyle as "vivid" | "natural") || "vivid")
      setOpenAIResponsesMode((historyItem.params.openaiResponsesMode as OpenAIResponsesMode) || "image")
      if (typeof historyItem.params.openaiResponsesMaxOutputTokens === "number") {
        setOpenAIResponsesMaxOutputTokens(historyItem.params.openaiResponsesMaxOutputTokens)
      } else if (typeof historyItem.responseChainMetadata?.maxOutputTokens === "number") {
        setOpenAIResponsesMaxOutputTokens(historyItem.responseChainMetadata.maxOutputTokens)
      }
      if (typeof historyItem.params.openaiResponsesTemperature === "number") {
        setOpenAIResponsesTemperature(historyItem.params.openaiResponsesTemperature)
      } else if (typeof historyItem.responseChainMetadata?.temperature === "number") {
        setOpenAIResponsesTemperature(historyItem.responseChainMetadata.temperature)
      }
      setOpenAIResponsesPreviousResponseId(
        historyItem.params.openaiPreviousResponseId || historyItem.responseChainMetadata?.requestId || undefined,
      )
      if (historyItem.operationType === "img2img" && onModeChange) {
        onModeChange("img2img")
      } else if (historyItem.operationType === "txt2img" && onModeChange) {
        onModeChange("txt2img")
      }
    }
    
    const params = historyItem.params
    if (params.imageSize) {
      const size = params.imageSize.toLowerCase()
      if (/^\d+\s*x\s*\d+$/.test(size)) {
        const [w, h] = size.split("x").map((v) => v.trim())
        setCustomWidth(w)
        setCustomHeight(h)
        setImageSizeSelection("custom")
        setCustomSizeApplied(`${w}x${h}`)
      } else {
        setImageSizeSelection(size)
      }
    }
    if (params.numImages !== undefined) setNumImages(params.numImages)
    if (params.seed !== undefined) setSeed(params.seed)
    if (params.safetyChecker !== undefined) setSafetyChecker(params.safetyChecker)
    if (params.syncMode !== undefined) setSyncMode(params.syncMode)
    if (params.quality) setNewapiQuality(params.quality as any)
    if (params.style) setNewapiStyle(params.style as any)
    if (params.background) setNewapiBackground(params.background as NewApiBackground)
    if (params.moderation) setNewapiModeration(params.moderation as NewApiModeration)
    if (params.thinkingLevel) setGeminiThinkingLevel(params.thinkingLevel)
    if (params.mediaResolution) setGeminiMediaResolution(params.mediaResolution)
    if (params.aspectRatio) setGeminiAspectRatio(params.aspectRatio as any)
    if (params.falNanoBananaAspectRatio) setFalNanoBananaAspectRatio(params.falNanoBananaAspectRatio)
    if (params.falNanoBananaResolution) setFalNanoBananaResolution(params.falNanoBananaResolution)
    if (params.falNanoBananaOutputFormat) setFalNanoBananaOutputFormat(params.falNanoBananaOutputFormat)
    if (params.falGemini3ProAspectRatio) setFalGemini3ProAspectRatio(params.falGemini3ProAspectRatio)
    if (params.falGemini3ProResolution) setFalGemini3ProResolution(params.falGemini3ProResolution)
    if (params.falGemini3ProOutputFormat) setFalGemini3ProOutputFormat(params.falGemini3ProOutputFormat)
    
    // 如果有原图，恢复到上传区
    if (historyItem.sourceImages && historyItem.sourceImages.length > 0 && onImagesChange && onModeChange) {
      try {
        const files: File[] = []
        for (let i = 0; i < historyItem.sourceImages.length; i++) {
          const base64 = historyItem.sourceImages[i]
          // 将 base64 转换为 Blob
          const response = await fetch(base64)
          const blob = await response.blob()
          const file = new File([blob], `restored-image-${i + 1}.png`, { type: "image/png" })
          files.push(file)
        }
        // 添加到上传区
        onImagesChange(files)
        // 切换到图生图模式
        onModeChange("img2img")
      } catch (error) {
        console.error("恢复原图失败:", error)
      }
    }
    
    setIsHistoryDialogOpen(false)
    toast({
      title: "已加载历史参数",
      description: historyItem.label || `参数于 ${new Date(historyItem.timestamp).toLocaleString("zh-CN")} 保存`,
    })
  }, [toast, updateFalModel, onImagesChange, onModeChange, setOpenAIResponsesMode, setOpenAIResponsesPreviousResponseId, setOpenAIImageQuality, setOpenAIImageStyle, setOpenAIMode, setOpenAIResponsesTemperature, setOpenAIResponsesMaxOutputTokens, setOpenAIModel])

  const handleGenerate = async () => {
    const isImg2ImgMode = mode === "img2img"
    const hasImages = images.length > 0
    const isOpenAIResponsesMode = safeSelectedProvider === "openai" && openAIMode === "responses"
    const hasOpenAIResponsesContinuation = isOpenAIResponsesMode && Boolean(openAIResponsesPreviousResponseId?.trim())
    const allowPromptlessContinuation = isImg2ImgMode && hasOpenAIResponsesContinuation

    if (!prompt.trim() && !(isImg2ImgMode && hasImages) && !allowPromptlessContinuation) {
      toast({
        title: "提示词不能为空",
        description: allowPromptlessContinuation
          ? "请输入新的修改指令，或填写 Previous Response ID 后继续上一轮结果。"
          : isImg2ImgMode
            ? "请输入提示词，或上传图片并保持提示为空以直接处理图片。"
          : "请输入描述你想要生成的图片",
        variant: "destructive",
      })
      return
    }

    const enabledProviders = getEnabledProviderSettings()
    const provider = enabledProviders.find((p) => p.id === safeSelectedProvider)

    if (!provider) {
      toast({
        title: "供应商未配置",
        description: "请先在设置中配置并启用 AI 供应商",
        variant: "destructive",
      })
      onOpenSettings?.()
      return
    }

    if (
      provider.id === "openai" &&
      openAIMode === "image" &&
      isImg2ImgMode &&
      openAIModel === "dall-e-3"
    ) {
      toast({
        title: "当前模型不支持图片编辑",
        description: "DALL·E 3 只支持文生图。图生图请改用 GPT Image，或切到 Responses API。",
        variant: "destructive",
      })
      return
    }

    if (provider.id === "newapi" && isImg2ImgMode && isNewApiOpenAICompatModel(selectedNewapiModel)) {
      if (!supportsNewApiEdits(selectedNewapiModel)) {
        toast({
          title: "当前模型不支持图片编辑",
          description: "NewAPI 的 DALL·E 3 兼容模式只支持文生图。图生图请改用 GPT Image 1 或 DALL·E 2。",
          variant: "destructive",
        })
        return
      }

      if (images.length > 1) {
        toast({
          title: "当前模型只支持单图编辑",
          description: "NewAPI 的 OpenAI 兼容编辑接口当前按单张原图处理，请只保留 1 张图片。",
          variant: "destructive",
        })
        return
      }
    }

    if (isImg2ImgMode && !hasImages && !hasOpenAIResponsesContinuation) {
      toast({
        title: "请先上传图片",
        description: isOpenAIResponsesMode
          ? "图片编辑模式需要上传图片，或填写 Previous Response ID 继续上一轮 Responses 会话。"
          : "图片编辑模式需要至少上传一张图片",
        variant: "destructive",
      })
      return
    }

    if (provider.id === "fal" && !selectedFalModel) {
      toast({
        title: "请选择 FAL 模型",
        description: "请先选择一个 FAL 模型用于生成图片",
        variant: "destructive",
      })
      onOpenSettings?.("fal")
      return
    }

    const modelId = provider.id === "fal"
      ? effectiveFalModelId
      : provider.id === "newapi"
      ? selectedNewapiModel
      : provider.id === "openrouter"
      ? selectedOpenRouterModel
      : provider.id === "gemini"
      ? selectedGeminiModel
      : provider.id === "openai"
      ? openAIModel
      : undefined

    let openaiApiKey: string | undefined

    if (provider.id === "fal" && (modelId?.toLowerCase().includes("byok") ?? false)) {
      const falScopedOpenAIKey = falProvider?.openaiApiKey?.trim()
      openaiApiKey = falScopedOpenAIKey || openaiProvider?.apiKey?.trim()

      if (!openaiApiKey) {
        toast({
          title: "缺少 OpenAI Key",
          description: "该 FAL 模型需要配置 OpenAI API Key 才能使用，请在供应商设置中填写后重试。",
          variant: "destructive",
        })
        onOpenSettings?.("openai")
        return
      }
    }
    
    // 保存当前参数到历史记录
    // 如果是图生图模式，将上传的图片转换为 base64 保存
    let sourceImages: string[] | undefined
    if (mode === "img2img" && images.length > 0) {
      sourceImages = []
      for (const file of images) {
        try {
          const reader = new FileReader()
          const base64 = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(file)
          })
          sourceImages.push(base64)
        } catch (error) {
          console.error("转换图片失败:", error)
        }
      }
    }
    
    addHistoryItem({
      prompt,
      providerId: provider.id,
      modelId,
      sourceImages,
      params: {
        imageSize: effectiveImageSize,
        numImages: safeNumImages,
        seed: provider.id === "fal" && !selectedFalCapability.supportsSeed ? undefined : seed,
        safetyChecker:
          provider.id === "fal" && !selectedFalCapability.supportsSafetyChecker ? undefined : safetyChecker,
        syncMode: provider.id === "fal" && !selectedFalCapability.supportsSyncMode ? undefined : syncMode,
        quality: provider.id === "newapi" ? safeNewapiQuality : undefined,
        style: provider.id === "newapi" ? newapiStyle : undefined,
        background: provider.id === "newapi" && supportsNewApiBackground(selectedNewapiModel) ? newapiBackground : undefined,
        moderation: provider.id === "newapi" && supportsNewApiModeration(selectedNewapiModel) ? newapiModeration : undefined,
        thinkingLevel: (
          (provider.id === "newapi" && isNewApiGeminiModel(selectedNewapiModel)) ||
          (provider.id === "gemini" && selectedGeminiModel.includes("pro"))
        ) ? geminiThinkingLevel : undefined,
        mediaResolution: (
          (provider.id === "newapi" && isNewApiGeminiModel(selectedNewapiModel)) ||
          provider.id === "gemini"
        ) ? geminiMediaResolution : undefined,
        aspectRatio: (
          (provider.id === "newapi" && isNewApiGeminiModel(selectedNewapiModel)) ||
          provider.id === "gemini"
        ) ? geminiAspectRatio : undefined,
        falNanoBananaAspectRatio: isNanoBananaProSelected ? falNanoBananaAspectRatio : undefined,
        falNanoBananaResolution: isNanoBananaProSelected ? falNanoBananaResolution : undefined,
        falNanoBananaOutputFormat: isNanoBananaProSelected ? falNanoBananaOutputFormat : undefined,
        // FAL gemini-3-pro-image-preview (Nano Banana 2) 专用参数
        falGemini3ProAspectRatio: isGemini3ProPreviewSelected ? falGemini3ProAspectRatio : undefined,
        falGemini3ProResolution: isGemini3ProPreviewSelected ? falGemini3ProResolution : undefined,
        falGemini3ProOutputFormat: isGemini3ProPreviewSelected ? falGemini3ProOutputFormat : undefined,
        ...(provider.id === "openai" ? openAIParamsForHistory : {}),
      },
      openaiMode: provider.id === "openai" ? currentOpenAIMetadataMode : undefined,
      operationType: provider.id === "openai" ? operationType : undefined,
      responseChainMetadata: provider.id === "openai" ? buildOpenAIHistoryMetadataByMode(operationType) : undefined,
    })

    await onGenerate(provider, {
      prompt,
      imageSize: effectiveImageSize,
      numImages: safeNumImages,
      seed: provider.id === "fal" && !selectedFalCapability.supportsSeed ? undefined : seed,
      safetyChecker: provider.id === "fal" && !selectedFalCapability.supportsSafetyChecker ? undefined : safetyChecker,
      syncMode: provider.id === "fal" && !selectedFalCapability.supportsSyncMode ? undefined : syncMode,
      images: mode === "img2img" ? images : undefined,
      modelId,
      quality: provider.id === "newapi" ? safeNewapiQuality : undefined,
      style: provider.id === "newapi" ? newapiStyle : undefined,
      background: provider.id === "newapi" && supportsNewApiBackground(selectedNewapiModel) ? newapiBackground : undefined,
      moderation: provider.id === "newapi" && supportsNewApiModeration(selectedNewapiModel) ? newapiModeration : undefined,
      openaiApiKey,
      ...(provider.id === "openai" ? openAIParamsForHistory : {}),
      // Gemini 参数（NewAPI 的 Gemini 模型或 Gemini 供应商）
      thinkingLevel: (
        (provider.id === "newapi" && isNewApiGeminiModel(selectedNewapiModel)) ||
        (provider.id === "gemini" && selectedGeminiModel.includes("pro"))
      ) ? geminiThinkingLevel : undefined,
      mediaResolution: (
        (provider.id === "newapi" && isNewApiGeminiModel(selectedNewapiModel)) ||
        provider.id === "gemini"
      ) ? geminiMediaResolution : undefined,
      aspectRatio: (
        (provider.id === "newapi" && isNewApiGeminiModel(selectedNewapiModel)) ||
        provider.id === "gemini"
      ) ? geminiAspectRatio : undefined,
      // FAL nano-banana-pro 专用参数
      falNanoBananaAspectRatio: isNanoBananaProSelected ? falNanoBananaAspectRatio : undefined,
      falNanoBananaResolution: isNanoBananaProSelected ? falNanoBananaResolution : undefined,
      falNanoBananaOutputFormat: isNanoBananaProSelected ? falNanoBananaOutputFormat : undefined,
      // FAL gemini-3-pro-image-preview (Nano Banana 2) 专用参数
      falGemini3ProAspectRatio: isGemini3ProPreviewSelected ? falGemini3ProAspectRatio : undefined,
      falGemini3ProResolution: isGemini3ProPreviewSelected ? falGemini3ProResolution : undefined,
      falGemini3ProOutputFormat: isGemini3ProPreviewSelected ? falGemini3ProOutputFormat : undefined,
    })
  }

  return (
    <section className="p-0">
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 className="text-base font-semibold">生成参数</h2>
            <p className="text-xs text-muted-foreground">
              {mode === "img2img" ? "编辑源图片" : "输入视觉参数"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={saveCurrentParams}
              title="保存当前参数配置"
            >
              <Download className="h-3 w-3" />
              保存参数
            </Button>
            
            <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                >
                  <Clock className="h-3 w-3" />
                  历史记录 ({history.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>历史参数记录</DialogTitle>
                  <DialogDescription>
                    选择一条历史记录以快速恢复之前使用的参数配置
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                  {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-sm text-muted-foreground">暂无历史记录</p>
                      <p className="text-xs text-muted-foreground/70 mt-2">
                        生成图片后会自动保存参数配置
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {history.map((item) => {
                        const providerName = 
                          item.providerId === "fal" ? "FAL" :
                          item.providerId === "newapi" ? "NewAPI" :
                          item.providerId === "openrouter" ? "OpenRouter" :
                          item.providerId === "gemini" ? "Gemini" :
                          item.providerId
                        
                        return (
                          <div
                            key={item.id}
                            className="group relative rounded-md border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                            onClick={() => loadHistoryParams(item)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="text-xs">
                                    {providerName}
                                  </Badge>
                                  {item.modelId && (
                                    <Badge variant="secondary" className="text-xs truncate max-w-[200px]">
                                      {item.modelId}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground ml-auto">
                                    {new Date(item.timestamp).toLocaleString("zh-CN", {
                                      month: "2-digit",
                                      day: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-foreground line-clamp-2 mb-2">
                                  {item.prompt || "(空提示词)"}
                                </p>
                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  {item.params.imageSize && (
                                    <span>尺寸: {item.params.imageSize}</span>
                                  )}
                                  {item.params.numImages && (
                                    <span>• 数量: {item.params.numImages}</span>
                                  )}
                                  {item.params.seed !== undefined && (
                                    <span>• Seed: {item.params.seed}</span>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setHistoryToDelete(item.id)
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>
                {history.length > 0 && (
                  <div className="flex justify-between items-center pt-4 border-t">
                    <p className="text-xs text-muted-foreground">
                      最多保存 50 条历史记录
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setShowClearHistoryConfirm(true)}
                    >
                      清空所有历史
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => {
              resetForm()
              onReset?.()
            }}
          >
            <RotateCcw className="h-3 w-3" />
              重置表单
          </Button>
          </div>
          </header>
          
          {/* 删除单条历史记录确认对话框 */}
          <AlertDialog open={historyToDelete !== null} onOpenChange={(open) => !open && setHistoryToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要删除这条历史记录吗？此操作无法撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={() => {
                    if (historyToDelete) {
                      deleteHistoryItem(historyToDelete)
                      setHistoryToDelete(null)
                      toast({
                        title: "已删除",
                        description: "历史记录已删除",
                      })
                    }
                  }}
                >
                  删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          {/* 清空所有历史记录确认对话框 */}
          <AlertDialog open={showClearHistoryConfirm} onOpenChange={setShowClearHistoryConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认清空</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要清空所有历史记录吗？此操作将删除全部 {history.length} 条记录且无法撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={() => {
                    clearHistory()
                    setShowClearHistoryConfirm(false)
                    setIsHistoryDialogOpen(false)
                    toast({
                      title: "已清空",
                      description: "所有历史记录已清空",
                    })
                  }}
                >
                  清空
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="grid gap-6">
          <div>
            <div className="flex items-center justify-between pb-3">
              <Label htmlFor="prompt" className="text-sm font-medium">提示词</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{prompt.length} / 1000</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1"
                  disabled={!prompt.trim() || isEnhancing || !enhanceAvailable}
                  title={!enhanceAvailable ? "未配置 AI 优化服务" : undefined}
                  onClick={async () => {
                    setIsEnhancing(true)
                    try {
                      const res = await fetch("/api/prompt/enhance", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ 
                          prompt,
                          mode, // 传递当前模式
                        }),
                      })
                      const data = await res.json()
                      if (!res.ok || !data.enhanced) {
                        throw new Error(data.error || "提示词优化失败")
                      }
                      setPrompt(data.enhanced)
                      toast({
                        title: "已优化提示词",
                        description: mode === "img2img" 
                          ? "已针对图片编辑优化提示词" 
                          : "已针对全新生成优化提示词",
                      })
                    } catch (error) {
                      toast({
                        title: "优化失败",
                        description: error instanceof Error ? error.message : "无法优化提示词",
                        variant: "destructive",
                      })
                    } finally {
                      setIsEnhancing(false)
                    }
                  }}
                >
                  {isEnhancing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>优化中</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>AI 优化</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
            <Textarea
              id="prompt"
              placeholder="描述你想要生成的图片..."
              className="min-h-[120px] resize-none border-border text-foreground text-sm focus-visible:ring-primary"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={1000}
            />
            {mode === "img2img" && images.length > 1 && (
              <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground bg-primary/5 p-2 rounded border border-primary/20">
                <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <p>
                  提示：已上传 {images.length} 张图片，可在提示词中使用 <span className="font-mono text-primary font-semibold">#1</span>、<span className="font-mono text-primary font-semibold">#2</span> 等编号引用特定图片。
                  例如：&quot;<span className="italic">将 #1 的风格应用到 #2 上</span>&quot;
                </p>
              </div>
            )}
          </div>

          <section className="bg-card p-4 border border-border rounded-md shadow-sm">
            <header className="flex items-center justify-between pb-4">
              <h3 className="text-sm font-medium">模型选择</h3>
              {safeSelectedProvider === "fal" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{falModels.length} 个可用模型</span>
                  {falModelsUpdatedAtLabel ? (
                    <span className="hidden text-xs text-muted-foreground sm:inline">更新于 {falModelsUpdatedAtLabel}</span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      void refreshFalModels()
                    }}
                    disabled={isLoadingFalModels || isRefreshingFalModels}
                    aria-label="刷新模型列表"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isRefreshingFalModels && "animate-spin")} />
                    刷新
                  </Button>
                </div>
              )}
              {safeSelectedProvider === "newapi" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {isLoadingNewApiModels ? "加载中..." : `${newapiModels.length} 个可用模型`}
                  </span>
                  {newapiModelsUpdatedAtLabel ? (
                    <span className="hidden text-xs text-muted-foreground sm:inline">更新于 {newapiModelsUpdatedAtLabel}</span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      void refreshNewApiModels()
                    }}
                    disabled={isLoadingNewApiModels || isRefreshingNewApiModels}
                    aria-label="刷新模型列表"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isRefreshingNewApiModels && "animate-spin")} />
                    刷新
                  </Button>
                </div>
              )}
              {safeSelectedProvider === "openrouter" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {isLoadingOpenRouterModels ? "加载中..." : `${openrouterModels.length} 个可用模型`}
                  </span>
                  {openrouterModelsUpdatedAtLabel ? (
                    <span className="hidden text-xs text-muted-foreground sm:inline">更新于 {openrouterModelsUpdatedAtLabel}</span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      if (!openrouterProvider?.apiKey) {
                        toast({
                          title: "配置缺失",
                          description: "请先在设置中配置 OpenRouter API Key",
                          variant: "destructive",
                        })
                        return
                      }
                      void refreshOpenRouterModels()
                    }}
                    disabled={isLoadingOpenRouterModels || isRefreshingOpenRouterModels}
                    aria-label="刷新模型列表"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isRefreshingOpenRouterModels && "animate-spin")} />
                    刷新
                  </Button>
                </div>
              )}
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="provider" className="text-sm font-medium text-foreground">
                  AI 供应商
                </Label>
                <Select
                  value={safeSelectedProvider}
                  onValueChange={setSelectedProvider}
                  disabled={providerOptions.length === 0}
                >
                  <SelectTrigger
                    id="provider"
                    className="h-10 w-full px-3 text-left text-sm font-medium"
                  >
                    <SelectValue placeholder="选择供应商" />
                  </SelectTrigger>
                  <SelectContent>
                    {providerOptions.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {safeSelectedProvider === "fal" ? (
                <div className="space-y-2">
                  <Label htmlFor="fal-model" className="text-sm font-medium text-foreground">
                    FAL 模型
                  </Label>
                  <Popover open={isFalModelPopoverOpen} onOpenChange={setIsFalModelPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="fal-model"
                        variant="outline"
                        role="combobox"
                        aria-expanded={isFalModelPopoverOpen}
                        className="flex h-10 w-full min-w-0 items-center justify-between gap-4 px-3 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="text-left truncate" title={falModelButtonLabel}>
                          {falModelButtonLabel}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 shadow-lg" align="start">
                      <Command
                        loop
                        className="rounded-md border border-border"
                      >
                        <div className="border-b border-border px-3 py-2">
                          <CommandInput 
                            placeholder="搜索模型名称或 ID…" 
                            className="border-none focus:ring-0"
                            value={falSearch}
                            onValueChange={handleFalSearchChange}
                          />
                        </div>
                        <CommandList ref={falListRef} className="max-h-80 overflow-y-auto p-2">
                          {isLoadingFalModels && !hasFalModels ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                              <div className="mb-2">正在加载模型列表…</div>
                            </div>
                          ) : (
                            <>
                              <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
                                未找到匹配的模型
                              </CommandEmpty>
                              <CommandGroup>
                                {deferredFalModels.map((model) => {
                                  const isSelected = getFalBaseModelId(model.id) === selectedFalModel
                                  return (
                                  <CommandItem
                                    key={model.id}
                                    value={`${model.title} ${model.id} ${(model.tags || []).join(" ")}`}
                                    onSelect={() => {
                                      updateFalModel(model.id)
                                      setIsFalModelPopoverOpen(false)
                                    }}
                                    className={cn(
                                      "mb-1 cursor-pointer rounded-md border border-transparent px-3 py-3 transition-all",
                                      "hover:border-border hover:bg-muted/50",
                                      "aria-selected:border-primary/30 aria-selected:bg-muted/50",
                                      isSelected && "border-primary bg-muted/50"
                                    )}
                                  >
                                    <div className="flex flex-1 flex-col gap-0.5">
                                      <span className="text-sm font-semibold text-foreground">{model.title}</span>
                                      <span className="text-xs text-muted-foreground">{model.id}</span>
                                    </div>
                                    {isSelected ? (
                                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                                        <Check className="h-3 w-3 text-white" />
                                      </div>
                                    ) : null}
                                  </CommandItem>
                                  )
                                })}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {falModelsError ? <p className="text-xs text-destructive">加载 FAL 模型失败：{falModelsError}</p> : null}
                </div>
              ) : null}

              {safeSelectedProvider === "openai" ? (
                <OpenAISettingsSection
                  openAIMode={openAIMode}
                  openAIModel={openAIModel}
                  openAIImageQuality={openAIImageQuality}
                  openAIImageStyle={openAIImageStyle}
                  openAIResponsesMode={openAIResponsesMode}
                  openAIResponsesMaxOutputTokens={openAIResponsesMaxOutputTokens}
                  openAIResponsesTemperature={openAIResponsesTemperature}
                  openAIResponsesPreviousResponseId={openAIResponsesPreviousResponseId}
                  openAIModelOptions={openAIModelOptions}
                  openAIResponsesModeOptions={openAIResponsesModeOptions}
                  onOpenAIModeChange={setOpenAIMode}
                  onOpenAIModelChange={setOpenAIModel}
                  onOpenAIImageQualityChange={setOpenAIImageQuality}
                  onOpenAIImageStyleChange={setOpenAIImageStyle}
                  onOpenAIResponsesModeChange={setOpenAIResponsesMode}
                  onOpenAIResponsesMaxOutputTokensChange={setOpenAIResponsesMaxOutputTokens}
                  onOpenAIResponsesTemperatureChange={setOpenAIResponsesTemperature}
                  onOpenAIResponsesPreviousResponseIdChange={setOpenAIResponsesPreviousResponseId}
                />
              ) : null}

              {isNanoBananaProSelected && (
                <>
                  <div className="sm:col-span-2 w-full">
                    <div className="border-l-4 border-primary bg-primary/10 px-4 py-3 rounded">
                      <p className="text-sm text-foreground font-medium">
                        Nano Banana Pro (Gemini 3 Pro Image) {mode === "img2img" && "· 编辑模式"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {mode === "img2img" 
                          ? "专业的图片编辑模型，支持基于原图进行精准修改和风格转换" 
                          : "Google 最新的图片生成模型，支持自定义宽高比、分辨率和输出格式"
                        }
                      </p>
                    </div>
                  </div>
                  <div className="sm:col-span-2 grid gap-4 grid-cols-1 md:grid-cols-3 w-full">
                    <div className="space-y-2">
                    <Label htmlFor="fal-nano-aspect" className="text-sm font-medium text-foreground">
                      {mode === "img2img" ? "输出宽高比" : "宽高比"}
                    </Label>
                    <Select
                      value={falNanoBananaAspectRatio}
                      onValueChange={(v: any) => setFalNanoBananaAspectRatio(v)}
                    >
                      <SelectTrigger id="fal-nano-aspect" className="w-full h-10">
                        <SelectValue placeholder="选择宽高比" />
                      </SelectTrigger>
                      <SelectContent>
                        {mode === "img2img" && <SelectItem value="auto">自动 - 保持原图比例</SelectItem>}
                        {["21:9","16:9","3:2","4:3","5:4","1:1","4:5","3:4","2:3","9:16"].map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mode === "img2img" && (
                      <p className="text-xs text-muted-foreground">
                        选择 auto 保持原图比例，或指定新的宽高比
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fal-nano-resolution" className="text-sm font-medium text-foreground">
                      {mode === "img2img" ? "输出分辨率" : "分辨率"}
                    </Label>
                    <Select
                      value={falNanoBananaResolution}
                      onValueChange={(v: any) => setFalNanoBananaResolution(v)}
                    >
                      <SelectTrigger id="fal-nano-resolution" className="w-full h-10">
                        <SelectValue placeholder="选择分辨率" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4K">4K - 最高质量（耗时较长）</SelectItem>
                        <SelectItem value="2K">2K - 推荐平衡</SelectItem>
                        <SelectItem value="1K">1K - 快速{mode === "img2img" ? "编辑" : "生成"}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      提示：4K 分辨率需要较长时间，建议先尝试 2K
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fal-nano-format" className="text-sm font-medium text-foreground">
                      输出格式
                    </Label>
                    <Select
                      value={falNanoBananaOutputFormat}
                      onValueChange={(v: any) => setFalNanoBananaOutputFormat(v)}
                    >
                      <SelectTrigger id="fal-nano-format" className="w-full h-10">
                        <SelectValue placeholder="选择格式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="png">PNG - 无损压缩，质量最高</SelectItem>
                        <SelectItem value="jpeg">JPEG - 有损压缩，文件较小</SelectItem>
                        <SelectItem value="webp">WebP - 现代格式，平衡质量与大小</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                </>
              )}

              {/* FAL gemini-3-pro-image-preview (Nano Banana 2) 特化设置 */}
              {isGemini3ProPreviewSelected && (
                <>
                  <div className="sm:col-span-2 w-full">
                    <div className="border-l-4 border-primary bg-primary/10 px-4 py-3 rounded">
                      <p className="text-sm text-foreground font-medium">
                        Gemini 3 Pro Image Preview (Nano Banana 2) {mode === "img2img" && "· 编辑模式"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {mode === "img2img" 
                          ? "强大的图片编辑模型，支持精准的图像修改和创意转换" 
                          : "Google 最新一代图片生成模型，具备更强的理解能力和更高的生成质量"
                        }
                      </p>
                    </div>
                  </div>
                  <div className="sm:col-span-2 grid gap-4 grid-cols-1 md:grid-cols-3 w-full">
                    <div className="space-y-2">
                    <Label htmlFor="fal-g3p-aspect" className="text-sm font-medium text-foreground">
                      {mode === "img2img" ? "输出宽高比" : "宽高比"}
                    </Label>
                    <Select
                      value={falGemini3ProAspectRatio}
                      onValueChange={(v: any) => setFalGemini3ProAspectRatio(v)}
                    >
                      <SelectTrigger id="fal-g3p-aspect" className="w-full h-10">
                        <SelectValue placeholder="选择宽高比" />
                      </SelectTrigger>
                      <SelectContent>
                        {mode === "img2img" && <SelectItem value="auto">自动 - 保持原图比例</SelectItem>}
                        {["21:9","16:9","3:2","4:3","5:4","1:1","4:5","3:4","2:3","9:16"].map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mode === "img2img" && (
                      <p className="text-xs text-muted-foreground">
                        选择 auto 保持原图比例，或指定新的宽高比
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fal-g3p-resolution" className="text-sm font-medium text-foreground">
                      {mode === "img2img" ? "输出分辨率" : "分辨率"}
                    </Label>
                    <Select
                      value={falGemini3ProResolution}
                      onValueChange={(v: any) => setFalGemini3ProResolution(v)}
                    >
                      <SelectTrigger id="fal-g3p-resolution" className="w-full h-10">
                        <SelectValue placeholder="选择分辨率" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4K">4K - 最高质量（耗时较长）</SelectItem>
                        <SelectItem value="2K">2K - 推荐平衡</SelectItem>
                        <SelectItem value="1K">1K - 快速{mode === "img2img" ? "编辑" : "生成"}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      提示：4K 分辨率需要较长时间，建议先尝试 2K
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fal-g3p-format" className="text-sm font-medium text-foreground">
                      输出格式
                    </Label>
                    <Select
                      value={falGemini3ProOutputFormat}
                      onValueChange={(v: any) => setFalGemini3ProOutputFormat(v)}
                    >
                      <SelectTrigger id="fal-g3p-format" className="w-full h-10">
                        <SelectValue placeholder="选择格式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="png">PNG - 无损压缩，质量最高</SelectItem>
                        <SelectItem value="jpeg">JPEG - 有损压缩，文件较小</SelectItem>
                        <SelectItem value="webp">WebP - 现代格式，平衡质量与大小</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                </>
              )}
              
              {safeSelectedProvider === "newapi" ? (
                <NewAPISettingsSection
                  mode={mode}
                  selectedNewapiModel={selectedNewapiModel}
                  newapiModels={deferredNewapiModels}
                  hasNewapiModels={hasNewapiModels}
                  isLoadingNewApiModels={isLoadingNewApiModels}
                  newapiSearch={newapiSearch}
                  newapiListRef={newapiListRef}
                  newapiModelButtonLabel={newapiModelButtonLabel}
                  isNewapiModelPopoverOpen={isNewapiModelPopoverOpen}
                  onNewapiModelPopoverOpenChange={setIsNewapiModelPopoverOpen}
                  onNewapiSearchChange={handleNewapiSearchChange}
                  onSelectNewapiModel={(modelId) => setSelectedNewapiModel(modelId)}
                  safeNewapiQuality={safeNewapiQuality}
                  onNewapiQualityChange={setNewapiQuality}
                  newapiStyle={newapiStyle}
                  onNewapiStyleChange={setNewapiStyle}
                  newapiBackground={newapiBackground}
                  onNewapiBackgroundChange={setNewapiBackground}
                  newapiModeration={newapiModeration}
                  onNewapiModerationChange={setNewapiModeration}
                  showGeminiSection={isNewApiGeminiModel(selectedNewapiModel)}
                  geminiThinkingLevel={geminiThinkingLevel}
                  onGeminiThinkingLevelChange={setGeminiThinkingLevel}
                  geminiMediaResolution={geminiMediaResolution}
                  onGeminiMediaResolutionChange={(value) => setGeminiMediaResolution(value)}
                  geminiAspectRatio={geminiAspectRatio}
                  onGeminiAspectRatioChange={(value) => setGeminiAspectRatio(value)}
                  showOpenAICompatImageEditHint={isNewApiOpenAICompatModel(selectedNewapiModel) && mode === "img2img"}
                />
              ) : null}

              {safeSelectedProvider === "openrouter" ? (
                <div className="space-y-2">
                  <Label htmlFor="openrouter-model" className="text-sm font-medium text-foreground">
                    OpenRouter 模型
                  </Label>
                  <Popover open={isOpenRouterModelPopoverOpen} onOpenChange={setIsOpenRouterModelPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="openrouter-model"
                        variant="outline"
                        role="combobox"
                        aria-expanded={isOpenRouterModelPopoverOpen}
                        className="flex h-10 w-full min-w-0 items-center justify-between gap-4 px-3 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="text-left truncate" title={openrouterModelButtonLabel}>
                          {openrouterModelButtonLabel}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 shadow-lg" align="start">
                      <Command
                        loop
                        className="rounded-md border border-border"
                      >
                        <div className="border-b border-border px-3 py-2">
                          <CommandInput 
                            placeholder="搜索模型名称…" 
                            className="border-none focus:ring-0"
                            value={openrouterSearch}
                            onValueChange={handleOpenrouterSearchChange}
                          />
                        </div>
                        <CommandList ref={openrouterListRef} className="max-h-80 overflow-y-auto p-2">
                          {isLoadingOpenRouterModels && !hasOpenRouterModels ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                              <div className="mb-2">正在加载模型列表…</div>
                            </div>
                          ) : (
                            <>
                              <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
                                未找到匹配的模型
                              </CommandEmpty>
                              <CommandGroup>
                                {deferredOpenRouterModels.map((model) => (
                                  <CommandItem
                                    key={model.id}
                                    value={`${model.id} ${model.name || ""} ${model.owned_by || ""}`}
                                    onSelect={() => {
                                      setSelectedOpenRouterModel(model.id)
                                      setIsOpenRouterModelPopoverOpen(false)
                                    }}
                                    className={cn(
                                      "mb-1 cursor-pointer rounded-md border border-transparent px-3 py-3 transition-all",
                                      "hover:border-border hover:bg-muted/50",
                                      "aria-selected:border-primary/30 aria-selected:bg-muted/50",
                                      selectedOpenRouterModel === model.id && "border-primary bg-muted/50"
                                    )}
                                  >
                                    <div className="flex flex-1 flex-col gap-0.5">
                                      <span className="text-sm font-semibold text-foreground">{model.name || model.id}</span>
                                      <span className="text-xs text-muted-foreground">{model.id}</span>
                                      {model.owned_by && (
                                        <span className="text-xs text-muted-foreground">提供商：{model.owned_by}</span>
                                      )}
                                    </div>
                                    {selectedOpenRouterModel === model.id ? (
                                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                                        <Check className="h-3 w-3 text-white" />
                                      </div>
                                    ) : null}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              ) : null}

              {safeSelectedProvider === "gemini" ? (
                <div className="space-y-2">
                  <Label htmlFor="gemini-model" className="text-sm font-medium text-foreground">
                    Gemini 模型
                  </Label>
                  <Select value={selectedGeminiModel} onValueChange={setSelectedGeminiModel}>
                    <SelectTrigger id="gemini-model" className="h-10">
                      <SelectValue placeholder="选择 Gemini 模型" />
                    </SelectTrigger>
                    <SelectContent>
                      {geminiModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{model.name}</span>
                            <span className="text-xs text-muted-foreground">{model.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Flash: 快速高效，1K 分辨率 | Pro: 高级模型，支持 4K 和深度思考
                  </p>
                </div>
              ) : null}

            {safeSelectedProvider === "gemini" && (
                <div className="sm:col-span-2 grid gap-4 grid-cols-1 md:grid-cols-3 w-full">
                  {selectedGeminiModel.includes("pro") && (
                    <div className="space-y-2">
                      <Label htmlFor="gemini-thinking-level" className="text-sm font-medium text-foreground">
                        思考等级
                      </Label>
                      <Select
                        value={geminiThinkingLevel}
                        onValueChange={(v: "low" | "high") => setGeminiThinkingLevel(v)}
                      >
                        <SelectTrigger id="gemini-thinking-level" className="w-full h-10">
                          <SelectValue placeholder="选择思考等级" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High - 深度推理，质量更高</SelectItem>
                          <SelectItem value="low">Low - 更快速，成本更低</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="gemini-media-resolution" className="text-sm font-medium text-foreground">
                      媒体分辨率
                    </Label>
                    <Select
                      value={geminiMediaResolution}
                      onValueChange={(v: any) => setGeminiMediaResolution(v)}
                    >
                      <SelectTrigger id="gemini-media-resolution" className="w-full h-10">
                        <SelectValue placeholder="选择分辨率" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="media_resolution_high">高 4K（细节优先，耗时较长）</SelectItem>
                        <SelectItem value="media_resolution_medium">中 2K（推荐）</SelectItem>
                        <SelectItem value="media_resolution_low">低 1K（速度优先）</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      提示：4K 分辨率可能需要较长时间，建议先尝试 2K
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gemini-aspect-ratio" className="text-sm font-medium text-foreground">
                      宽高比
                    </Label>
                    <Select
                      value={geminiAspectRatio}
                      onValueChange={(v: any) => setGeminiAspectRatio(v)}
                    >
                      <SelectTrigger id="gemini-aspect-ratio" className="w-full h-10">
                        <SelectValue placeholder="选择宽高比" />
                      </SelectTrigger>
                      <SelectContent>
                        {["1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9"].map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

            </div>
            

          </section>
      
          <section className="rounded-md border border-border bg-card p-4 shadow-sm">
            <header className="pb-4">
              <h3 className="text-sm font-semibold text-foreground">图片参数</h3>
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              {!(safeSelectedProvider === "fal" && !selectedFalCapability.supportsImageSize) && (
                <div className="space-y-2">
                  <Label htmlFor="size" className="text-sm font-medium text-foreground">
                    图片尺寸
                  </Label>
                  <Select
                    value={safeImageSizeSelection}
                    onValueChange={(val) => {
                      setImageSizeSelection(val)
                    }}
                    disabled={safeSelectedProvider === "" || providerOptions.length === 0}
                  >
                    <SelectTrigger id="size">
                      <SelectValue placeholder="选择图片尺寸" />
                    </SelectTrigger>
                    <SelectContent>
                      {imageSizeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isCustomSelection && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-gray-700">自定义尺寸</Label>
                      {customApplyState === "success" && customSizeApplied ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                          <span>已应用：{customSizeApplied.replace("x", " × ")}</span>
                        </span>
                      ) : customApplyState === "error" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                          <span>请检查输入</span>
                        </span>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-[minmax(96px,1fr)_auto_minmax(96px,1fr)_minmax(110px,1fr)] items-center gap-2">
                      <Input
                        type="number"
                        min={64}
                        max={4096}
                        placeholder="宽"
                        value={customWidth}
                        onChange={(e) => handleCustomWidthChange(e.target.value)}
                        className={`w-full ${
                          customApplyState === "success"
                            ? "border-green-500"
                            : customApplyState === "error"
                            ? "border-rose-500"
                            : ""
                        }`}
                      />
                      <span className="text-sm text-muted-foreground text-center">x</span>
                      <Input
                        type="number"
                        min={64}
                        max={4096}
                        placeholder="高"
                        value={customHeight}
                        onChange={(e) => handleCustomHeightChange(e.target.value)}
                        className={`w-full ${
                          customApplyState === "success"
                            ? "border-green-500"
                            : customApplyState === "error"
                            ? "border-rose-500"
                            : ""
                        }`}
                      />
                      <Button
                        variant="default"
                        type="button"
                        onClick={handleApplyCustomSize}
                        className={`w-full transition-colors font-semibold pointer-events-auto relative z-10 ${
                          customApplyState === "success"
                            ? "bg-green-600 text-white border-green-600 hover:bg-green-500"
                            : customApplyState === "error"
                            ? "border-rose-500 text-rose-600 hover:bg-rose-50"
                            : "bg-blue-500 text-white hover:bg-blue-600"
                        }`}
                      >
                        {customApplyState === "success" ? "已应用" : "应用"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">64 - 4096 正整数，例如 1400 x 900</p>
                    <p
                      role="status"
                      className={`text-xs ${
                        customSizeFeedback
                          ? customSizeFeedback.type === "success"
                            ? "text-green-600 font-semibold"
                            : "text-rose-600 font-semibold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {customSizeFeedback ? customSizeFeedback.message : ""}
                    </p>
                  </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="num_images" className="text-sm font-medium text-foreground">
                  生成数量
                </Label>
                <Input
                  id="num_images"
                  type="number"
                  value={safeNumImages}
                  onChange={(e) => setNumImages(Number(e.target.value))}
                  min={1}
                  max={safeSelectedProvider === "newapi" && isNewApiOpenAICompatModel(selectedNewapiModel) ? getNewApiSafeNumImages(selectedNewapiModel, 4) : 4}
                  disabled={safeSelectedProvider === "newapi" && isNewApiOpenAICompatModel(selectedNewapiModel) && getNewApiSafeNumImages(selectedNewapiModel, 4) === 1}
                />
                {safeSelectedProvider === "newapi" && isNewApiOpenAICompatModel(selectedNewapiModel) && getNewApiSafeNumImages(selectedNewapiModel, 4) === 1 && (
                  <p className="text-xs text-amber-600">{selectedNewapiModel} 仅支持单张图片生成</p>
                )}
              </div>

            </div>
          </section>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">高级设置</p>
            <Button variant="outline" size="sm" onClick={() => setShowAdvanced((v) => !v)}>
              {showAdvanced ? "收起" : "展开"}
            </Button>
          </div>

          {showAdvanced && (safeSelectedProvider !== "fal" || selectedFalCapability.supportsSeed) && (
            <div className="space-y-2">
              <Label htmlFor="seed" className="text-sm font-medium text-foreground">
                随机种子
              </Label>
              <Input
                id="seed"
                type="number"
                placeholder="保持为空将随机生成"
                value={seed ?? ""}
                onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          )}

          {showAdvanced && (
            <section className="rounded-md border border-border bg-card p-4 shadow-sm">
              <header className="pb-4">
                <h3 className="text-sm font-semibold text-foreground">高级选项</h3>
              </header>

              <div className="grid gap-3">
                {(safeSelectedProvider !== "fal" || selectedFalCapability.supportsSafetyChecker) && (
                  <div className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">安全检查</p>
                      <p className="text-xs text-muted-foreground">启用内容安全过滤，确保生成内容合规</p>
                    </div>
                    <Switch id="safety" checked={safetyChecker} onCheckedChange={setSafetyChecker} />
                  </div>
                )}

                {(safeSelectedProvider !== "fal" || selectedFalCapability.supportsSyncMode) && (
                  <div className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">同步模式</p>
                      <p className="text-xs text-muted-foreground">等待生成完成后再返回结果</p>
                    </div>
                    <Switch id="sync" checked={syncMode} onCheckedChange={setSyncMode} />
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          <Wand2 className={`h-5 w-5 ${isGenerating ? "animate-spin" : ""}`} />
          {isGenerating ? "生成中..." : "开始生成"}
        </Button>
      </div>


    </section>
  )
}
