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
  ImageIcon,
  RefreshCw,
  RotateCcw,
  Shield,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react"
import { useProviderSettings } from "@/hooks/use-provider-settings"
import { useToast } from "@/hooks/use-toast"
import type { ProviderConfig } from "@/lib/providers"
import type { GenerationParams, GenerationResult } from "@/lib/api-client"
import { useFalModels, prefetchFalModels } from "@/hooks/use-fal-models"
import { useNewApiModels } from "@/hooks/use-newapi-models"
import { useOpenRouterModels } from "@/hooks/use-openrouter-models"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

interface GenerationFormProps {
  mode: "img2img" | "txt2img"
  images?: File[]
  isGenerating: boolean
  onReset?: () => void
  resetSignal?: number
  onGenerate: (provider: ProviderConfig, params: GenerationParams) => Promise<GenerationResult>
  initialPrompt?: string
  onPromptSet?: () => void
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
}: GenerationFormProps) {
  // 注意：为避免服务端/客户端初始 HTML 不一致导致的 Hydration 报错
  // 这里不在初始 state 读取 localStorage，而是统一在后续 effect 中恢复

  const [prompt, setPrompt] = useState(initialPrompt || "")
  const [selectedProvider, setSelectedProvider] = useState("fal")
  const [imageSizeSelection, setImageSizeSelection] = useState("square")
  const [numImages, setNumImages] = useState(1)
  const [seed, setSeed] = useState<number | undefined>()
  const [safetyChecker, setSafetyChecker] = useState(true)
  const [syncMode, setSyncMode] = useState(true)
  const [selectedFalModel, setSelectedFalModel] = useState<string>("fal-ai/flux/dev")
  const falModelByCategoryRef = useRef<Record<string, string>>({
    "text-to-image": "fal-ai/flux/dev",
    "image-to-image": "fal-ai/flux/dev",
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
  const [customWidth, setCustomWidth] = useState<string>("")
  const [customHeight, setCustomHeight] = useState<string>("")
  const [customSizeApplied, setCustomSizeApplied] = useState<string | null>(null)
  const [customSizeFeedback, setCustomSizeFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  )
  const [customApplyState, setCustomApplyState] = useState<"idle" | "success" | "error">("idle")
  const [customSizeAppliedAt, setCustomSizeAppliedAt] = useState<string | null>(null)



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

  const { getEnabledProviders: getEnabledProviderSettings, getProvider, settings } = useProviderSettings()
  const { toast } = useToast()
  const falCategory = mode === "img2img" ? "image-to-image" : "text-to-image"
  const falProvider = getProvider("fal")
  const newapiProvider = getProvider("newapi")
  const openrouterProvider = getProvider("openrouter")
  const openaiProvider = getProvider("openai")
  const updateFalModel = useCallback(
    (modelId: string) => {
      falModelByCategoryRef.current = {
        ...falModelByCategoryRef.current,
        [falCategory]: modelId,
      }
      setSelectedFalModel(modelId)
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
  const selectedFalModelOption = useMemo(
    () => deferredFalModels.find((model) => model.id === selectedFalModel),
    [deferredFalModels, selectedFalModel],
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
    // NewAPI size options based on model
    if (safeSelectedProvider === "newapi") {
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
  }, [mode, safeSelectedProvider, selectedNewapiModel, customAppliedValue])

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
    if (selectedNewapiModel === "dall-e-3") {
      return ["standard", "hd"].includes(newapiQuality) ? newapiQuality : "standard"
    }
    if (selectedNewapiModel === "gpt-image-1") {
      return ["auto", "low", "medium", "high"].includes(newapiQuality) ? newapiQuality : "auto"
    }
    if (selectedNewapiModel === "dall-e-2") {
      return "standard"
    }
    return newapiQuality
  }, [newapiQuality, selectedNewapiModel, safeSelectedProvider])
  
  const safeNumImages = useMemo(() => {
    if (safeSelectedProvider === "newapi" && selectedNewapiModel === "dall-e-3") {
      return Math.min(numImages, 1)
    }
    return numImages
  }, [numImages, selectedNewapiModel, safeSelectedProvider])

  const normalizeFalModelFromEndpoint = useCallback(() => {
    const providers = getEnabledProviderSettings()
    const falProvider = providers.find((provider) => provider.id === "fal")
    const endpoint = falProvider?.endpoint

    if (!endpoint) {
      return "fal-ai/flux/dev"
    }

    try {
      const url = new URL(endpoint)
      const path = url.pathname.replace(/^\/+/, "")
      return path || "fal-ai/flux/dev"
    } catch {
      return endpoint.replace(/^https?:\/\/[^/]+\//, "") || "fal-ai/flux/dev"
    }
  }, [getEnabledProviderSettings])

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
      falModelByCategoryRef.current = {
        "text-to-image": "fal-ai/flux/dev",
        "image-to-image": "fal-ai/flux/dev",
      }
      setSelectedFalModel("fal-ai/flux/dev")
      setSelectedNewapiModel("dall-e-2")
      setNewapiQuality("standard")
      setNewapiStyle("vivid")
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
    const normalized = normalizeFalModelFromEndpoint()
    falModelByCategoryRef.current = {
      "text-to-image": normalized,
      "image-to-image": normalized,
    }
    setSelectedFalModel(normalized)
    setSelectedNewapiModel("dall-e-2")
    setNewapiQuality("standard")
    setNewapiStyle("vivid")
    setSelectedProvider((prev) => (providers.some((provider) => provider.id === prev) ? prev : providers[0]?.id || ""))
  }, [getEnabledProviderSettings, normalizeFalModelFromEndpoint])

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

    const modelFromEndpoint = normalizeFalModelFromEndpoint()
    if (falModels.some((model) => model.id === modelFromEndpoint)) {
      fallback = modelFromEndpoint
    }

    if (!fallback) {
      fallback = falModels[0]?.id ?? "fal-ai/flux/dev"
    }

    if (fallback) {
      updateFalModel(fallback)
    }
  }, [falModels, normalizeFalModelFromEndpoint, falCategory, safeSelectedProvider, selectedFalModel, updateFalModel])

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

  const handleGenerate = async () => {
    const isImg2ImgMode = mode === "img2img"
    const hasImages = images.length > 0

    if (!prompt.trim() && !(isImg2ImgMode && hasImages)) {
      toast({
        title: "提示词不能为空",
        description: isImg2ImgMode
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
      return
    }

    if (isImg2ImgMode && !hasImages) {
      toast({
        title: "请先上传图片",
        description: "图片编辑模式需要至少上传一张图片",
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
      return
    }

    const modelId = provider.id === "fal"
      ? selectedFalModel
      : provider.id === "newapi"
      ? selectedNewapiModel
      : provider.id === "openrouter"
      ? selectedOpenRouterModel
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
        return
      }
    }

    await onGenerate(provider, {
      prompt,
      imageSize: effectiveImageSize,
      numImages: safeNumImages,
      seed,
      safetyChecker,
      syncMode,
      images: mode === "img2img" ? images : undefined,
      modelId,
      quality: provider.id === "newapi" ? safeNewapiQuality : undefined,
      style: provider.id === "newapi" ? newapiStyle : undefined,
      openaiApiKey,
    })
  }

  return (
    <section className="rounded-none border-0 bg-transparent p-0">
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 className="text-lg font-mono uppercase tracking-widest text-primary">Generation Protocols</h2>
            <p className="text-xs font-mono text-muted-foreground">
              {mode === "img2img" ? ">> INJECT SOURCE IMAGE" : ">> ENTER VISUAL PARAMETERS"}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-none border-border hover:bg-primary/20 hover:text-primary font-mono text-xs"
            onClick={() => {
              resetForm()
              onReset?.()
            }}
          >
            <RotateCcw className="h-3 w-3" />
            RESET_SYSTEM
          </Button>
          </header>

          <div className="grid gap-6">
          <div className="bg-card/50 p-4 border border-border backdrop-blur-sm">
            <div className="flex items-center justify-between pb-3">
              <Label htmlFor="prompt" className="text-xs font-mono text-primary">
                  PROMPT_INPUT
                </Label>
              <span className="text-[10px] font-mono text-muted-foreground">{prompt.length} / 1000</span>
            </div>
            <Textarea
              id="prompt"
              placeholder="INPUT VISUAL DATA STREAM..."
              className="min-h-[140px] resize-none bg-background/50 border-border text-foreground font-mono text-sm focus-visible:ring-primary rounded-none"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={1000}
            />
          </div>

          <section className="bg-card/50 p-4 border border-border backdrop-blur-sm">
            <header className="flex items-center justify-between pb-4">
              <h3 className="text-xs font-mono text-primary">MODEL_SELECTION</h3>
              {safeSelectedProvider === "fal" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{falModels.length} 个可用模型</span>
                  {falModelsUpdatedAtLabel ? (
                    <span className="hidden text-xs text-gray-400 sm:inline">更新于 {falModelsUpdatedAtLabel}</span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-gray-600 hover:text-gray-900"
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
                  <span className="text-xs text-gray-500">
                    {isLoadingNewApiModels ? "加载中..." : `${newapiModels.length} 个可用模型`}
                  </span>
                  {newapiModelsUpdatedAtLabel ? (
                    <span className="hidden text-xs text-gray-400 sm:inline">更新于 {newapiModelsUpdatedAtLabel}</span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-gray-600 hover:text-gray-900"
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
                  <span className="text-xs text-gray-500">
                    {isLoadingOpenRouterModels ? "加载中..." : `${openrouterModels.length} 个可用模型`}
                  </span>
                  {openrouterModelsUpdatedAtLabel ? (
                    <span className="hidden text-xs text-gray-400 sm:inline">更新于 {openrouterModelsUpdatedAtLabel}</span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-gray-600 hover:text-gray-900"
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
                <Label htmlFor="provider" className="text-sm font-medium text-gray-900">
                  AI 供应商
                </Label>
                <Select
                  value={safeSelectedProvider}
                  onValueChange={setSelectedProvider}
                  disabled={providerOptions.length === 0}
                >
                  <SelectTrigger
                    id="provider"
                    className="h-10 w-full rounded-lg border-2 border-gray-200 bg-white px-3 text-left text-sm font-medium text-gray-900 hover:border-gray-300 focus-visible:border-gray-900 focus-visible:ring-0"
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
                  <Label htmlFor="fal-model" className="text-sm font-medium text-gray-900">
                    FAL 模型
                  </Label>
                  <Popover open={isFalModelPopoverOpen} onOpenChange={setIsFalModelPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="fal-model"
                        variant="outline"
                        role="combobox"
                        aria-expanded={isFalModelPopoverOpen}
                        className="flex h-10 w-full min-w-0 items-center justify-between gap-4 rounded-lg border-2 border-gray-200 bg-white px-3 text-left text-sm font-medium text-gray-900 hover:border-gray-300 focus-visible:border-gray-900 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="text-left truncate" title={falModelButtonLabel}>
                          {falModelButtonLabel}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 text-gray-500" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 shadow-lg" align="start">
                      <Command
                        loop
                        className="rounded-lg border-2 border-gray-200"
                      >
                        <div className="border-b border-gray-100 px-3 py-2">
                          <CommandInput 
                            placeholder="搜索模型名称或 ID…" 
                            className="border-none focus:ring-0"
                            value={falSearch}
                            onValueChange={handleFalSearchChange}
                          />
                        </div>
                        <CommandList ref={falListRef} className="max-h-80 overflow-y-auto p-2">
                          {isLoadingFalModels && !hasFalModels ? (
                            <div className="py-8 text-center text-sm text-gray-500">
                              <div className="mb-2">正在加载模型列表…</div>
                            </div>
                          ) : (
                            <>
                              <CommandEmpty className="py-8 text-center text-sm text-gray-500">
                                未找到匹配的模型
                              </CommandEmpty>
                              <CommandGroup>
                                {deferredFalModels.map((model) => (
                                  <CommandItem
                                    key={model.id}
                                    value={`${model.title} ${model.id} ${(model.tags || []).join(" ")}`}
                                    onSelect={() => {
                                      updateFalModel(model.id)
                                      setIsFalModelPopoverOpen(false)
                                    }}
                                    className={cn(
                                      "mb-1 cursor-pointer rounded-lg border-2 border-transparent px-3 py-3 transition-all",
                                      "hover:border-gray-200 hover:bg-gray-50",
                                      "aria-selected:border-gray-300 aria-selected:bg-gray-50",
                                      selectedFalModel === model.id && "border-gray-900 bg-gray-50"
                                    )}
                                  >
                                    <div className="flex flex-1 flex-col gap-0.5">
                                      <span className="text-sm font-semibold text-gray-900">{model.title}</span>
                                      <span className="text-xs text-gray-500">{model.id}</span>
                                    </div>
                                    {selectedFalModel === model.id ? (
                                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-900">
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
                  {falModelsError ? <p className="text-xs text-destructive">加载 FAL 模型失败：{falModelsError}</p> : null}
                </div>
              ) : null}
              
              {safeSelectedProvider === "newapi" ? (
                <div className="space-y-2">
                  <Label htmlFor="newapi-model" className="text-sm font-medium text-gray-900">
                    NewAPI 模型
                  </Label>
                  <Popover open={isNewapiModelPopoverOpen} onOpenChange={setIsNewapiModelPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="newapi-model"
                        variant="outline"
                        role="combobox"
                        aria-expanded={isNewapiModelPopoverOpen}
                        className="flex w-full min-w-0 items-center justify-between gap-4 rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-left text-sm font-medium text-gray-900 hover:border-gray-300 focus-visible:border-gray-900 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="text-left truncate" title={newapiModelButtonLabel}>
                          {newapiModelButtonLabel}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 text-gray-500" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 shadow-lg" align="start">
                      <Command
                        loop
                        className="rounded-lg border-2 border-gray-200"
                      >
                        <div className="border-b border-gray-100 px-3 py-2">
                          <CommandInput 
                            placeholder="搜索模型名称或渠道…" 
                            className="border-none focus:ring-0"
                            value={newapiSearch}
                            onValueChange={handleNewapiSearchChange}
                          />
                        </div>
                        <CommandList ref={newapiListRef} className="max-h-80 overflow-y-auto p-2">
                          {isLoadingNewApiModels && !hasNewapiModels ? (
                            <div className="py-8 text-center text-sm text-gray-500">
                              <div className="mb-2">正在加载模型列表…</div>
                            </div>
                          ) : (
                            <>
                              <CommandEmpty className="py-8 text-center text-sm text-gray-500">
                                未找到匹配的模型
                              </CommandEmpty>
                              <CommandGroup>
                                {hasNewapiModels ? (
                                  deferredNewapiModels.map((model) => (
                                    <CommandItem
                                      key={model.id}
                                      value={`${model.id} ${model.channel || ""}`}
                                      onSelect={() => {
                                        setSelectedNewapiModel(model.id)
                                        setIsNewapiModelPopoverOpen(false)
                                      }}
                                      className={cn(
                                        "mb-1 cursor-pointer rounded-lg border-2 border-transparent px-3 py-3 transition-all",
                                        "hover:border-gray-200 hover:bg-gray-50",
                                        "aria-selected:border-gray-300 aria-selected:bg-gray-50",
                                        selectedNewapiModel === model.id && "border-gray-900 bg-gray-50"
                                      )}
                                    >
                                      <div className="flex flex-1 flex-col gap-0.5">
                                        <span className="text-sm font-semibold text-gray-900">{model.id}</span>
                                        {model.channel && model.channel !== "default" && (
                                          <span className="text-xs text-gray-500">渠道：{model.channel}</span>
                                        )}
                                      </div>
                                      {selectedNewapiModel === model.id ? (
                                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-900">
                                          <Check className="h-3 w-3 text-white" />
                                        </div>
                                      ) : null}
                                    </CommandItem>
                                  ))
                                ) : (
                                  <>
                                    {["dall-e-2", "dall-e-3", "gpt-image-1"].map((modelId) => (
                                      <CommandItem
                                        key={modelId}
                                        value={modelId}
                                        onSelect={() => {
                                          setSelectedNewapiModel(modelId)
                                          setIsNewapiModelPopoverOpen(false)
                                        }}
                                        className={cn(
                                          "mb-1 cursor-pointer rounded-lg border-2 border-transparent px-3 py-3 transition-all",
                                          "hover:border-gray-200 hover:bg-gray-50",
                                          "aria-selected:border-gray-300 aria-selected:bg-gray-50",
                                          selectedNewapiModel === modelId && "border-gray-900 bg-gray-50"
                                        )}
                                      >
                                        <div className="flex flex-1 flex-col gap-0.5">
                                          <span className="text-sm font-semibold text-gray-900">{modelId}</span>
                                          <span className="text-xs text-gray-500">默认模型</span>
                                        </div>
                                        {selectedNewapiModel === modelId ? (
                                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-900">
                                            <Check className="h-3 w-3 text-white" />
                                          </div>
                                        ) : null}
                                      </CommandItem>
                                    ))}
                                  </>
                                )}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              ) : null}

              {safeSelectedProvider === "openrouter" ? (
                <div className="space-y-2">
                  <Label htmlFor="openrouter-model" className="text-sm font-medium text-gray-900">
                    OpenRouter 模型
                  </Label>
                  <Popover open={isOpenRouterModelPopoverOpen} onOpenChange={setIsOpenRouterModelPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="openrouter-model"
                        variant="outline"
                        role="combobox"
                        aria-expanded={isOpenRouterModelPopoverOpen}
                        className="flex w-full min-w-0 items-center justify-between gap-4 rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-left text-sm font-medium text-gray-900 hover:border-gray-300 focus-visible:border-gray-900 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="text-left truncate" title={openrouterModelButtonLabel}>
                          {openrouterModelButtonLabel}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 text-gray-500" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 shadow-lg" align="start">
                      <Command
                        loop
                        className="rounded-lg border-2 border-gray-200"
                      >
                        <div className="border-b border-gray-100 px-3 py-2">
                          <CommandInput 
                            placeholder="搜索模型名称…" 
                            className="border-none focus:ring-0"
                            value={openrouterSearch}
                            onValueChange={handleOpenrouterSearchChange}
                          />
                        </div>
                        <CommandList ref={openrouterListRef} className="max-h-80 overflow-y-auto p-2">
                          {isLoadingOpenRouterModels && !hasOpenRouterModels ? (
                            <div className="py-8 text-center text-sm text-gray-500">
                              <div className="mb-2">正在加载模型列表…</div>
                            </div>
                          ) : (
                            <>
                              <CommandEmpty className="py-8 text-center text-sm text-gray-500">
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
                                      "mb-1 cursor-pointer rounded-lg border-2 border-transparent px-3 py-3 transition-all",
                                      "hover:border-gray-200 hover:bg-gray-50",
                                      "aria-selected:border-gray-300 aria-selected:bg-gray-50",
                                      selectedOpenRouterModel === model.id && "border-gray-900 bg-gray-50"
                                    )}
                                  >
                                    <div className="flex flex-1 flex-col gap-0.5">
                                      <span className="text-sm font-semibold text-gray-900">{model.name || model.id}</span>
                                      <span className="text-xs text-gray-500">{model.id}</span>
                                      {model.owned_by && (
                                        <span className="text-xs text-gray-400">提供商：{model.owned_by}</span>
                                      )}
                                    </div>
                                    {selectedOpenRouterModel === model.id ? (
                                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-900">
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
            </div>
            
            {safeSelectedProvider === "newapi" ? (
              <div className="mt-4 grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newapi-quality" className="text-sm font-medium text-gray-900">
                    图片质量
                  </Label>
                  <Select
                    value={safeNewapiQuality}
                    onValueChange={setNewapiQuality}
                  >
                    <SelectTrigger id="newapi-quality">
                      <SelectValue placeholder="选择质量" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedNewapiModel === "dall-e-3" ? (
                        <>
                          <SelectItem value="standard">标准质量</SelectItem>
                          <SelectItem value="hd">高清质量</SelectItem>
                        </>
                      ) : selectedNewapiModel === "gpt-image-1" ? (
                        <>
                          <SelectItem value="auto">自动（推荐）</SelectItem>
                          <SelectItem value="low">低质量</SelectItem>
                          <SelectItem value="medium">中等质量</SelectItem>
                          <SelectItem value="high">高质量</SelectItem>
                        </>
                      ) : (
                        <SelectItem value="standard">标准质量</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedNewapiModel === "dall-e-3" ? (
                  <div className="space-y-2">
                    <Label htmlFor="newapi-style" className="text-sm font-medium text-gray-900">
                      图片风格
                    </Label>
                    <Select
                      value={newapiStyle}
                      onValueChange={setNewapiStyle}
                    >
                      <SelectTrigger id="newapi-style">
                        <SelectValue placeholder="选择风格" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vivid">鲜艳生动</SelectItem>
                        <SelectItem value="natural">自然真实</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      鲜艳适合创意设计，自然适合写实场景
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
      
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <header className="pb-4">
              <h3 className="text-sm font-semibold text-gray-900">图片参数</h3>
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="size" className="text-sm font-medium text-gray-900">
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
                          <span aria-hidden>✅</span>
                          <span>已应用：{customSizeApplied.replace("x", " × ")}</span>
                        </span>
                      ) : customApplyState === "error" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                          <span aria-hidden>⚠️</span>
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
                      <span className="text-sm text-gray-500 text-center">x</span>
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
                    <p className="text-xs text-gray-500">64 - 4096 正整数，例如 1400 x 900</p>
                    <p
                      role="status"
                      className={`text-xs ${
                        customSizeFeedback
                          ? customSizeFeedback.type === "success"
                            ? "text-green-600 font-semibold"
                            : "text-rose-600 font-semibold"
                          : "text-gray-500"
                      }`}
                    >
                      {customSizeFeedback ? customSizeFeedback.message : ""}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="num_images" className="text-sm font-medium text-gray-900">
                  生成数量
                </Label>
                <Input
                  id="num_images"
                  type="number"
                  value={safeNumImages}
                  onChange={(e) => setNumImages(Number(e.target.value))}
                  min={1}
                  max={safeSelectedProvider === "newapi" && selectedNewapiModel === "dall-e-3" ? 1 : 4}
                  disabled={safeSelectedProvider === "newapi" && selectedNewapiModel === "dall-e-3"}
                />
                {safeSelectedProvider === "newapi" && selectedNewapiModel === "dall-e-3" && (
                  <p className="text-xs text-amber-600">DALL·E 3 仅支持单张图片生成</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="seed" className="text-sm font-medium text-gray-900">
                  随机种子 <span className="text-xs text-gray-500">（可选）</span>
                </Label>
                <Input
                  id="seed"
                  type="number"
                  placeholder="保持为空将随机生成"
                  value={seed ?? ""}
                  onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <header className="pb-4">
              <h3 className="text-sm font-semibold text-gray-900">高级选项</h3>
            </header>

            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">安全检查</p>
                  <p className="text-xs text-gray-600">启用内容安全过滤，确保生成内容合规</p>
                </div>
                <Switch id="safety" checked={safetyChecker} onCheckedChange={setSafetyChecker} />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">同步模式</p>
                  <p className="text-xs text-gray-600">等待生成完成后再返回结果</p>
                </div>
                <Switch id="sync" checked={syncMode} onCheckedChange={setSyncMode} />
              </div>
            </div>
          </section>
        </div>

        <Button
          className="flex w-full items-center justify-center gap-2 rounded-none bg-primary py-6 text-base font-mono font-bold text-primary-foreground hover:bg-primary/80 hover:shadow-[0_0_20px_rgba(var(--primary),0.5)] disabled:opacity-60 transition-all duration-300 neon-border"
          size="lg"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          <Wand2 className={`h-5 w-5 ${isGenerating ? "animate-spin" : ""}`} />
          {isGenerating ? "PROCESSING_DATA..." : "INITIALIZE_GENERATION"}
        </Button>
      </div>


    </section>
  )
}
