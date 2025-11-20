"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Settings, Loader2, RotateCcw } from "lucide-react"
import { ImageUploadSection } from "./image-upload-section"
import { GenerationForm } from "./generation-form"
import { ResultsSection } from "./results-section"
import { HistorySection } from "./history-section"
import { SettingsDialog } from "./settings-dialog"
import { useImageUpload } from "@/hooks/use-image-upload"
import { useGeneration } from "@/hooks/use-generation"
import { BrandLogo } from "@/components/brand-logo"

export function ImageGenerator() {
  const [mode, setMode] = useState<"img2img" | "txt2img">("img2img")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)
  const upload = useImageUpload(4)
  const {
    results,
    history,
    queueStatus,
    generate,
    isGenerating,
    clearResults,
    clearHistory,
    deleteHistoryItem,
  } = useGeneration()
  const [formResetSignal, setFormResetSignal] = useState(0)

  const handleReset = () => {
    upload.clearImages()
    clearResults()
    clearHistory()
    setFormResetSignal((value) => value + 1)
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <BrandLogo compact className="h-10 w-10 shrink-0" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">AI 图片工具</h1>
              <p className="text-xs text-muted-foreground">多供应商图片生成</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {(queueStatus.running > 0 || queueStatus.pending > 0) && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <div className="flex gap-1">
                  {queueStatus.running > 0 && (
                    <Badge variant="default" className="text-xs">
                      运行中: {queueStatus.running}
                    </Badge>
                  )}
                  {queueStatus.pending > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      等待中: {queueStatus.pending}
                    </Badge>
                  )}
                </div>
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={handleReset} title="重置参数与结果">
              <RotateCcw className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto flex-1 px-4 py-8">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "img2img" | "txt2img")} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="img2img">图片编辑</TabsTrigger>
            <TabsTrigger value="txt2img">文本生图</TabsTrigger>
          </TabsList>

          <TabsContent value="img2img" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <ImageUploadSection upload={upload} />
                <GenerationForm
                  mode="img2img"
                  images={upload.images.map((img) => img.file)}
                  isGenerating={isGenerating}
                  onGenerate={generate}
                  onReset={() => {
                    upload.clearImages()
                    clearResults()
                    clearHistory()
                  }}
                  resetSignal={formResetSignal}
                />
              </div>
              <div className="space-y-6">
                <ResultsSection results={results} />
                <HistorySection
                  key={historyKey}
                  history={history}
                  onHistoryChange={() => setHistoryKey((k) => k + 1)}
                  onClearHistory={clearHistory}
                  onDeleteHistory={deleteHistoryItem}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="txt2img" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <GenerationForm
                  mode="txt2img"
                  isGenerating={isGenerating}
                  onGenerate={generate}
                  onReset={() => {
                    clearResults()
                    clearHistory()
                  }}
                  resetSignal={formResetSignal}
                />
              </div>
              <div className="space-y-6">
                <ResultsSection results={results} />
                <HistorySection
                  key={historyKey}
                  history={history}
                  onHistoryChange={() => setHistoryKey((k) => k + 1)}
                  onClearHistory={clearHistory}
                  onDeleteHistory={deleteHistoryItem}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
