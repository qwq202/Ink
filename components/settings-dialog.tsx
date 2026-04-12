"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Save, Eye, EyeOff, AlertTriangle } from "lucide-react"
import { useProviderSettings } from "@/hooks/use-provider-settings"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeTab?: string
  onTabChange?: (tab: string) => void
}

const PROVIDERS = [
  { id: "fal", label: "FAL", desc: "FAL 模型服务" },
  { id: "openai", label: "OpenAI", desc: "OpenAI 图片生成" },
  { id: "newapi", label: "NewAPI", desc: "NewAPI 接口" },
  { id: "openrouter", label: "OpenRouter", desc: "OpenRouter 接口" },
  { id: "gemini", label: "Gemini", desc: "Google Gemini" },
] as const

type OpenAIMode = "image" | "responses"

const OPENAI_IMAGE_ENDPOINT_DEFAULT = "https://api.openai.com/v1/images/generations"
const OPENAI_RESPONSES_ENDPOINT_DEFAULT = "https://api.openai.com/v1/responses"
const OPENAI_ENDPOINT_PROFILE_KEY = "ai-image-openai-endpoint-profile"

interface OpenAIEndpointProfile {
  mode: OpenAIMode
  imageEndpoint: string
  responsesEndpoint: string
}

function normalizeEndpoint(value: string, fallback: string) {
  const trimmed = value.trim()
  return trimmed.length ? trimmed : fallback
}

function inferOpenAIMode(endpoint: string): OpenAIMode {
  if (!endpoint) return "image"
  if (endpoint.includes("/responses")) return "responses"
  return "image"
}

function loadOpenAIEndpointProfile(): OpenAIEndpointProfile {
  if (typeof window === "undefined") {
    return {
      mode: "image",
      imageEndpoint: OPENAI_IMAGE_ENDPOINT_DEFAULT,
      responsesEndpoint: OPENAI_RESPONSES_ENDPOINT_DEFAULT,
    }
  }
  try {
    const raw = localStorage.getItem(OPENAI_ENDPOINT_PROFILE_KEY)
    if (!raw) throw new Error("no profile")

    const parsed = JSON.parse(raw) as Partial<OpenAIEndpointProfile>
    const mode: OpenAIMode = parsed.mode === "responses" ? "responses" : "image"
    return {
      mode,
      imageEndpoint: normalizeEndpoint(parsed.imageEndpoint || "", OPENAI_IMAGE_ENDPOINT_DEFAULT),
      responsesEndpoint: normalizeEndpoint(parsed.responsesEndpoint || "", OPENAI_RESPONSES_ENDPOINT_DEFAULT),
    }
  } catch {
    return {
      mode: "image",
      imageEndpoint: OPENAI_IMAGE_ENDPOINT_DEFAULT,
      responsesEndpoint: OPENAI_RESPONSES_ENDPOINT_DEFAULT,
    }
  }
}

function KeyInput({
  id,
  label,
  showKey,
  onToggleShow,
  value,
  onChange,
  placeholder,
  hint,
  safetyNote,
}: {
  id: string
  label: string
  showKey: boolean
  onToggleShow: () => void
  value: string
  onChange: (v: string) => void
  placeholder: string
  hint?: React.ReactNode
  safetyNote?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={showKey ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={onToggleShow}
        >
          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {safetyNote && <p className="text-xs text-muted-foreground">{safetyNote}</p>}
    </div>
  )
}

export function SettingsDialog({ open, onOpenChange, activeTab, onTabChange }: SettingsDialogProps) {
  const {
    settings,
    updateProvider,
    hasFalLegacyConfigInvalidated,
    dismissFalLegacyConfigNotice,
  } = useProviderSettings()
  const [showFalKey, setShowFalKey] = useState(false)
  const [showFalOpenAIKey, setShowFalOpenAIKey] = useState(false)
  const [showOpenAIKey, setShowOpenAIKey] = useState(false)
  const [showNewApiKey, setShowNewApiKey] = useState(false)
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const { toast } = useToast()

  const [falConfig, setFalConfig] = useState<{
    apiKey: string
    openaiApiKey: string
    enabled: boolean
  }>({
    apiKey: "",
    openaiApiKey: "",
    enabled: false,
  })

  const [openaiConfig, setOpenaiConfig] = useState({
    apiKey: "",
    mode: "image" as OpenAIMode,
    imageEndpoint: OPENAI_IMAGE_ENDPOINT_DEFAULT,
    responsesEndpoint: OPENAI_RESPONSES_ENDPOINT_DEFAULT,
    enabled: false,
  })

  const [newapiConfig, setNewapiConfig] = useState({
    apiKey: "",
    endpoint: "",
    enabled: false,
  })

  const [openrouterConfig, setOpenrouterConfig] = useState({
    apiKey: "",
    endpoint: "https://openrouter.ai/api/v1",
    enabled: false,
  })

  const [geminiConfig, setGeminiConfig] = useState({
    apiKey: "",
    enabled: false,
  })

  const [internalTab, setInternalTab] = useState("fal")
  const activeProvider = activeTab ?? internalTab
  const safetyNote = "密钥仅保存在本地加密存储，不会上传到服务器。"

  const isEnabled = (id: string) => {
    switch (id) {
      case "fal": return falConfig.enabled
      case "openai": return openaiConfig.enabled
      case "newapi": return newapiConfig.enabled
      case "openrouter": return openrouterConfig.enabled
      case "gemini": return geminiConfig.enabled
      default: return false
    }
  }

  const saveOpenAIEndpointProfile = (next: OpenAIEndpointProfile) => {
    if (typeof window === "undefined") return
    localStorage.setItem(
      OPENAI_ENDPOINT_PROFILE_KEY,
      JSON.stringify({
        ...next,
        imageEndpoint: normalizeEndpoint(next.imageEndpoint, OPENAI_IMAGE_ENDPOINT_DEFAULT),
        responsesEndpoint: normalizeEndpoint(next.responsesEndpoint, OPENAI_RESPONSES_ENDPOINT_DEFAULT),
      }),
    )
  }

  useEffect(() => {
    if (!settings) return

    const openAIProfile = loadOpenAIEndpointProfile()
    const endpointFromConfig = settings.openai.endpoint ?? OPENAI_IMAGE_ENDPOINT_DEFAULT
    const inferredMode = inferOpenAIMode(endpointFromConfig)
    const imageEndpointFromConfig =
      inferredMode === "image" ? endpointFromConfig : openAIProfile.imageEndpoint
    const responsesEndpointFromConfig =
      inferredMode === "responses" ? endpointFromConfig : openAIProfile.responsesEndpoint

    setFalConfig({
      apiKey: settings.fal.apiKey,
      openaiApiKey: settings.fal.openaiApiKey ?? "",
      enabled: settings.fal.enabled,
    })

    setOpenaiConfig({
      apiKey: settings.openai.apiKey,
      mode: settings.openai.openaiApiMode === "responses" ? "responses" : inferredMode === "responses" ? "responses" : openAIProfile.mode,
      imageEndpoint: normalizeEndpoint(imageEndpointFromConfig, OPENAI_IMAGE_ENDPOINT_DEFAULT),
      responsesEndpoint: normalizeEndpoint(responsesEndpointFromConfig, OPENAI_RESPONSES_ENDPOINT_DEFAULT),
      enabled: settings.openai.enabled,
    })

    setNewapiConfig({
      apiKey: settings.newapi.apiKey,
      endpoint: settings.newapi.endpoint ?? "",
      enabled: settings.newapi.enabled,
    })

    setOpenrouterConfig({
      apiKey: settings.openrouter.apiKey,
      endpoint: settings.openrouter.endpoint || "https://openrouter.ai/api/v1",
      enabled: settings.openrouter.enabled,
    })

    setGeminiConfig({
      apiKey: settings.gemini.apiKey,
      enabled: settings.gemini.enabled,
    })
  }, [settings])

  const handleSaveFal = async () => {
    await updateProvider("fal", { ...falConfig })
    dismissFalLegacyConfigNotice()
    toast({ title: "配置已保存", description: "FAL 配置已成功保存" })
  }

  const handleSaveOpenAI = async () => {
    const imageEndpoint = normalizeEndpoint(openaiConfig.imageEndpoint, OPENAI_IMAGE_ENDPOINT_DEFAULT)
    const responsesEndpoint = normalizeEndpoint(openaiConfig.responsesEndpoint, OPENAI_RESPONSES_ENDPOINT_DEFAULT)
    const nextOpenAIEndpoint =
      openaiConfig.mode === "responses" ? responsesEndpoint : imageEndpoint

    saveOpenAIEndpointProfile({
      mode: openaiConfig.mode,
      imageEndpoint,
      responsesEndpoint,
    })
    await updateProvider("openai", {
      apiKey: openaiConfig.apiKey,
      endpoint: nextOpenAIEndpoint,
      openaiApiMode: openaiConfig.mode,
      enabled: openaiConfig.enabled,
    })
    toast({ title: "配置已保存", description: "OpenAI 配置已成功保存" })
  }

  const handleSaveNewAPI = async () => {
    await updateProvider("newapi", newapiConfig)
    toast({ title: "配置已保存", description: "NewAPI 配置已成功保存" })
  }

  const handleSaveGemini = async () => {
    await updateProvider("gemini", {
      ...geminiConfig,
      endpoint: "https://generativelanguage.googleapis.com",
    })
    toast({ title: "配置已保存", description: "Gemini 配置已成功保存" })
  }

  const handleSaveOpenRouter = async () => {
    if (!openrouterConfig.apiKey) {
      toast({ title: "配置不完整", description: "请填写 API Key", variant: "destructive" })
      return
    }

    const configToSave = {
      ...openrouterConfig,
      endpoint: "https://openrouter.ai/api/v1",
    }

    console.log('[Settings] Saving OpenRouter config:', {
      enabled: configToSave.enabled,
      hasApiKey: !!configToSave.apiKey,
      endpoint: configToSave.endpoint,
    })

    await updateProvider("openrouter", configToSave)
    toast({ title: "配置已保存", description: "OpenRouter 配置已成功保存" })
  }

  const testOpenAIConnection = async () => {
    const imageEndpoint = normalizeEndpoint(openaiConfig.imageEndpoint, OPENAI_IMAGE_ENDPOINT_DEFAULT)
    const responsesEndpoint = normalizeEndpoint(openaiConfig.responsesEndpoint, OPENAI_RESPONSES_ENDPOINT_DEFAULT)
    const endpoint =
      openaiConfig.mode === "responses" ? responsesEndpoint : imageEndpoint

    const requestHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiConfig.apiKey}`,
    }

    try {
      const init =
        openaiConfig.mode === "responses"
          ? {
              method: "POST",
              headers: requestHeaders,
              body: JSON.stringify({ model: "gpt-4.1-mini", input: "ping", max_output_tokens: 16 }),
            }
          : {
              method: "POST",
              headers: requestHeaders,
              body: JSON.stringify({ prompt: "ping", model: "gpt-image-1" }),
            }

      const res = await fetch(endpoint, init)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast({
        title: "OpenAI 连接正常",
        description: openaiConfig.mode === "responses" ? "Responses API 联通测试通过" : "Image API 联通测试通过",
      })
    } catch (error) {
      toast({
        title: "OpenAI 连接失败",
        description: error instanceof Error ? error.message : "请求错误",
        variant: "destructive",
      })
    }
  }

  const testNewApiConnection = async () => {
    try {
      const res = await fetch((newapiConfig.endpoint || "").replace(/\/$/, "") + "/models", {
        headers: newapiConfig.apiKey ? { Authorization: `Bearer ${newapiConfig.apiKey}` } : undefined,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast({ title: "NewAPI 连接正常" })
    } catch (error) {
      toast({
        title: "NewAPI 连接失败",
        description: error instanceof Error ? error.message : "请求错误",
        variant: "destructive",
      })
    }
  }

  const testOpenRouterConnection = async () => {
    try {
      const res = await fetch(openrouterConfig.endpoint || "https://openrouter.ai/api/v1/models", {
        headers: openrouterConfig.apiKey ? { Authorization: `Bearer ${openrouterConfig.apiKey}` } : undefined,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast({ title: "OpenRouter 连接正常" })
    } catch (error) {
      toast({
        title: "OpenRouter 连接失败",
        description: error instanceof Error ? error.message : "请求错误",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-4xl w-full bg-card text-foreground border-border p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>配置各 AI 服务的连接与密钥</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-[560px] max-h-[calc(100vh-12rem)] overflow-hidden">
          {/* Left: Provider List */}
          <nav className="w-52 shrink-0 border-r bg-muted/30 p-2 flex flex-col gap-0.5 overflow-y-auto">
            {PROVIDERS.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors cursor-pointer",
                  activeProvider === p.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
                onClick={() => {
                  setInternalTab(p.id)
                  onTabChange?.(p.id)
                }}
              >
                <span className="flex-1 font-medium">{p.label}</span>
                <Switch
                  checked={isEnabled(p.id)}
                  onCheckedChange={(checked) => {
                    if (p.id === "fal") setFalConfig((c) => ({ ...c, enabled: checked }))
                    else if (p.id === "openai") setOpenaiConfig((c) => ({ ...c, enabled: checked }))
                    else if (p.id === "newapi") setNewapiConfig((c) => ({ ...c, enabled: checked }))
                    else if (p.id === "openrouter") setOpenrouterConfig((c) => ({ ...c, enabled: checked }))
                    else if (p.id === "gemini") setGeminiConfig((c) => ({ ...c, enabled: checked }))
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ))}
          </nav>

          {/* Right: Config Form */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeProvider === "fal" && (
              <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <h3 className="text-base font-medium">FAL</h3>
                  <p className="text-sm text-muted-foreground mt-1">按官方推荐，仅需配置 FAL API Key，模型使用 `model_id` 管理。</p>
                </div>

                {hasFalLegacyConfigInvalidated && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <p>检测到旧版 FAL 配置（含 endpoint 或请求来源设置）已失效，请重新保存 FAL Key。</p>
                    </div>
                  </div>
                )}

                <KeyInput
                  id="fal-key"
                  label="FAL API Key"
                  showKey={showFalKey}
                  onToggleShow={() => setShowFalKey(!showFalKey)}
                  value={falConfig.apiKey}
                  onChange={(v) => setFalConfig({ ...falConfig, apiKey: v })}
                  placeholder="请输入密钥..."
                  safetyNote={safetyNote}
                />

                <KeyInput
                  id="fal-openai-key"
                  label="OpenAI API Key（可选）"
                  showKey={showFalOpenAIKey}
                  onToggleShow={() => setShowFalOpenAIKey(!showFalOpenAIKey)}
                  value={falConfig.openaiApiKey}
                  onChange={(v) => setFalConfig({ ...falConfig, openaiApiKey: v })}
                  placeholder="BYOK 模型可选填写"
                  hint="仅当使用 FAL 的 BYOK 模型时需要。留空会回退到 OpenAI 供应商中的 API Key。"
                  safetyNote={safetyNote}
                />

              </div>
              <div className="shrink-0 p-4 pt-0">
                <Button onClick={handleSaveFal}>
                  <Save className="mr-2 h-4 w-4" />
                  保存配置
                </Button>
              </div>
              </div>
            )}

            {activeProvider === "openai" && (
              <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <h3 className="text-base font-medium">OpenAI</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    支持 Image API 与 Responses API 两种模式，可分别配置端点并保存独立配置。
                  </p>
                </div>

                <KeyInput
                  id="openai-key"
                  label="OpenAI API Key"
                  showKey={showOpenAIKey}
                  onToggleShow={() => setShowOpenAIKey(!showOpenAIKey)}
                  value={openaiConfig.apiKey}
                  onChange={(v) => setOpenaiConfig({ ...openaiConfig, apiKey: v })}
                  placeholder="请输入密钥..."
                  safetyNote={safetyNote}
                />

                <div className="space-y-2">
                  <Label className="text-sm">接口模式</Label>
                  <ToggleGroup
                    type="single"
                    value={openaiConfig.mode}
                    onValueChange={(value) => {
                      if (value) {
                        setOpenaiConfig((c) => ({ ...c, mode: value as OpenAIMode }))
                      }
                    }}
                    className="w-full"
                  >
                    <ToggleGroupItem value="image" className="w-1/2">
                      Image API
                    </ToggleGroupItem>
                    <ToggleGroupItem value="responses" className="w-1/2">
                      Responses API
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <p className="text-xs text-muted-foreground">
                    {openaiConfig.mode === "responses"
                      ? "Responses 模式适配 /v1/responses 路径与会话式模型调用"
                      : "Image API 模式适配 /v1/images/generations 路径"}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="openai-image-endpoint" className="text-sm">Image API 端点</Label>
                  <Input
                    id="openai-image-endpoint"
                    placeholder={OPENAI_IMAGE_ENDPOINT_DEFAULT}
                    value={openaiConfig.imageEndpoint}
                    onChange={(e) => setOpenaiConfig((c) => ({ ...c, imageEndpoint: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="openai-responses-endpoint" className="text-sm">Responses API 端点</Label>
                  <Input
                    id="openai-responses-endpoint"
                    placeholder={OPENAI_RESPONSES_ENDPOINT_DEFAULT}
                    value={openaiConfig.responsesEndpoint}
                    onChange={(e) =>
                      setOpenaiConfig((c) => ({ ...c, responsesEndpoint: e.target.value }))
                    }
                  />
                </div>

              </div>
              <div className="shrink-0 p-4 pt-0 grid grid-cols-2 gap-2">
                <Button onClick={handleSaveOpenAI}>
                  <Save className="mr-2 h-4 w-4" />
                  保存配置
                </Button>
                <Button variant="outline" onClick={testOpenAIConnection}>
                  测试连接
                </Button>
              </div>
              </div>
            )}

            {activeProvider === "newapi" && (
              <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <h3 className="text-base font-medium">NewAPI</h3>
                </div>

                <KeyInput
                  id="newapi-key"
                  label="NewAPI API Key"
                  showKey={showNewApiKey}
                  onToggleShow={() => setShowNewApiKey(!showNewApiKey)}
                  value={newapiConfig.apiKey}
                  onChange={(v) => setNewapiConfig({ ...newapiConfig, apiKey: v })}
                  placeholder="请输入密钥..."
                  safetyNote={safetyNote}
                />

                <div className="space-y-1.5">
                  <Label htmlFor="newapi-endpoint" className="text-sm">API 地址</Label>
                  <Input
                    id="newapi-endpoint"
                    placeholder="https://your-newapi-host"
                    value={newapiConfig.endpoint}
                    onChange={(e) => setNewapiConfig({ ...newapiConfig, endpoint: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    填基础地址即可，应用会自动拼接 OpenAI 兼容的图片生成与编辑路径。
                  </p>
                </div>

              </div>
              <div className="shrink-0 p-4 pt-0 grid grid-cols-2 gap-2">
                <Button onClick={handleSaveNewAPI}>
                  <Save className="mr-2 h-4 w-4" />
                  保存配置
                </Button>
                <Button variant="outline" onClick={testNewApiConnection}>
                  测试连接
                </Button>
              </div>
              </div>
            )}

            {activeProvider === "openrouter" && (
              <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <h3 className="text-base font-medium">OpenRouter</h3>
                </div>

                <KeyInput
                  id="openrouter-key"
                  label="OpenRouter API Key"
                  showKey={showOpenRouterKey}
                  onToggleShow={() => setShowOpenRouterKey(!showOpenRouterKey)}
                  value={openrouterConfig.apiKey}
                  onChange={(v) => setOpenrouterConfig({ ...openrouterConfig, apiKey: v })}
                  placeholder="请输入密钥（sk-or-v1-...）"
                  hint={<>前往 <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OPENROUTER.AI</a> 获取密钥</>}
                  safetyNote={safetyNote}
                />

                <div className="space-y-1.5">
                  <Label htmlFor="openrouter-endpoint" className="text-sm">API 地址</Label>
                  <Input
                    id="openrouter-endpoint"
                    value={openrouterConfig.endpoint || "https://openrouter.ai/api/v1"}
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                </div>

              </div>
              <div className="shrink-0 p-4 pt-0 grid grid-cols-2 gap-2">
                <Button onClick={handleSaveOpenRouter}>
                  <Save className="mr-2 h-4 w-4" />
                  保存配置
                </Button>
                <Button variant="outline" onClick={testOpenRouterConnection}>
                  测试连接
                </Button>
              </div>
              </div>
            )}

            {activeProvider === "gemini" && (
              <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <h3 className="text-base font-medium">Gemini</h3>
                </div>

                <KeyInput
                  id="gemini-key"
                  label="Gemini API Key"
                  showKey={showGeminiKey}
                  onToggleShow={() => setShowGeminiKey(!showGeminiKey)}
                  value={geminiConfig.apiKey}
                  onChange={(v) => setGeminiConfig({ ...geminiConfig, apiKey: v })}
                  placeholder="请输入 Gemini API 密钥"
                  hint={<>前往 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google AI Studio</a> 获取密钥</>}
                  safetyNote={safetyNote}
                />

                <div className="space-y-1.5">
                  <Label htmlFor="gemini-endpoint" className="text-sm">API 地址</Label>
                  <Input
                    id="gemini-endpoint"
                    value="https://generativelanguage.googleapis.com"
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                </div>

              </div>
              <div className="shrink-0 px-4 pb-4">
                <Button className="w-full" onClick={handleSaveGemini}>
                  <Save className="mr-2 h-4 w-4" />
                  保存配置
                </Button>
              </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
