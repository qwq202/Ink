"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { OpenAIModelMode, OpenAIModelOption, OpenAIResponsesMode } from "@/domains/openai/lib/openai-form-utils"

interface OpenAISettingsSectionProps {
  openAIMode: OpenAIModelMode
  openAIModel: string
  openAIImageQuality: "standard" | "hd"
  openAIImageStyle: "vivid" | "natural"
  openAIResponsesMode: OpenAIResponsesMode
  openAIResponsesMaxOutputTokens: number
  openAIResponsesTemperature: number
  openAIResponsesPreviousResponseId: string | undefined
  openAIModelOptions: OpenAIModelOption[]
  openAIResponsesModeOptions: Array<{ value: OpenAIResponsesMode; label: string }>
  onOpenAIModeChange: (next: OpenAIModelMode) => void
  onOpenAIModelChange: (next: string) => void
  onOpenAIImageQualityChange: (next: "standard" | "hd") => void
  onOpenAIImageStyleChange: (next: "vivid" | "natural") => void
  onOpenAIResponsesModeChange: (next: OpenAIResponsesMode) => void
  onOpenAIResponsesMaxOutputTokensChange: (next: number) => void
  onOpenAIResponsesTemperatureChange: (next: number) => void
  onOpenAIResponsesPreviousResponseIdChange: (next: string | undefined) => void
}

export function OpenAISettingsSection({
  openAIMode,
  openAIModel,
  openAIImageQuality,
  openAIImageStyle,
  openAIResponsesMode,
  openAIResponsesMaxOutputTokens,
  openAIResponsesTemperature,
  openAIResponsesPreviousResponseId,
  openAIModelOptions,
  openAIResponsesModeOptions,
  onOpenAIModeChange,
  onOpenAIModelChange,
  onOpenAIImageQualityChange,
  onOpenAIImageStyleChange,
  onOpenAIResponsesModeChange,
  onOpenAIResponsesMaxOutputTokensChange,
  onOpenAIResponsesTemperatureChange,
  onOpenAIResponsesPreviousResponseIdChange,
}: OpenAISettingsSectionProps) {
  return (
    <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="openai-mode" className="text-sm font-medium text-foreground">
          OpenAI 交互模式
        </Label>
        <Select
          value={openAIMode}
          onValueChange={(v) => onOpenAIModeChange(v as OpenAIModelMode)}
        >
          <SelectTrigger id="openai-mode" className="h-10">
            <SelectValue placeholder="选择 OpenAI 模式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="image">Image API（图像生成 / 编辑）</SelectItem>
            <SelectItem value="responses">Responses API（多模态工作流）</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="openai-model" className="text-sm font-medium text-foreground">
          OpenAI 模型
        </Label>
        <Select
          value={openAIModel}
          onValueChange={onOpenAIModelChange}
        >
          <SelectTrigger id="openai-model" className="h-10">
            <SelectValue placeholder="选择模型" />
          </SelectTrigger>
          <SelectContent>
            {openAIModelOptions.map((model) => (
              <SelectItem key={model.value} value={model.value}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {openAIMode === "image" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="openai-image-quality" className="text-sm font-medium text-foreground">
              图像质量
            </Label>
            <Select
              value={openAIImageQuality}
              onValueChange={(v) => onOpenAIImageQualityChange(v as "standard" | "hd")}
            >
              <SelectTrigger id="openai-image-quality">
                <SelectValue placeholder="选择质量" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">标准</SelectItem>
                <SelectItem value="hd">高清</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              OpenAI Image API 的标准质量与高清参数
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="openai-image-style" className="text-sm font-medium text-foreground">
              图像风格
            </Label>
            <Select
              value={openAIImageStyle}
              onValueChange={(v) => onOpenAIImageStyleChange(v as "vivid" | "natural")}
              disabled={openAIModel !== "dall-e-3"}
            >
              <SelectTrigger id="openai-image-style">
                <SelectValue placeholder="选择风格" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vivid">鲜艳</SelectItem>
                <SelectItem value="natural">自然</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              DALL·E 3 生效；其他模型将自动忽略
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="openai-response-mode" className="text-sm font-medium text-foreground">
              Responses 输出模式
            </Label>
            <Select
              value={openAIResponsesMode}
              onValueChange={(v) => onOpenAIResponsesModeChange(v as OpenAIResponsesMode)}
            >
              <SelectTrigger id="openai-response-mode">
                <SelectValue placeholder="选择输出模式" />
              </SelectTrigger>
              <SelectContent>
                {openAIResponsesModeOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="openai-max-output-tokens" className="text-sm font-medium text-foreground">
              最大输出 token
            </Label>
            <Input
              id="openai-max-output-tokens"
              type="number"
              min={1}
              max={4000}
              value={openAIResponsesMaxOutputTokens}
              onChange={(e) => {
                const next = Number(e.target.value)
                if (Number.isNaN(next)) return
                onOpenAIResponsesMaxOutputTokensChange(next)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="openai-temperature" className="text-sm font-medium text-foreground">
              温度
            </Label>
            <Input
              id="openai-temperature"
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={openAIResponsesTemperature}
              onChange={(e) => {
                const next = Number(e.target.value)
                if (Number.isNaN(next)) return
                onOpenAIResponsesTemperatureChange(next)
              }}
            />
            <p className="text-xs text-muted-foreground">
              建议 0 ~ 2。数值越高，随机性越强。
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="openai-prev-response-id" className="text-sm font-medium text-foreground">
              Previous Response ID
            </Label>
            <Input
              id="openai-prev-response-id"
              type="text"
              value={openAIResponsesPreviousResponseId || ""}
              onChange={(e) => onOpenAIResponsesPreviousResponseIdChange(e.target.value || undefined)}
              placeholder="可选，用于继续会话"
            />
            <p className="text-xs text-muted-foreground">留空将重新发起一次会话。</p>
          </div>
        </>
      )}
    </div>
  )
}
