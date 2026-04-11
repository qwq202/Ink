"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sparkles, Settings, ArrowRight } from "lucide-react"
import { useOnboarding, type ExamplePrompt } from "@/hooks/use-onboarding"
import { cn } from "@/lib/utils"

interface OnboardingWizardProps {
  onComplete: (finalized?: boolean) => void
  onOpenSettings: () => void
  onSelectExample?: (prompt: ExamplePrompt) => void
  hasEnabledProviders?: boolean
}

export function OnboardingWizard({
  onComplete,
  onOpenSettings,
  onSelectExample,
  hasEnabledProviders = false,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const { examplePrompts } = useOnboarding()

  const steps = [
    {
      title: "欢迎使用 AI 图像工具",
      description: "开始之前，让我们快速了解一下如何使用",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            这是一个强大的 AI 图像生成工具，支持多种供应商和模型。你可以：
          </p>
          <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
            <li>使用文本描述生成图片</li>
            <li>上传图片进行编辑和增强</li>
            <li>管理生成历史记录</li>
            <li>保存和分享你的作品</li>
          </ul>
        </div>
      ),
    },
    {
      title: "配置供应商",
      description: "首先需要配置至少一个 AI 供应商",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            点击右上角的设置图标，配置你的 API 密钥。<span className="font-medium text-gray-900">请至少启用并保存 1 个供应商</span>，否则无法开始生成。
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-2 bg-gray-50 rounded">FAL · 官方 SDK 接入</div>
            <div className="p-2 bg-gray-50 rounded">OpenAI · DALL·E / GPT-Image</div>
            <div className="p-2 bg-gray-50 rounded">NewAPI · 兼容 OpenAI 协议</div>
            <div className="p-2 bg-gray-50 rounded">OpenRouter · 模型选择丰富</div>
          </div>
          <Button onClick={onOpenSettings} className="w-full">
            <Settings className="mr-2 h-4 w-4" />
            打开设置
          </Button>
        </div>
      ),
    },
    {
      title: "选择示例提示词",
      description: "试试这些示例提示词，快速开始创作",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">点击任意示例卡片，自动填充到表单中：</p>
          <div className="max-w-xl mx-auto w-full">
            <div className="grid gap-2 max-h-[320px] overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin">
              {examplePrompts.map((example, index) => (
                <Card
                  key={index}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => {
                    onSelectExample?.(example)
                    setCurrentStep(3)
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-primary">{example.category}</span>
                          <span className="text-xs text-gray-500">{example.description}</span>
                        </div>
                        <p className="text-sm text-gray-900 break-words line-clamp-2">
                          {example.prompt}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400 shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "开始创作",
      description: "一切就绪，开始你的创作之旅！",
      content: (
        <div className="space-y-4">
          <div className="flex items-center justify-center p-8 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
            <Sparkles className="h-16 w-16 text-primary" />
          </div>
          <p className="text-sm text-gray-600 text-center">
            现在你可以开始生成图片了。填写提示词，选择参数，然后点击生成按钮。
          </p>
        </div>
      ),
    },
  ]

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
      return
    }

    if (!hasEnabledProviders) {
      onOpenSettings()
    }
    onComplete(true)
  }

  const handleSkip = () => {
    // 稍后再看：关闭但不标记完成
    onComplete(false)
  }

  return (
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onComplete(false)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="flex items-start justify-between gap-2">
          <div>
            <DialogTitle>{steps[currentStep].title}</DialogTitle>
            <DialogDescription>{steps[currentStep].description}</DialogDescription>
            <p className="text-xs text-gray-400 mt-1">
              步骤 {currentStep + 1} / {steps.length}
            </p>
          </div>
        </DialogHeader>

        <div className="py-4">{steps[currentStep].content}</div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {steps.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentStep(index)}
                className={cn(
                  "h-2 w-2 rounded-full transition-all cursor-pointer hover:scale-125",
                  index === currentStep ? "bg-primary" : "bg-gray-300 hover:bg-gray-400",
                )}
                aria-label={`跳转到步骤 ${index + 1}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {currentStep < steps.length - 1 && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={handleSkip}>
                  稍后再看
                </Button>
                <Button variant="outline" onClick={() => onComplete(true)}>
                  不再显示
                </Button>
              </div>
            )}
            <Button onClick={handleNext}>
              {currentStep < steps.length - 1 ? "下一步" : hasEnabledProviders ? "开始使用" : "去设置"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
