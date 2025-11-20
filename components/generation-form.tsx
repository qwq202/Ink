"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
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

const PREFERENCES_STORAGE_KEY = "generation-form-preferences"

type GenerationPreferences = {
  providerId: string
  falModel: string
  newapiModel: string
  openrouterModel: string
  imageSize: string
  numImages: number
  seed: number | null
  safetyChecker: boolean
  syncMode: boolean
  newapiQuality: string
  newapiStyle: string
}

interface GenerationFormProps {
  mode: "img2img" | "txt2img"
  images?: File[]
  isGenerating: boolean
  onReset?: () => void
  resetSignal?: number
  onGenerate: (provider: ProviderConfig, params: GenerationParams) => Promise<GenerationResult>
}

export function GenerationForm({
  mode,
  images = [],
  isGenerating,
  onGenerate,
  onReset,
  resetSignal,
}: GenerationFormProps) {
  const [prompt, setPrompt] = useState("")
  const [selectedProvider, setSelectedProvider] = useState("fal")
  const [imageSize, setImageSize] = useState("square")
  const [numImages, setNumImages] = useState(1)
  const [seed, setSeed] = useState<number | undefined>()
  const [safetyChecker, setSafetyChecker] = useState(true)
  const [syncMode, setSyncMode] = useState(true)
  const [selectedFalModel, setSelectedFalModel] = useState<string>("fal-ai/flux/dev")
  const [isFalModelPopoverOpen, setIsFalModelPopoverOpen] = useState(false)
  const prefetchedCategoriesRef = useRef<Set<string>>(new Set())
  const hasInitialPreferencesRef = useRef(false)
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false)
  const hasInitializedResetSignalRef = useRef(false)
  
  // NewAPI states
  const [selectedNewapiModel, setSelectedNewapiModel] = useState<string>("dall-e-2")
  const [isNewapiModelPopoverOpen, setIsNewapiModelPopoverOpen] = useState(false)
  const [newapiQuality, setNewapiQuality] = useState<string>("standard")
  const [newapiStyle, setNewapiStyle] = useState<string>("vivid")

  // OpenRouter states
  const [selectedOpenRouterModel, setSelectedOpenRouterModel] = useState<string>("google/gemini-2.5-flash-image")
  const [isOpenRouterModelPopoverOpen, setIsOpenRouterModelPopoverOpen] = useState(false)

  const { getEnabledProviders: getEnabledProviderSettings, getProvider, settings } = useProviderSettings()
  const { toast } = useToast()
  const falCategory = mode === "img2img" ? "image-to-image" : "text-to-image"
  const falProvider = getProvider("fal")
  const newapiProvider = getProvider("newapi")
  const openrouterProvider = getProvider("openrouter")
  const openaiProvider = getProvider("openai")
  const openrouterEndpoint = openrouterProvider?.endpoint?.trim() || "https://openrouter.ai/api/v1"

  useEffect(() => {
    if (typeof window === "undefined") {
      setHasLoadedPreferences(true)
      return
    }

    let parsed: Partial<GenerationPreferences> | null = null
    let hadPreferences = false

    try {
      const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY)
      if (raw) {
        parsed = JSON.parse(raw) as Partial<GenerationPreferences>
      }
    } catch (error) {
      console.warn("[GenerationForm] Failed to parse stored preferences", error)
    }

    if (parsed && typeof parsed === "object") {
      hadPreferences = true

      if (typeof parsed.providerId === "string") {
        setSelectedProvider(parsed.providerId)
      }
      if (typeof parsed.falModel === "string") {
        setSelectedFalModel(parsed.falModel)
      }
      if (typeof parsed.newapiModel === "string") {
        setSelectedNewapiModel(parsed.newapiModel)
      }
      if (typeof parsed.openrouterModel === "string") {
        setSelectedOpenRouterModel(parsed.openrouterModel)
      }
      if (typeof parsed.imageSize === "string") {
        setImageSize(parsed.imageSize)
      }
      if (typeof parsed.numImages === "number" && Number.isFinite(parsed.numImages)) {
        setNumImages(Math.min(4, Math.max(1, Math.round(parsed.numImages))))
      }
      if (parsed.seed === null) {
        setSeed(undefined)
      } else if (typeof parsed.seed === "number" && Number.isFinite(parsed.seed)) {
        setSeed(parsed.seed)
      }
      if (typeof parsed.safetyChecker === "boolean") {
        setSafetyChecker(parsed.safetyChecker)
      }
      if (typeof parsed.syncMode === "boolean") {
        setSyncMode(parsed.syncMode)
      }
      if (typeof parsed.newapiQuality === "string") {
        setNewapiQuality(parsed.newapiQuality)
      }
      if (typeof parsed.newapiStyle === "string") {
        setNewapiStyle(parsed.newapiStyle)
      }
    }

    hasInitialPreferencesRef.current = hadPreferences
    setHasLoadedPreferences(true)
  }, [])

  // Log provider changes
  useEffect(() => {
    console.log('[GenerationForm] Provider settings updated:', {
      openrouter: {
        enabled: openrouterProvider?.enabled,
        hasApiKey: !!openrouterProvider?.apiKey,
        endpoint: openrouterProvider?.endpoint,
      }
    })
  }, [openrouterProvider])
  const shouldLoadFalModels = selectedProvider === "fal"
  const shouldLoadNewApiModels = selectedProvider === "newapi"
  const shouldLoadOpenRouterModels = selectedProvider === "openrouter"
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
  
  // Debug log for OpenRouter
  useEffect(() => {
    if (selectedProvider === "openrouter") {
      console.log('[GenerationForm] OpenRouter provider:', {
        hasProvider: !!openrouterProvider,
        enabled: openrouterProvider?.enabled,
        hasApiKey: !!openrouterProvider?.apiKey,
        hasEndpoint: !!openrouterProvider?.endpoint,
        endpoint: openrouterProvider?.endpoint,
        modelsCount: openrouterModels.length,
      })
    }
  }, [selectedProvider, openrouterProvider, openrouterModels])
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

  const providerOptions = useMemo(() => {
    const enabledProviders = getEnabledProviderSettings()
    return enabledProviders.map((provider) => ({
      id: provider.id,
      label: provider.name,
    }))
  }, [getEnabledProviderSettings])

  useEffect(() => {
    setSelectedProvider((prev) => {
      if (providerOptions.length === 0) {
        return ""
      }
      return providerOptions.some((option) => option.id === prev) ? prev : providerOptions[0].id
    })
  }, [providerOptions])
  const imageSizeOptions = useMemo(() => {
    // NewAPI size options based on model
    if (selectedProvider === "newapi") {
      if (selectedNewapiModel === "dall-e-2") {
        const options = [
          { value: "256x256", label: "小图 · 256 x 256" },
          { value: "512x512", label: "中图 · 512 x 512" },
          { value: "1024x1024", label: "大图 · 1024 x 1024" },
        ]
        return mode === "img2img" ? [{ value: "auto", label: "与原图相同（推荐）" }, ...options] : options
      }
      
      if (selectedNewapiModel === "dall-e-3") {
        return [
          { value: "1024x1024", label: "方形 · 1024 x 1024" },
          { value: "1792x1024", label: "横向 · 1792 x 1024" },
          { value: "1024x1792", label: "纵向 · 1024 x 1792" },
        ]
      }
      
      if (selectedNewapiModel === "gpt-image-1") {
        const options = [
          { value: "1024x1024", label: "方形 · 1024 x 1024" },
          { value: "1536x1024", label: "横向 · 1536 x 1024" },
          { value: "1024x1536", label: "纵向 · 1024 x 1536" },
        ]
        return mode === "img2img" ? [{ value: "auto", label: "与原图相同（推荐）" }, ...options] : options
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
    ]

    if (mode === "img2img") {
      return [{ value: "auto", label: "与原图相同（推荐）" }, ...baseOptions]
    }

    return baseOptions
  }, [mode, selectedProvider, selectedNewapiModel])

  useEffect(() => {
    setImageSize((current) => {
      // Check if current size is valid for current provider/model
      const validSizes = imageSizeOptions.map(opt => opt.value)
      if (!validSizes.includes(current)) {
        return imageSizeOptions[0]?.value || "square"
      }
      
      if (mode === "img2img" && current === "square") {
        return "auto"
      }
      if (mode === "txt2img" && current === "auto") {
        return imageSizeOptions.find(opt => opt.value !== "auto")?.value || "square"
      }
      return current
    })
  }, [mode, imageSizeOptions])

  useEffect(() => {
    if (!shouldLoadFalModels || !falProvider || falModels.length === 0) {
      return
    }

    const targetCategory = mode === "img2img" ? "text-to-image" : "image-to-image"
    const signature = `${falProvider.apiKey || "anon"}:${targetCategory}`
    if (prefetchedCategoriesRef.current.has(signature)) {
      return
    }

    const prefetchPromise = prefetchFalModels(targetCategory, { apiKey: falProvider.apiKey })
    prefetchedCategoriesRef.current.add(signature)

    prefetchPromise.catch(() => {
      prefetchedCategoriesRef.current.delete(signature)
    })
  }, [falModels.length, falProvider, mode, shouldLoadFalModels])
  
  // Auto-adjust NewAPI quality when model changes
  useEffect(() => {
    if (selectedProvider !== "newapi") return
    
    if (selectedNewapiModel === "dall-e-3") {
      if (newapiQuality !== "standard" && newapiQuality !== "hd") {
        setNewapiQuality("standard")
      }
    } else if (selectedNewapiModel === "gpt-image-1") {
      if (!["auto", "low", "medium", "high"].includes(newapiQuality)) {
        setNewapiQuality("auto")
      }
    } else if (selectedNewapiModel === "dall-e-2") {
      if (newapiQuality !== "standard") {
        setNewapiQuality("standard")
      }
    }
  }, [selectedProvider, selectedNewapiModel, newapiQuality])
  
  // Limit DALL-E 3 to 1 image
  useEffect(() => {
    if (selectedProvider === "newapi" && selectedNewapiModel === "dall-e-3") {
      if (numImages > 1) {
        setNumImages(1)
      }
    }
  }, [selectedProvider, selectedNewapiModel, numImages])

  useEffect(() => {
    if (!hasLoadedPreferences || typeof window === "undefined") {
      return
    }

    const payload: GenerationPreferences = {
      providerId: selectedProvider,
      falModel: selectedFalModel,
      newapiModel: selectedNewapiModel,
      openrouterModel: selectedOpenRouterModel,
      imageSize,
      numImages: Math.min(4, Math.max(1, Math.round(numImages || 1))),
      seed: typeof seed === "number" && Number.isFinite(seed) ? seed : null,
      safetyChecker,
      syncMode,
      newapiQuality,
      newapiStyle,
    }

    try {
      window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(payload))
    } catch (error) {
      console.warn("[GenerationForm] Failed to persist preferences", error)
    }
  }, [hasLoadedPreferences, selectedProvider, selectedFalModel, selectedNewapiModel, selectedOpenRouterModel, imageSize, numImages, seed, safetyChecker, syncMode, newapiQuality, newapiStyle])

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
      setImageSize("square")
      setNumImages(1)
      setSeed(undefined)
      setSafetyChecker(true)
      setSyncMode(true)
      setSelectedFalModel("fal-ai/flux/dev")
      setSelectedNewapiModel("dall-e-2")
      setNewapiQuality("standard")
      setNewapiStyle("vivid")
      setSelectedProvider("")
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(PREFERENCES_STORAGE_KEY)
        } catch (error) {
          console.warn("[GenerationForm] Failed to clear stored preferences", error)
        }
      }
      return
    }
    setPrompt("")
    setImageSize("square")
    setNumImages(1)
    setSeed(undefined)
    setSafetyChecker(true)
    setSyncMode(true)
    setSelectedFalModel(normalizeFalModelFromEndpoint())
    setSelectedNewapiModel("dall-e-2")
    setNewapiQuality("standard")
    setNewapiStyle("vivid")
    setSelectedProvider((prev) => (providers.some((provider) => provider.id === prev) ? prev : providers[0]?.id || ""))
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(PREFERENCES_STORAGE_KEY)
      } catch (error) {
        console.warn("[GenerationForm] Failed to clear stored preferences", error)
      }
    }
  }, [getEnabledProviderSettings, normalizeFalModelFromEndpoint])

  useEffect(() => {
    if (!hasLoadedPreferences || hasInitialPreferencesRef.current) {
      return
    }
    const frame = requestAnimationFrame(() => {
      resetForm()
    })
    return () => cancelAnimationFrame(frame)
  }, [hasLoadedPreferences, resetForm])

  useEffect(() => {
    if (resetSignal === undefined) return
    if (!hasInitializedResetSignalRef.current) {
      hasInitializedResetSignalRef.current = true
      return
    }
    const frame = requestAnimationFrame(() => {
      resetForm()
    })
    return () => cancelAnimationFrame(frame)
  }, [resetSignal, resetForm])

  useEffect(() => {
    if (!falModels.length) return
    const frame = requestAnimationFrame(() => {
      setSelectedFalModel((prev) => {
        if (prev && falModels.some((model) => model.id === prev)) {
          return prev
        }

        if (hasInitialPreferencesRef.current && selectedProvider === "fal") {
          const storedFalModel = (() => {
            try {
              if (typeof window === "undefined") {
                return null
              }
              const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY)
              if (!raw) return null
              const parsed = JSON.parse(raw) as Partial<GenerationPreferences>
              return parsed?.falModel ?? null
            } catch {
              return null
            }
          })()

          if (storedFalModel && falModels.some((model) => model.id === storedFalModel)) {
            return storedFalModel
          }
        }

        const modelFromEndpoint = normalizeFalModelFromEndpoint()
        if (falModels.some((model) => model.id === modelFromEndpoint)) {
          return modelFromEndpoint
        }

        return falModels[0]?.id ?? "fal-ai/flux/dev"
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [falModels, normalizeFalModelFromEndpoint, falCategory, selectedProvider])

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
    const provider = enabledProviders.find((p) => p.id === selectedProvider)

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
      imageSize,
      numImages,
      seed,
      safetyChecker,
      syncMode,
      images: mode === "img2img" ? images : undefined,
      modelId,
      quality: provider.id === "newapi" ? newapiQuality : undefined,
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
              {selectedProvider === "fal" && (
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
              {selectedProvider === "newapi" && (
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
              {selectedProvider === "openrouter" && (
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
                      console.log('[GenerationForm] Refresh clicked, provider:', {
                        hasProvider: !!openrouterProvider,
                        enabled: openrouterProvider?.enabled,
                        apiKey: openrouterProvider?.apiKey ? `${openrouterProvider.apiKey.substring(0, 10)}...` : 'missing',
                        endpoint: openrouterEndpoint,
                      })
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
                  value={selectedProvider}
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

              {selectedProvider === "fal" ? (
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
                        className="flex h-10 w-full items-center justify-between gap-4 rounded-lg border-2 border-gray-200 bg-white px-3 text-left text-sm font-medium text-gray-900 hover:border-gray-300 focus-visible:border-gray-900 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="text-left">{falModelButtonLabel}</span>
                        <ChevronsUpDown className="h-4 w-4 text-gray-500" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 shadow-lg" align="start">
                      <Command loop className="rounded-lg border-2 border-gray-200">
                        <div className="border-b border-gray-100 px-3 py-2">
                          <CommandInput 
                            placeholder="搜索模型名称或 ID…" 
                            className="border-none focus:ring-0"
                          />
                        </div>
                        <CommandList className="max-h-80 overflow-y-auto p-2">
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
                                      setSelectedFalModel(model.id)
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
              
              {selectedProvider === "newapi" ? (
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
                        className="flex w-full items-center justify-between gap-4 rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-left text-sm font-medium text-gray-900 hover:border-gray-300 focus-visible:border-gray-900 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="text-left">{newapiModelButtonLabel}</span>
                        <ChevronsUpDown className="h-4 w-4 text-gray-500" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 shadow-lg" align="start">
                      <Command loop className="rounded-lg border-2 border-gray-200">
                        <div className="border-b border-gray-100 px-3 py-2">
                          <CommandInput 
                            placeholder="搜索模型名称或渠道…" 
                            className="border-none focus:ring-0"
                          />
                        </div>
                        <CommandList className="max-h-80 overflow-y-auto p-2">
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

              {selectedProvider === "openrouter" ? (
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
                        className="flex w-full items-center justify-between gap-4 rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-left text-sm font-medium text-gray-900 hover:border-gray-300 focus-visible:border-gray-900 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="text-left">{openrouterModelButtonLabel}</span>
                        <ChevronsUpDown className="h-4 w-4 text-gray-500" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 shadow-lg" align="start">
                      <Command loop className="rounded-lg border-2 border-gray-200">
                        <div className="border-b border-gray-100 px-3 py-2">
                          <CommandInput 
                            placeholder="搜索模型名称…" 
                            className="border-none focus:ring-0"
                          />
                        </div>
                        <CommandList className="max-h-80 overflow-y-auto p-2">
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
            
            {selectedProvider === "newapi" ? (
              <div className="mt-4 grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newapi-quality" className="text-sm font-medium text-gray-900">
                    图片质量
                  </Label>
                  <Select
                    value={newapiQuality}
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
                  value={imageSize}
                  onValueChange={setImageSize}
                  disabled={selectedProvider === "" || providerOptions.length === 0}
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="num_images" className="text-sm font-medium text-gray-900">
                  生成数量
                </Label>
                <Input
                  id="num_images"
                  type="number"
                  value={numImages}
                  onChange={(e) => setNumImages(Number(e.target.value))}
                  min={1}
                  max={selectedProvider === "newapi" && selectedNewapiModel === "dall-e-3" ? 1 : 4}
                  disabled={selectedProvider === "newapi" && selectedNewapiModel === "dall-e-3"}
                />
                {selectedProvider === "newapi" && selectedNewapiModel === "dall-e-3" && (
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
