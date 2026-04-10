"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Save, Eye, EyeOff } from "lucide-react"
import { useProviderSettings } from "@/hooks/use-provider-settings"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTheme } from "next-themes"
import { useToast } from "@/hooks/use-toast"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeTab?: string
  onTabChange?: (tab: string) => void
}

export function SettingsDialog({ open, onOpenChange, activeTab, onTabChange }: SettingsDialogProps) {
  const { settings, updateProvider } = useProviderSettings()
  const [showFalKey, setShowFalKey] = useState(false)
  const [showFalOpenAIKey, setShowFalOpenAIKey] = useState(false)
  const [showOpenAIKey, setShowOpenAIKey] = useState(false)
  const [showNewApiKey, setShowNewApiKey] = useState(false)
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const { theme: activeTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
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
  const safetyNote = "密钥仅保存在本地加密存储，不会上传到服务器。"

  useEffect(() => {
    // Mount check for client-side only rendering
    const timer = setTimeout(() => {
      if (typeof window !== "undefined") {
        setMounted(true)
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!settings || !mounted) return

    let cancelled = false
    const applyConfigs = () => {
      if (cancelled) return

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
    }

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      const frame = window.requestAnimationFrame(applyConfigs)
      return () => {
        cancelled = true
        window.cancelAnimationFrame(frame)
      }
    }

    const timeout = setTimeout(applyConfigs, 0)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [settings, mounted])

  const handleSaveFal = async () => {
    await updateProvider("fal", falConfig)
    toast({
      title: "配置已保存",
      description: "FAL 配置已成功保存",
    })
  }

  const handleSaveOpenAI = async () => {
    await updateProvider("openai", openaiConfig)
    toast({
      title: "配置已保存",
      description: "OpenAI 配置已成功保存",
    })
  }

  const handleSaveNewAPI = async () => {
    await updateProvider("newapi", newapiConfig)
    toast({
      title: "配置已保存",
      description: "NewAPI 配置已成功保存",
    })
  }

  const handleSaveGemini = async () => {
    await updateProvider("gemini", {
      ...geminiConfig,
      endpoint: "https://generativelanguage.googleapis.com",
    })
    toast({
      title: "配置已保存",
      description: "Gemini 配置已成功保存",
    })
  }

  const handleSaveOpenRouter = async () => {
    if (!openrouterConfig.apiKey) {
      toast({
        title: "配置不完整",
        description: "请填写 API Key",
        variant: "destructive",
      })
      return
    }
    
    // Ensure endpoint is always set to the default value
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
    
    toast({
      title: "配置已保存",
      description: "OpenRouter 配置已成功保存",
    })
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

  const currentTheme = mounted ? activeTheme ?? "system" : "system"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card text-foreground border-border">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>配置各 AI 服务的连接与密钥</DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          <Tabs
            value={activeTab ?? internalTab}
            onValueChange={(val) => {
              setInternalTab(val)
              onTabChange?.(val)
            }}
            className="space-y-2"
          >
            <TabsList className="flex w-full bg-muted">
              <TabsTrigger value="fal">FAL</TabsTrigger>
              <TabsTrigger value="openai">OpenAI</TabsTrigger>
              <TabsTrigger value="newapi">NewAPI</TabsTrigger>
              <TabsTrigger value="openrouter">OpenRouter</TabsTrigger>
              <TabsTrigger value="gemini">Gemini</TabsTrigger>
            </TabsList>

            <TabsContent value="fal" className="space-y-4">
              <div className="border border-primary/20 bg-primary/5 px-3 py-2 rounded-md">
                <p className="text-xs text-primary">
                  &gt;&gt; 系统提示：保存后配置才会生效
                </p>
              </div>
              
              <div className="flex items-center justify-between border border-border bg-muted/30 p-4 rounded-md">
                <div className="space-y-0.5">
                  <Label className="text-base text-foreground">启用 FAL 队列</Label>
                  <p className="text-xs text-muted-foreground">使用 FAL 进行图像生成</p>
                </div>
                <Switch
                  checked={falConfig.enabled}
                  onCheckedChange={(checked) => setFalConfig({ ...falConfig, enabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fal-key" className="text-foreground text-sm">FAL API Key</Label>
                <div className="relative">
                  <Input
                    id="fal-key"
                    type={showFalKey ? "text" : "password"}
                    placeholder="请输入密钥..."
                    value={falConfig.apiKey}
                    onChange={(e) => setFalConfig({ ...falConfig, apiKey: e.target.value })}
                    className="bg-background border-border text-foreground"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full text-muted-foreground hover:text-foreground"
                    onClick={() => setShowFalKey(!showFalKey)}
                  >
                    {showFalKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{safetyNote}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fal-openai-key" className="text-foreground">OpenAI API Key（可选）</Label>
                <div className="relative">
                  <Input
                    id="fal-openai-key"
                    type={showFalOpenAIKey ? "text" : "password"}
                    placeholder="当使用 BYOK 模型时请输入 OpenAI Key"
                    value={falConfig.openaiApiKey}
                    onChange={(e) => setFalConfig({ ...falConfig, openaiApiKey: e.target.value })}
                    className="bg-background border-border text-foreground"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full text-muted-foreground hover:text-foreground"
                    onClick={() => setShowFalOpenAIKey((prev) => !prev)}
                  >
                    {showFalOpenAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  仅当选择 FAL 的 BYOK 模型（如 gpt-image-1/byok）时需要填写。留空将尝试使用 OpenAI 供应商中的 Key。
                </p>
                <p className="text-[10px] text-muted-foreground">{safetyNote}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">请求发送方式</Label>
                <Select
                  value={falConfig.requestOrigin}
                  onValueChange={(value: "client" | "server") =>
                    setFalConfig((prev) => ({ ...prev, requestOrigin: value }))
                  }
                >
                  <SelectTrigger className="bg-background border-border text-foreground">
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

              <p className="rounded-md border border-dashed border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                模型调用地址会自动匹配所选模型，无需手动填写端点。
              </p>

              <div className="grid grid-cols-2 gap-2">
                <Button className="w-full" onClick={handleSaveFal}>
                  <Save className="mr-2 h-4 w-4" />
                  保存配置
                </Button>
                <Button variant="outline" onClick={testFalConnection}>
                  测试连接
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="openai" className="space-y-4">
              <div className="border border-primary/20 bg-primary/5 px-3 py-2 rounded-md">
                <p className="text-xs text-primary">
                  &gt;&gt; 系统提示：保存后配置才会生效
                </p>
              </div>
              
              <div className="flex items-center justify-between border border-border bg-muted/30 p-4 rounded-md">
                <div className="space-y-0.5">
                  <Label className="text-base text-foreground">启用 OpenAI 图片生成</Label>
                  <p className="text-xs text-muted-foreground">使用 OpenAI 进行图像生成</p>
                </div>
                <Switch
                  checked={openaiConfig.enabled}
                  onCheckedChange={(checked) => setOpenaiConfig({ ...openaiConfig, enabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="openai-key" className="text-foreground text-sm">OpenAI API Key</Label>
                <div className="relative">
                  <Input
                    id="openai-key"
                    type={showOpenAIKey ? "text" : "password"}
                    placeholder="请输入密钥..."
                    value={openaiConfig.apiKey}
                    onChange={(e) => setOpenaiConfig({ ...openaiConfig, apiKey: e.target.value })}
                    className="bg-background border-border text-foreground"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full text-muted-foreground hover:text-foreground"
                    onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                  >
                    {showOpenAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{safetyNote}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openai-endpoint" className="text-foreground text-sm">API 地址</Label>
                <Input
                  id="openai-endpoint"
                  placeholder="https://api.openai.com/v1/images/generations"
                  value={openaiConfig.endpoint}
                  onChange={(e) => setOpenaiConfig({ ...openaiConfig, endpoint: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button className="w-full" onClick={handleSaveOpenAI}>
                  <Save className="mr-2 h-4 w-4" />
                  保存配置
                </Button>
                <Button variant="outline" onClick={testOpenAIConnection}>
                  测试连接
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="newapi" className="space-y-4">
              <div className="border border-primary/20 bg-primary/5 px-3 py-2 rounded-md">
                <p className="text-xs text-primary">
                  &gt;&gt; 系统提示：保存后配置才会生效
                </p>
              </div>
              
              <div className="flex items-center justify-between border border-border bg-muted/30 p-4 rounded-md">
                <div className="space-y-0.5">
                  <Label className="text-base text-foreground">启用 NewAPI</Label>
                  <p className="text-xs text-muted-foreground">使用 NewAPI 接口生成</p>
                </div>
                <Switch
                  checked={newapiConfig.enabled}
                  onCheckedChange={(checked) => setNewapiConfig({ ...newapiConfig, enabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newapi-key" className="text-foreground text-sm">NewAPI API Key</Label>
                <div className="relative">
                  <Input
                    id="newapi-key"
                    type={showNewApiKey ? "text" : "password"}
                    placeholder="请输入密钥..."
                    value={newapiConfig.apiKey}
                    onChange={(e) => setNewapiConfig({ ...newapiConfig, apiKey: e.target.value })}
                    className="bg-background border-border text-foreground"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full text-muted-foreground hover:text-foreground"
                    onClick={() => setShowNewApiKey(!showNewApiKey)}
                  >
                    {showNewApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{safetyNote}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newapi-endpoint" className="text-foreground text-sm">API 地址</Label>
                <Input
                  id="newapi-endpoint"
                  placeholder="https://your-newapi-host"
                  value={newapiConfig.endpoint}
                  onChange={(e) => setNewapiConfig({ ...newapiConfig, endpoint: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  &gt;&gt; 地址会自动补全
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button className="w-full" onClick={handleSaveNewAPI}>
                  <Save className="mr-2 h-4 w-4" />
                  保存配置
                </Button>
                <Button variant="outline" onClick={testNewApiConnection}>
                  测试连接
                </Button>
              </div>

              <p className="border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground rounded-md">
                &gt;&gt; 模型列表首次加载后会自动缓存。
              </p>
            </TabsContent>

            <TabsContent value="openrouter" className="space-y-4">
              <div className="border border-primary/20 bg-primary/5 px-3 py-2 rounded-md">
                <p className="text-xs text-primary">
                  &gt;&gt; 系统提示：保存后配置才会生效
                </p>
              </div>
              
              <div className="flex items-center justify-between border border-border bg-muted/30 p-4 rounded-md">
                <div className="space-y-0.5">
                  <Label className="text-base text-foreground">启用 OpenRouter</Label>
                  <p className="text-xs text-muted-foreground">使用 OpenRouter 接口生成</p>
                </div>
                <Switch
                  checked={openrouterConfig.enabled}
                  onCheckedChange={(checked) => setOpenrouterConfig({ ...openrouterConfig, enabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="openrouter-key" className="text-foreground text-sm">OpenRouter API Key</Label>
                <div className="relative">
                  <Input
                    id="openrouter-key"
                    type={showOpenRouterKey ? "text" : "password"}
                    placeholder="请输入密钥（sk-or-v1-...）"
                    value={openrouterConfig.apiKey}
                    onChange={(e) => setOpenrouterConfig({ ...openrouterConfig, apiKey: e.target.value })}
                    className="bg-background border-border text-foreground"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowOpenRouterKey(!showOpenRouterKey)}
                  >
                    {showOpenRouterKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{safetyNote}</p>
                <p className="text-xs text-muted-foreground">
                  &gt;&gt; 前往 <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OPENROUTER.AI</a> 获取密钥
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openrouter-endpoint" className="text-foreground text-sm">API 地址</Label>
                <Input
                  id="openrouter-endpoint"
                  value={openrouterConfig.endpoint || "https://openrouter.ai/api/v1"}
                  disabled
                  className="bg-muted border-border text-muted-foreground cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  &gt;&gt; 固定接口地址
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button className="w-full" onClick={handleSaveOpenRouter}>
                  <Save className="mr-2 h-4 w-4" />
                  保存配置
                </Button>
                <Button variant="outline" onClick={testOpenRouterConnection}>
                  测试连接
                </Button>
              </div>

              <p className="border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground rounded-md">
                &gt;&gt; 模型列表会自动缓存，并自动筛选出可生成图像的模型。
              </p>
            </TabsContent>

            <TabsContent value="gemini" className="space-y-4">
              <div className="border border-primary/20 bg-primary/5 px-3 py-2 rounded-md">
                <p className="text-xs text-primary">
                  &gt;&gt; 系统提示：保存后配置才会生效
                </p>
              </div>
              
              <div className="flex items-center justify-between border border-border bg-muted/30 p-4 rounded-md">
                <div className="space-y-0.5">
                  <Label className="text-base text-foreground">启用 Gemini</Label>
                  <p className="text-xs text-muted-foreground">使用 Google Gemini 图片生成接口</p>
                </div>
                <Switch
                  checked={geminiConfig.enabled}
                  onCheckedChange={(checked) => setGeminiConfig({ ...geminiConfig, enabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gemini-key" className="text-foreground text-sm">Gemini API Key</Label>
                <div className="relative">
                  <Input
                    id="gemini-key"
                    type={showGeminiKey ? "text" : "password"}
                    placeholder="请输入 Gemini API 密钥"
                    value={geminiConfig.apiKey}
                    onChange={(e) => setGeminiConfig({ ...geminiConfig, apiKey: e.target.value })}
                    className="bg-background border-border text-foreground"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                  >
                    {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{safetyNote}</p>
                <p className="text-xs text-muted-foreground">
                  &gt;&gt; 前往 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google AI Studio</a> 获取密钥
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gemini-endpoint" className="text-foreground text-sm">API 地址</Label>
                <Input
                  id="gemini-endpoint"
                  value="https://generativelanguage.googleapis.com"
                  disabled
                  className="bg-muted border-border text-muted-foreground cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  &gt;&gt; 固定接口地址，无需修改
                </p>
              </div>

              <Button className="w-full" onClick={handleSaveGemini}>
                <Save className="mr-2 h-4 w-4" />
                保存配置
              </Button>

              <p className="border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground rounded-md">
                &gt;&gt; 支持 Gemini 2.5 Flash Image 和 Gemini 3 Pro Image 模型，可生成最高 4K 分辨率图片。
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
