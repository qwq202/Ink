"use client"

import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import type { NewApiBackground, NewApiModeration } from "@/lib/newapi-openai-compat"
import { supportsNewApiBackground, supportsNewApiModeration, supportsNewApiStyle } from "@/lib/newapi-openai-compat"
import { type NewApiModel } from "@/hooks/use-newapi-models"
import type { RefObject } from "react"

interface NewAPISettingsSectionProps {
  selectedNewapiModel: string
  newapiModels: NewApiModel[]
  hasNewapiModels: boolean
  isLoadingNewApiModels: boolean
  newapiSearch: string
  newapiListRef: RefObject<HTMLDivElement>
  newapiModelButtonLabel: string
  isNewapiModelPopoverOpen: boolean
  onNewapiModelPopoverOpenChange: (next: boolean) => void
  onNewapiSearchChange: (value: string) => void
  onSelectNewapiModel: (modelId: string) => void
  safeNewapiQuality: string
  onNewapiQualityChange: (next: string) => void
  newapiStyle: string
  onNewapiStyleChange: (next: string) => void
  newapiBackground: NewApiBackground
  onNewapiBackgroundChange: (next: NewApiBackground) => void
  newapiModeration: NewApiModeration
  onNewapiModerationChange: (next: NewApiModeration) => void
  showGeminiSection: boolean
  geminiThinkingLevel: "low" | "high"
  onGeminiThinkingLevelChange: (next: "low" | "high") => void
  geminiMediaResolution: "media_resolution_low" | "media_resolution_medium" | "media_resolution_high"
  onGeminiMediaResolutionChange: (next: "media_resolution_low" | "media_resolution_medium" | "media_resolution_high") => void
  geminiAspectRatio: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9"
  onGeminiAspectRatioChange: (
    next: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9",
  ) => void
  showOpenAICompatImageEditHint: boolean
}

const GEMINI_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const

export function NewAPISettingsSection({
  selectedNewapiModel,
  newapiModels,
  hasNewapiModels,
  isLoadingNewApiModels,
  newapiSearch,
  newapiListRef,
  newapiModelButtonLabel,
  isNewapiModelPopoverOpen,
  onNewapiModelPopoverOpenChange,
  onNewapiSearchChange,
  onSelectNewapiModel,
  safeNewapiQuality,
  onNewapiQualityChange,
  newapiStyle,
  onNewapiStyleChange,
  newapiBackground,
  onNewapiBackgroundChange,
  newapiModeration,
  onNewapiModerationChange,
  showGeminiSection,
  geminiThinkingLevel,
  onGeminiThinkingLevelChange,
  geminiMediaResolution,
  onGeminiMediaResolutionChange,
  geminiAspectRatio,
  onGeminiAspectRatioChange,
  showOpenAICompatImageEditHint,
}: NewAPISettingsSectionProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="newapi-model" className="text-sm font-medium text-foreground">
          NewAPI 模型
        </Label>
        <Popover open={isNewapiModelPopoverOpen} onOpenChange={onNewapiModelPopoverOpenChange}>
          <PopoverTrigger asChild>
            <Button
              id="newapi-model"
              variant="outline"
              role="combobox"
              aria-expanded={isNewapiModelPopoverOpen}
              className="flex h-10 w-full min-w-0 items-center justify-between gap-4 px-3 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-left truncate" title={newapiModelButtonLabel}>
                {newapiModelButtonLabel}
              </span>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0 shadow-lg" align="start">
            <Command loop className="rounded-md border border-border">
              <div className="border-b border-border px-3 py-2">
                <CommandInput
                  placeholder="搜索模型名称或渠道…"
                  className="border-none focus:ring-0"
                  value={newapiSearch}
                  onValueChange={onNewapiSearchChange}
                />
              </div>
              <CommandList ref={newapiListRef} className="max-h-80 overflow-y-auto p-2">
                {isLoadingNewApiModels && !hasNewapiModels ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <div className="mb-2">正在加载模型列表…</div>
                  </div>
                ) : (
                  <>
                    <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">未找到匹配的模型</CommandEmpty>
                    <CommandGroup>
                      {hasNewapiModels ? (
                        newapiModels.map((model) => (
                          <CommandItem
                            key={model.id}
                            value={`${model.id} ${model.channel || ""}`}
                            onSelect={() => {
                              onSelectNewapiModel(model.id)
                              onNewapiModelPopoverOpenChange(false)
                            }}
                            className={cn(
                              "mb-1 cursor-pointer rounded-md border border-transparent px-3 py-3 transition-all",
                              "hover:border-border hover:bg-muted/50",
                              "aria-selected:border-primary/30 aria-selected:bg-muted/50",
                              selectedNewapiModel === model.id && "border-primary bg-muted/50",
                            )}
                          >
                            <div className="flex flex-1 flex-col gap-0.5">
                              <span className="text-sm font-semibold text-foreground">{model.id}</span>
                              {model.channel && model.channel !== "default" ? (
                                <span className="text-xs text-muted-foreground">渠道：{model.channel}</span>
                              ) : null}
                              {model.id.toLowerCase().startsWith("gemini") ? (
                                <span className="text-[10px] text-amber-600">Gemini 模型</span>
                              ) : null}
                            </div>
                            {selectedNewapiModel === model.id ? (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
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
                                onSelectNewapiModel(modelId)
                                onNewapiModelPopoverOpenChange(false)
                              }}
                              className={cn(
                                "mb-1 cursor-pointer rounded-md border border-transparent px-3 py-3 transition-all",
                                "hover:border-border hover:bg-muted/50",
                                "aria-selected:border-primary/30 aria-selected:bg-muted/50",
                                selectedNewapiModel === modelId && "border-primary bg-muted/50",
                              )}
                            >
                              <div className="flex flex-1 flex-col gap-0.5">
                                <span className="text-sm font-semibold text-foreground">{modelId}</span>
                                <span className="text-xs text-muted-foreground">默认模型</span>
                              </div>
                              {selectedNewapiModel === modelId ? (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
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

      {showGeminiSection ? (
        <div className="sm:col-span-2 grid gap-4 grid-cols-1 md:grid-cols-3 w-full">
          <div className="space-y-2">
            <Label htmlFor="gemini-thinking" className="text-sm font-medium text-foreground">
              思考等级
            </Label>
            <Select
              value={geminiThinkingLevel}
              onValueChange={(v) => onGeminiThinkingLevelChange(v as "low" | "high")}
            >
              <SelectTrigger id="gemini-thinking" className="w-full h-10">
                <SelectValue placeholder="选择思考等级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High - 深度推理，质量更高</SelectItem>
                <SelectItem value="low">Low - 更快速，成本更低</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gemini-resolution" className="text-sm font-medium text-foreground">
              媒体分辨率
            </Label>
            <Select
              value={geminiMediaResolution}
              onValueChange={(v) => onGeminiMediaResolutionChange(v as "media_resolution_low" | "media_resolution_medium" | "media_resolution_high")}
            >
              <SelectTrigger id="gemini-resolution" className="w-full h-10">
                <SelectValue placeholder="选择分辨率" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="media_resolution_high">高 4K（细节优先，耗时较长）</SelectItem>
                <SelectItem value="media_resolution_medium">中 2K（推荐）</SelectItem>
                <SelectItem value="media_resolution_low">低 1K（速度优先）</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">提示：4K 分辨率可能需要较长时间，建议先尝试 2K</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gemini-aspect" className="text-sm font-medium text-foreground">
              宽高比
            </Label>
            <Select value={geminiAspectRatio} onValueChange={(v) => onGeminiAspectRatioChange(v as NewAPISettingsSectionProps["geminiAspectRatio"])}>
              <SelectTrigger id="gemini-aspect" className="w-full h-10">
                <SelectValue placeholder="选择宽高比" />
              </SelectTrigger>
              <SelectContent>
                {GEMINI_ASPECT_RATIOS.map((ratio) => (
                  <SelectItem key={ratio} value={ratio}>
                    {ratio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="newapi-quality" className="text-sm font-medium text-foreground">
            图片质量
          </Label>
          <Select
            value={safeNewapiQuality}
            onValueChange={onNewapiQualityChange}
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

        {supportsNewApiStyle(selectedNewapiModel) ? (
          <div className="space-y-2">
            <Label htmlFor="newapi-style" className="text-sm font-medium text-foreground">
              图片风格
            </Label>
            <Select value={newapiStyle} onValueChange={onNewapiStyleChange}>
              <SelectTrigger id="newapi-style">
                <SelectValue placeholder="选择风格" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vivid">鲜艳生动</SelectItem>
                <SelectItem value="natural">自然真实</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">鲜艳适合创意设计，自然适合写实场景</p>
          </div>
        ) : null}

        {supportsNewApiBackground(selectedNewapiModel) ? (
          <div className="space-y-2">
            <Label htmlFor="newapi-background" className="text-sm font-medium text-foreground">
              背景
            </Label>
            <Select value={newapiBackground} onValueChange={(v) => onNewapiBackgroundChange(v as NewApiBackground)}>
              <SelectTrigger id="newapi-background">
                <SelectValue placeholder="选择背景" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">自动</SelectItem>
                <SelectItem value="opaque">不透明</SelectItem>
                <SelectItem value="transparent">透明</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">GPT Image 1 兼容模式支持透明背景输出。</p>
          </div>
        ) : null}

        {supportsNewApiModeration(selectedNewapiModel) ? (
          <div className="space-y-2">
            <Label htmlFor="newapi-moderation" className="text-sm font-medium text-foreground">
              审核强度
            </Label>
            <Select value={newapiModeration} onValueChange={(v) => onNewapiModerationChange(v as NewApiModeration)}>
              <SelectTrigger id="newapi-moderation">
                <SelectValue placeholder="选择审核强度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">自动</SelectItem>
                <SelectItem value="low">低</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">按 NewAPI 最新 OpenAI 兼容参数传递 moderation。</p>
          </div>
        ) : null}

        {showOpenAICompatImageEditHint && (
          <div className="sm:col-span-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            OpenAI 兼容编辑模式建议使用单张方形 PNG 原图；DALL·E 3 不支持编辑。
          </div>
        )}
      </div>
    </>
  )
}
