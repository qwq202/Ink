"use client"

import { useState, useCallback, useEffect, useMemo, useRef, useTransition } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { GenerationForm } from "@/components/generation-form"
import { SettingsDialog } from "@/components/settings-dialog"
import { useImageUpload } from "@/hooks/use-image-upload"
import { useGeneration } from "@/hooks/use-generation"
import { cn } from "@/lib/utils"
import { parseImageSize } from "@/lib/image-utils"
import {
  ArrowLeft,
  Settings,
  Upload,
  X,
  Sparkles,
  ImageIcon,
  Download,
  Maximize2,
  Clock,
  Trash2,
  Loader2,
  Image as ImageIconLucide,
  Search,
  X as XIcon,
  Copy,
  Terminal,
  Cpu,
  Share2,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { GenerationResult } from "@/lib/api-client"

interface CyberGeneratorProps {
  onBack?: () => void
}

export function CyberGenerator({ onBack }: CyberGeneratorProps) {
  const [mode, setMode] = useState<"img2img" | "txt2img">("txt2img")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ src: string; width: number; height: number; index: number; images: string[] } | null>(null)
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<GenerationResult | null>(null)
  const [formResetSignal, setFormResetSignal] = useState(0)
  const [activeTab, setActiveTab] = useState("generate")
  const [historySearch, setHistorySearch] = useState("")
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set())
  const [isModeTransitionPending, startModeTransition] = useTransition()
  const { toast } = useToast()

  const changeMode = useCallback(
    (nextMode: "img2img" | "txt2img") => {
      startModeTransition(() => {
        setMode(nextMode)
      })
    },
    [startModeTransition],
  )

  const upload = useImageUpload(4)
  const addImages = upload.addImages
  const {
    results,
    history,
    generate,
    isGenerating,
    clearResults,
    clearHistory,
    deleteHistoryItem,
  } = useGeneration()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  const latestResult = results[0]
  
  // 根据图片数量自适应网格列数
  const getGridColsClass = useCallback((imageCount: number) => {
    if (imageCount === 1) return "grid-cols-1"
    if (imageCount === 2) return "grid-cols-1 md:grid-cols-2"
    if (imageCount === 3) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
    if (imageCount === 4) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-2"
    if (imageCount <= 6) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
    if (imageCount <= 9) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
    return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  }, [])
  
  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase()
    if (!query) return history
    return history.filter((item) => {
      const provider = item.provider?.toLowerCase() ?? ""
      const prompt = item.params.prompt?.toLowerCase() ?? ""
      const model = item.params.modelId?.toLowerCase() ?? ""
      return provider.includes(query) || prompt.includes(query) || model.includes(query)
    })
  }, [history, historySearch])

  // Basic history selection logic (simplified for this view)
  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedHistoryIds(new Set(filteredHistory.map((item) => item.id)))
    else setSelectedHistoryIds(new Set())
  }

  const handleReset = () => {
    upload.clearImages()
    clearResults()
    setFormResetSignal((value) => value + 1)
  }
  
  const handleDownload = useCallback(async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `cyber-gen-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error("Download failed:", error)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-hidden flex flex-col lg:flex-row">
      {/* LEFT PANEL: CONTROLS */}
      <aside className="w-full lg:w-[450px] flex flex-col border-r border-border bg-sidebar/50 backdrop-blur-md h-screen overflow-hidden relative z-10">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-sidebar/80">
            <div className="flex items-center gap-3">
            {onBack && (
                <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-primary/20 hover:text-primary rounded-none">
                <ArrowLeft className="h-5 w-5" />
                </Button>
            )}
            <div>
                <h1 className="text-2xl font-mono font-black tracking-tighter text-primary glitch-text uppercase">
                Cyber<span className="text-foreground">Gen</span>
                </h1>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono uppercase">
                    <span className="w-2 h-2 bg-green-500 animate-pulse rounded-full"></span>
                    系统在线
                </div>
            </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} className="rounded-none hover:bg-primary/20 text-primary">
                <Settings className="h-5 w-5" />
            </Button>
        </div>

        {/* Scrollable Form Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
            {/* Mode Switcher - Cyber Style */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/30 border border-border">
                <button
                    onClick={() => changeMode("txt2img")}
                    className={cn(
                        "py-2 text-xs font-mono font-bold uppercase tracking-wider transition-all duration-300",
                        mode === "txt2img" 
                            ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(var(--primary),0.5)]" 
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    文本模式
                </button>
                <button
                    onClick={() => changeMode("img2img")}
                    className={cn(
                        "py-2 text-xs font-mono font-bold uppercase tracking-wider transition-all duration-300",
                        mode === "img2img" 
                            ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(var(--primary),0.5)]" 
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    图生图
                </button>
            </div>

            {/* Image Upload Area (Conditional) */}
            {mode === "img2img" && (
                <div className="border border-dashed border-primary/50 bg-primary/5 p-6 relative group transition-all hover:bg-primary/10">
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary"></div>
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-primary"></div>
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-primary"></div>
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary"></div>
                    
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center cursor-pointer gap-3"
                    >
                        <Upload className="h-8 w-8 text-primary animate-pulse" />
                        <div className="text-center">
                            <p className="text-xs font-mono text-primary font-bold">上传源图</p>
                            <p className="text-[10px] text-muted-foreground mt-1">最多上传 4 张</p>
                        </div>
                    </div>
                     <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                          if(e.target.files) addImages(Array.from(e.target.files))
                      }}
                    />
                    {/* Preview Thumbnails */}
                    {upload.images.length > 0 && (
                        <div className="grid grid-cols-4 gap-2 mt-4">
                            {upload.images.map((img, i) => (
                                <div key={img.id} className="relative aspect-square border border-border bg-white">
                                    <Image src={img.preview} alt="" fill className="object-cover opacity-70 hover:opacity-100 transition-opacity" />
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); upload.removeImage(img.id) }}
                                        className="absolute top-0 right-0 bg-destructive text-white p-0.5"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <GenerationForm
                mode={mode}
                images={upload.images.map((img) => img.file)}
                isGenerating={isGenerating}
                onGenerate={generate}
                onReset={handleReset}
                resetSignal={formResetSignal}
            />
        </div>
      </aside>

      {/* RIGHT PANEL: VISUALIZATION */}
      <main className="flex-1 bg-background relative overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            {/* Background Grid */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#e5e5e5_1px,transparent_1px),linear-gradient(to_bottom,#e5e5e5_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] opacity-50"></div>
            
            {/* Top Bar */}
            <div className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 z-20 shrink-0">
                <div className="flex items-center gap-4">
                    <TabsList className="bg-transparent p-0 gap-4 h-auto">
                        <TabsTrigger value="generate" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-2 font-mono text-xs tracking-widest">
                            实时视图
                        </TabsTrigger>
                        <TabsTrigger value="history" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-2 font-mono text-xs tracking-widest">
                            生成日志
                        </TabsTrigger>
                    </TabsList>
                </div>
                
                {isGenerating && (
                    <div className="flex items-center gap-2 text-primary font-mono text-xs animate-pulse">
                        <Cpu className="h-4 w-4" />
                        <span>正在处理...</span>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 z-10 relative">
                <TabsContent value="generate" className="m-0">
                {latestResult && latestResult.images.length > 0 ? (
                     <div className="flex flex-col min-h-0">
                         <div className="flex items-center justify-between mb-4">
                             <div className="font-mono text-xs text-muted-foreground">
                                 ID: {latestResult.id.slice(0,8)} // {latestResult.provider.toUpperCase()}
                             </div>
                             <Button variant="outline" size="sm" onClick={clearResults} className="h-7 text-xs border-border rounded-none font-mono hover:bg-destructive/20 hover:text-destructive hover:border-destructive transition-colors">
                                <Trash2 className="h-3 w-3 mr-2" /> 清空结果
                             </Button>
                         </div>
                         
                         <div className={cn("grid gap-6", getGridColsClass(latestResult.images.length))}>
                             {latestResult.images.map((image, idx) => (
                                 <div key={idx} className="group relative aspect-square bg-white border border-border overflow-hidden hover:border-primary transition-colors duration-500">
                                     <Image 
                                        src={image} 
                                        alt="Generated" 
                                        fill 
                                        className="object-cover transition-transform duration-700 group-hover:scale-110 group-hover:saturate-150"
                                        unoptimized
                                    />
                                     
                                     {/* Overlay UI */}
                                     <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                                        <div className="flex gap-3 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                            <Button size="icon" className="rounded-none bg-primary text-primary-foreground hover:bg-black hover:text-white"
                                                onClick={() => {
                                                    const { width, height } = parseImageSize(latestResult.params.imageSize)
                                                    setSelectedImage({ 
                                                        src: image, 
                                                        width, 
                                                        height,
                                                        index: idx,
                                                        images: latestResult.images
                                                    })
                                                }}
                                            >
                                                <Maximize2 className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" className="rounded-none border border-black text-black hover:bg-black hover:text-white"
                                                onClick={() => handleDownload(image)}
                                            >
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        </div>
                                     </div>
                                     
                                     {/* Corner Accents */}
                                     <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-black/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                     <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-black/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                     <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-black/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                     <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-black/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                 </div>
                             ))}
                         </div>
                     </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                        <div className="w-64 h-64 border border-border flex items-center justify-center relative animate-pulse">
                            <div className="absolute inset-0 border-t border-primary/20"></div>
                            <div className="absolute inset-0 border-b border-primary/20 transform scale-y-50"></div>
                            <Terminal className="h-16 w-16 text-primary/20" />
                        </div>
                        <p className="mt-8 font-mono text-xs tracking-[0.2em] uppercase">等待输入指令...</p>
                    </div>
                )}
            </TabsContent>

            <TabsContent value="history" className="h-full m-0">
                {/* Cyber Table for History */}
                <div className="border border-border bg-white/40 backdrop-blur-sm">
                    <Table>
                        <TableHeader className="bg-muted/20">
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="font-mono text-xs text-primary">ID</TableHead>
                                <TableHead className="font-mono text-xs text-primary">预览</TableHead>
                                <TableHead className="font-mono text-xs text-primary">提示词</TableHead>
                                <TableHead className="font-mono text-xs text-primary text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredHistory.map((item) => (
                                <TableRow 
                                    key={item.id} 
                                    className="border-border hover:bg-primary/5 group cursor-pointer"
                                    onClick={() => setSelectedHistoryItem(item)}
                                >
                                    <TableCell className="font-mono text-[10px] text-muted-foreground">{item.id.slice(0,6)}</TableCell>
                                    <TableCell>
                                        {item.images[0] ? (
                                            <div className="w-12 h-12 relative bg-muted group/image cursor-pointer overflow-hidden">
                                                <Image 
                                                    src={item.images[0]} 
                                                    alt="" 
                                                    fill 
                                                    className="object-cover transition-transform group-hover/image:scale-110" 
                                                    unoptimized 
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setSelectedHistoryItem(item)
                                                    }}
                                                />
                                                {item.images.length > 1 && (
                                                    <div className="absolute top-0 right-0 bg-black/60 text-white text-[10px] px-1 font-mono">
                                                        +{item.images.length - 1}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 relative bg-muted"></div>
                                        )}
                                    </TableCell>
                                    <TableCell className="max-w-[200px]">
                                        <p className="truncate font-mono text-xs text-foreground">{item.params.prompt}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase mt-1">{item.provider} :: {item.params.modelId}</p>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                deleteHistoryItem(item.id)
                                            }} 
                                            className="hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {filteredHistory.length === 0 && (
                        <div className="p-12 text-center font-mono text-xs text-muted-foreground">
                            暂无生成记录
                        </div>
                    )}
                </div>
            </TabsContent>
        </div>
        </Tabs>
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-screen-xl border-primary/50 bg-black/90 p-0 backdrop-blur-xl overflow-hidden outline-none" onKeyDown={(e) => {
            if (!selectedImage || !selectedImage.images || selectedImage.images.length <= 1) return
            if (e.key === "ArrowLeft") {
                const newIndex = (selectedImage.index - 1 + selectedImage.images.length) % selectedImage.images.length
                setSelectedImage({ ...selectedImage, src: selectedImage.images[newIndex], index: newIndex })
            } else if (e.key === "ArrowRight") {
                const newIndex = (selectedImage.index + 1) % selectedImage.images.length
                setSelectedImage({ ...selectedImage, src: selectedImage.images[newIndex], index: newIndex })
            }
        }}>
             <DialogTitle className="sr-only">预览</DialogTitle>
             <DialogDescription className="sr-only">图片预览</DialogDescription>
             {selectedImage && (
                 <div className="relative w-full h-[85vh] flex items-center justify-center bg-[url('/grid.svg')] bg-repeat opacity-100">
                     <div className="absolute inset-0 bg-black/40 pointer-events-none"></div>
                     <Image 
                        src={selectedImage.src} 
                        alt="Full Preview" 
                        width={selectedImage.width} 
                        height={selectedImage.height}
                        className="max-h-full max-w-full object-contain shadow-[0_0_50px_rgba(var(--primary),0.3)] relative z-10"
                        unoptimized
                    />
                    
                    {/* Top Bar */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-20">
                        <div className="flex items-center gap-2 text-primary font-mono text-xs">
                            <span className="w-2 h-2 bg-primary animate-pulse"></span>
                            {selectedImage.width} x {selectedImage.height}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-primary hover:text-primary-foreground hover:bg-primary rounded-none border border-primary/30 h-8 w-8"
                                onClick={() => handleDownload(selectedImage.src)}
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-primary hover:text-primary-foreground hover:bg-primary rounded-none border border-primary/30 h-8 w-8"
                                onClick={() => setSelectedImage(null)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {selectedImage.images && selectedImage.images.length > 1 && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-none border border-primary/30 bg-black/40 hover:bg-primary/20 text-primary backdrop-blur-sm z-20 transition-all hover:scale-110"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    const newIndex = (selectedImage.index - 1 + selectedImage.images.length) % selectedImage.images.length
                                    setSelectedImage({ ...selectedImage, src: selectedImage.images[newIndex], index: newIndex })
                                }}
                            >
                                <ChevronLeft className="h-8 w-8" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-none border border-primary/30 bg-black/40 hover:bg-primary/20 text-primary backdrop-blur-sm z-20 transition-all hover:scale-110"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    const newIndex = (selectedImage.index + 1) % selectedImage.images.length
                                    setSelectedImage({ ...selectedImage, src: selectedImage.images[newIndex], index: newIndex })
                                }}
                            >
                                <ChevronRight className="h-8 w-8" />
                            </Button>
                            
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                                <div className="px-4 py-1 border border-primary/30 bg-black/60 backdrop-blur-md text-primary text-xs font-mono tracking-widest uppercase">
                                    IMG_0{selectedImage.index + 1} / 0{selectedImage.images.length}
                                </div>
                            </div>
                        </>
                    )}
                    
                    {/* Decorative Corners */}
                    <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-primary pointer-events-none z-10"></div>
                    <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-primary pointer-events-none z-10"></div>
                    <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-primary pointer-events-none z-10"></div>
                    <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-primary pointer-events-none z-10"></div>
                 </div>
             )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedHistoryItem} onOpenChange={() => setSelectedHistoryItem(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">生成记录详情</DialogTitle>
          <DialogDescription className="sr-only">查看选中历史记录的完整信息和所有图片</DialogDescription>
          {selectedHistoryItem && (() => {
            const { width, height } = parseImageSize(selectedHistoryItem.params.imageSize)
            return (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">提示词</h3>
                  <p className="text-sm text-muted-foreground">{selectedHistoryItem.params.prompt}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">生成信息</h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>提供商: {selectedHistoryItem.provider}</p>
                    <p>模型: {selectedHistoryItem.params.modelId || "—"}</p>
                    <p>图片数量: {selectedHistoryItem.images.length} 张</p>
                    <p>生成时间: {new Date(selectedHistoryItem.timestamp).toLocaleString("zh-CN")}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">所有图片 ({selectedHistoryItem.images.length})</h3>
                  <div className={cn("grid gap-4", getGridColsClass(selectedHistoryItem.images.length))}>
                    {selectedHistoryItem.images.map((image, index) => (
                      <div key={index} className="relative group/image-detail">
                        <Image
                          src={image || "/placeholder.svg"}
                          alt={`生成的图片 ${index + 1}`}
                          className="h-auto w-full rounded-lg cursor-pointer transition-transform group-hover/image-detail:scale-105"
                          width={width}
                          height={height}
                          unoptimized
                          onClick={() => {
                            setSelectedImage({ 
                                src: image, 
                                width, 
                                height,
                                index: index,
                                images: selectedHistoryItem.images
                            })
                          }}
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover/image-detail:opacity-100 transition-opacity flex gap-2">
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedImage({ 
                                  src: image, 
                                  width, 
                                  height,
                                  index: index,
                                  images: selectedHistoryItem.images
                              })
                            }}
                          >
                            <Maximize2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownload(image)
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs font-semibold text-white">
                          #{index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
