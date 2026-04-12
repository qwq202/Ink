"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sparkles, ImageIcon, Clock, ArrowRight } from "lucide-react"
import { useOnboarding, type ExamplePrompt } from "@/domains/settings/hooks/use-onboarding"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  type: "results" | "history"
  onAction?: () => void
  onSelectExample?: (prompt: ExamplePrompt) => void
  className?: string
}

export function EmptyState({ type, onAction, onSelectExample, className }: EmptyStateProps) {
  const { examplePrompts } = useOnboarding()

  if (type === "results") {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 px-4", className)}>
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6">
          <Sparkles className="h-16 w-16 text-primary/60" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无生成结果</h3>
        <p className="text-sm text-gray-600 mb-6 text-center max-w-md">
          前往创作页面开始生成图片，或尝试以下示例提示词快速开始
        </p>
        {onAction && (
          <Button onClick={onAction} className="mb-6" size="lg">
            <Sparkles className="mr-2 h-4 w-4" />
            开始创作
          </Button>
        )}
        {onSelectExample && examplePrompts.length > 0 && (
          <div className="w-full max-w-2xl">
            <p className="text-xs font-medium text-gray-500 mb-3 text-center">示例提示词</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {examplePrompts.slice(0, 4).map((example, index) => (
                <Card
                  key={index}
                  className="cursor-pointer hover:border-primary hover:shadow-sm transition-all"
                  onClick={() => onSelectExample(example)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-primary">{example.category}</span>
                        </div>
                        <p className="text-sm text-gray-900 line-clamp-2" title={example.prompt}>
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
        )}
      </div>
    )
  }

  if (type === "history") {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 px-4", className)}>
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6">
          <Clock className="h-16 w-16 text-primary/60" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无历史记录</h3>
        <p className="text-sm text-gray-600 mb-6 text-center max-w-md">
          你的生成历史将会保存在这里，方便随时查看和重新生成
        </p>
        {onAction && (
          <Button onClick={onAction} variant="outline" size="lg">
            <Sparkles className="mr-2 h-4 w-4" />
            开始创作
          </Button>
        )}
      </div>
    )
  }

  return null
}

