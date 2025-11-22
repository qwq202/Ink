"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Sparkles } from "lucide-react"
import type { GenerationParams } from "@/lib/api-client"

interface VariantGeneratorDialogProps {
  baseParams: GenerationParams
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerate: (params: GenerationParams[]) => void
}

export function VariantGeneratorDialog({
  baseParams,
  open,
  onOpenChange,
  onGenerate,
}: VariantGeneratorDialogProps) {
  const [variantCount, setVariantCount] = useState(4)
  const [seedStrategy, setSeedStrategy] = useState<"increment" | "random">("increment")
  const [baseSeed, setBaseSeed] = useState<number | undefined>(baseParams.seed)
  const [promptVariations, setPromptVariations] = useState<string[]>([""])

  const handleGenerate = () => {
    const variants: GenerationParams[] = []

    for (let i = 0; i < variantCount; i++) {
      let seed: number | undefined
      if (seedStrategy === "increment") {
        seed = baseSeed ? baseSeed + i : i
      } else {
        seed = Math.floor(Math.random() * 1000000)
      }

      const promptVariation = promptVariations[i] || baseParams.prompt
      const finalPrompt = promptVariation || baseParams.prompt

      variants.push({
        ...baseParams,
        prompt: finalPrompt,
        seed,
      })
    }

    onGenerate(variants)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>生成变体</DialogTitle>
        <DialogDescription>基于当前参数生成多个变体图片</DialogDescription>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>变体数量</Label>
            <div className="space-y-2">
              <Slider
                value={[variantCount]}
                min={2}
                max={8}
                step={1}
                onValueChange={(value) => setVariantCount(value[0])}
              />
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>2</span>
                <span className="font-medium">{variantCount} 张</span>
                <span>8</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Seed 策略</Label>
            <div className="flex gap-2">
              <Button
                variant={seedStrategy === "increment" ? "default" : "outline"}
                size="sm"
                onClick={() => setSeedStrategy("increment")}
                className="flex-1"
              >
                递增 (+1, +2, +3...)
              </Button>
              <Button
                variant={seedStrategy === "random" ? "default" : "outline"}
                size="sm"
                onClick={() => setSeedStrategy("random")}
                className="flex-1"
              >
                随机
              </Button>
            </div>
          </div>

          {seedStrategy === "increment" && (
            <div className="space-y-2">
              <Label htmlFor="base-seed">基础 Seed（可选）</Label>
              <Input
                id="base-seed"
                type="number"
                placeholder="留空将从 0 开始"
                value={baseSeed ?? ""}
                onChange={(e) => setBaseSeed(e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>提示词变体（可选）</Label>
            <p className="text-xs text-gray-500">
              为每个变体输入不同的提示词，留空将使用原始提示词
            </p>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {Array.from({ length: variantCount }).map((_, index) => (
                <Input
                  key={index}
                  placeholder={`变体 ${index + 1} 提示词（留空使用原始）`}
                  value={promptVariations[index] || ""}
                  onChange={(e) => {
                    const newVariations = [...promptVariations]
                    newVariations[index] = e.target.value
                    setPromptVariations(newVariations)
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleGenerate} className="gap-2">
              <Sparkles className="h-4 w-4" />
              生成 {variantCount} 个变体
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

