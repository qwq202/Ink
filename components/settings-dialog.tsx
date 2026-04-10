"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Save, Eye, EyeOff, Check } from "lucide-react"
import { useProviderSettings } from "@/hooks/use-provider-settings"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeTab?: string
  onTabChange?: (tab: string) => void
}

const PROVIDERS = [
  { id: "fal", label: "FAL", desc: "FAL 队列服务" },
  { id: "openai", label: "OpenAI", desc: "OpenAI 图片生成" },
  { id: "newapi", label: "NewAPI", desc: "NewAPI 接口" },
  { id: "openrouter", label: "OpenRouter", desc: "OpenRouter 接口" },
  { id: "gemini", label: "Gemini", desc: "Google Gemini" },
] as const

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
      {safetyNote && <p className="text-[10px] text-muted-foreground">{safetyNote}</p>}
    </div>
  )
}

export function SettingsDialog({ open, onOpenChange, activeTab, onTabChange }: SettingsDialogProps) {
  const { settings, updateProvider } = useProviderSettings()
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
    requestOrigin: "client" | "server"
  }>({
    apiKey: "",
    openaiApiKey: "",
    enabled: false,
    requestOrigin: "client",
  })

  const [openaiConfig, setOpenaiConfig] = useState({
    apiKey: "",
    endpoint: "",
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

  useEffect(() => {
    if (!settings) return

    setFalConfig({
      apiKey: settings.fal.apiKey,
      openaiApiKey: settings.fal.openaiApiKey ?? "",
      enabled: settings.fal.enabled,
      requestOrigin: settings.fal.requestOrigin ?? "client",
    })

    setOpenaiConfig({
      apiKey: settings.openai.apiKey,
      endpoint: settings.openai.endpoint,
      enabled: settings.openai.enabled,
    })

    setNewapiConfig({
      apiKey: settings.newapi.apiKey,
      endpoint: settings.newapi.endpoint,
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
    await updateProvider("fal", falConfig)
    toast({ title: "配置已保存", description: "FAL 配置已成功保存" })
  }

  const handleSaveOpenAI = async () => {
    await updateProvider("openai", openaiConfig)
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

  const testFalConnection = async () => {
    try {
      const res = await fetch("/api/fal/models?category=text-to-image", {
        headers: falConfig.apiKey ? { authorization: `Bearer ${falConfig.apiKey}` } : undefined,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast({ title: "FAL 连接正常" })
    } catch (error) {
      toast({
        title: "FAL 连接失败",
        description: error instanceof Error ? error.message : "请求错误",
        variant: "destructive",
      })
    }
  }

  const testOpenAIConnection = async () => {
    try {
      const res = await fetch(openaiConfig.endpoint || "https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiConfig.apiKey}`,
        },
        body: JSON.stringify({ prompt: "ping", model: "gpt-image-1" }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast({ title: "OpenAI 连接正常" })
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
      <DialogContent className="max-w-3xl bg-card text-foreground border-border p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>配置各 AI 服务的连接与密钥</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-[480px]">
          {/* Left: Provider List */}
          <nav className="w-48 shrink-0 border-r bg-muted/30 p-2 space-y-0.5 overflow-y-auto">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setInternalTab(p.id)
                  onTabChange?.(p.id)
                }}
                className={cn(
                  "w-full flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                  activeProvider === p.id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <span className="flex-1">{p.label}</span>
                {isEnabled(p.id) && (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
              </button>
            ))}
          </nav>

          {/* Right: Config Form */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeProvider === "fal" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-medium">FAL</h3>
                  <p className="text-xs text-muted-foreground">FAL 队列服务</p>
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label className="text-sm">启用 FAL 队列</Label>
                    <p className="text-xs text-muted-foreground">使用 FAL 进行图像生成</p>
                  </div>
                  <Switch
                    checked={falConfig.enabled}
                    onCheckedChange={(checked) => setFalConfig({ ...falConfig, enabled: checked })}
                  />
                </div>

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
                  placeholder="当使用 BYOK 模型时请输入 OpenAI Key"
                  hint="仅当选择 FAL 的 BYOK 模型（如 gpt-image-1/byok）时需要填写。留空将尝试使用 OpenAI 供应商中的 Key。"
                  safetyNote={safetyNote}
                />

                <div className="space-y-1.5">
                  <Label className="text-sm">请求发送方式</Label>
                  <Select
                    value={falConfig.requestOrigin}
                    onValueChange={(value: "client" | "server") =>
                      setFalConfig((prev) => ({ ...prev, requestOrigin: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择请求发送方式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">客户端直连 FAL（默认）</SelectItem>
                      <SelectItem value="server">通过服务器代理请求</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    客户端直连速度更快；若需隐藏 API Key 或绕过网络限制，可改为服务器代理。
                  </p>
                </div>

                <p className="rounded-md border border-dashed bg-muted px-3 py-2 text-xs text-muted-foreground">
                  模型调用地址会自动匹配所选模型，无需手动填写端点。
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={handleSaveFal}>
                    <Save className="mr-2 h-4 w-4" />
                    保存配置
                  </Button>
                  <Button variant="outline" onClick={testFalConnection}>
                    测试连接
                  </Button>
                </div>
              </div>
            )}

            {activeProvider === "openai" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-medium">OpenAI</h3>
                  <p className="text-xs text-muted-foreground">OpenAI 图片生成</p>
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label className="text-sm">启用 OpenAI 图片生成</Label>
                    <p className="text-xs text-muted-foreground">使用 OpenAI 进行图像生成</p>
                  </div>
                  <Switch
                    checked={openaiConfig.enabled}
                    onCheckedChange={(checked) => setOpenaiConfig({ ...openaiConfig, enabled: checked })}
                  />
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

                <div className="space-y-1.5">
                  <Label htmlFor="openai-endpoint" className="text-sm">API 地址</Label>
                  <Input
                    id="openai-endpoint"
                    placeholder="https://api.openai.com/v1/images/generations"
                    value={openaiConfig.endpoint}
                    onChange={(e) => setOpenaiConfig({ ...openaiConfig, endpoint: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
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
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-medium">NewAPI</h3>
                  <p className="text-xs text-muted-foreground">NewAPI 接口</p>
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label className="text-sm">启用 NewAPI</Label>
                    <p className="text-xs text-muted-foreground">使用 NewAPI 接口生成</p>
                  </div>
                  <Switch
                    checked={newapiConfig.enabled}
                    onCheckedChange={(checked) => setNewapiConfig({ ...newapiConfig, enabled: checked })}
                  />
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
                  <p className="text-xs text-muted-foreground">地址会自动补全</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={handleSaveNewAPI}>
                    <Save className="mr-2 h-4 w-4" />
                    保存配置
                  </Button>
                  <Button variant="outline" onClick={testNewApiConnection}>
                    测试连接
                  </Button>
                </div>

                <p className="rounded-md border border-dashed bg-muted px-3 py-2 text-xs text-muted-foreground">
                  模型列表首次加载后会自动缓存。
                </p>
              </div>
            )}

            {activeProvider === "openrouter" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-medium">OpenRouter</h3>
                  <p className="text-xs text-muted-foreground">OpenRouter 接口</p>
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label className="text-sm">启用 OpenRouter</Label>
                    <p className="text-xs text-muted-foreground">使用 OpenRouter 接口生成</p>
                  </div>
                  <Switch
                    checked={openrouterConfig.enabled}
                    onCheckedChange={(checked) => setOpenrouterConfig({ ...openrouterConfig, enabled: checked })}
                  />
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
                  <p className="text-xs text-muted-foreground">固定接口地址</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={handleSaveOpenRouter}>
                    <Save className="mr-2 h-4 w-4" />
                    保存配置
                  </Button>
                  <Button variant="outline" onClick={testOpenRouterConnection}>
                    测试连接
                  </Button>
                </div>

                <p className="rounded-md border border-dashed bg-muted px-3 py-2 text-xs text-muted-foreground">
                  模型列表会自动缓存，并自动筛选出可生成图像的模型。
                </p>
              </div>
            )}

            {activeProvider === "gemini" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-medium">Gemini</h3>
                  <p className="text-xs text-muted-foreground">Google Gemini</p>
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label className="text-sm">启用 Gemini</Label>
                    <p className="text-xs text-muted-foreground">使用 Google Gemini 图片生成接口</p>
                  </div>
                  <Switch
                    checked={geminiConfig.enabled}
                    onCheckedChange={(checked) => setGeminiConfig({ ...geminiConfig, enabled: checked })}
                  />
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
                  <p className="text-xs text-muted-foreground">固定接口地址，无需修改</p>
                </div>

                <Button className="w-full" onClick={handleSaveGemini}>
                  <Save className="mr-2 h-4 w-4" />
                  保存配置
                </Button>

                <p className="rounded-md border border-dashed bg-muted px-3 py-2 text-xs text-muted-foreground">
                  支持 Gemini 2.5 Flash Image 和 Gemini 3 Pro Image 模型，可生成最高 4K 分辨率图片。
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
