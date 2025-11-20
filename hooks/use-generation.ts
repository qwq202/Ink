"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { generateImages, type GenerationParams, type GenerationResult } from "@/lib/api-client"
import type { ProviderConfig } from "@/lib/providers"
import { loadProviderSettings } from "@/lib/providers"
import { useToast } from "@/hooks/use-toast"
import {
  saveToHistory,
  loadHistory,
  clearHistory as clearHistoryStore,
  deleteFromHistory as deleteFromHistoryStore,
} from "@/lib/db"
import { useTaskQueue } from "@/hooks/use-task-queue"

export function useGeneration() {
  const [results, setResults] = useState<GenerationResult[]>([])
  const [history, setHistory] = useState<GenerationResult[]>([])
  const { toast } = useToast()
  const { addTask, pending, running } = useTaskQueue(2)

  // 让生成状态与任务队列保持一致，避免并发任务时状态提前归零
  const isGenerating = useMemo(() => pending > 0 || running > 0, [pending, running])

  useEffect(() => {
    loadHistory().then(setHistory).catch(console.error)
  }, [])

  const generate = useCallback(
    async (provider: ProviderConfig, params: GenerationParams): Promise<GenerationResult> => {
      const providerId = provider.id
      const result: GenerationResult = {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).substring(7),
        images: [],
        provider: provider.name,
        params,
        timestamp: Date.now(),
        status: "success",
      }

      const maxAttempts = 3
      const baseDelay = 800

      const runWithRetry = async () => {
        let attempt = 0
        while (true) {
          try {
            const latestSettings = await loadProviderSettings()
            const latestProvider = latestSettings[providerId as keyof typeof latestSettings] ?? provider
            result.provider = latestProvider.name

            const images = await generateImages(latestProvider, params)
            result.images = images
            result.status = "success"

            return result
          } catch (error) {
            attempt += 1
            const message = error instanceof Error ? error.message.toLowerCase() : ""
            const isTransient = /429|rate limit|timeout|timed out|network|fetch failed|503|524/.test(message)
            if (!isTransient || attempt >= maxAttempts) {
              throw error
            }

            const delay = baseDelay * Math.pow(2, attempt - 1)
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
        }
      }

      addTask(
        `生成图片: ${params.prompt.substring(0, 30)}...`,
        async () => {
          try {
            const finalResult = await runWithRetry()

            // 仅保留最近 20 条结果，避免内存占用过大
            setResults((prev) => [finalResult, ...prev].slice(0, 20))
            setHistory((prev) => [finalResult, ...prev.slice(0, 19)])

            await saveToHistory(finalResult)

            toast({
              title: "生成成功",
              description: `成功生成 ${finalResult.images.length} 张图片`,
            })

            return finalResult
          } catch (error) {
            result.status = "error"
            result.error = error instanceof Error ? error.message : "Unknown error"

            setResults((prev) => [result, ...prev])

            toast({
              title: "生成失败",
              description: result.error,
              variant: "destructive",
            })

            throw error
          }
        },
        { timeoutMs: 120_000 },
      )

      return result
    },
    [toast, addTask],
  )

  const clearResults = useCallback(() => {
    setResults([])
  }, [])

  const clearHistory = useCallback(async () => {
    setHistory([])
    await clearHistoryStore()
  }, [])

  const deleteHistoryItem = useCallback(async (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id))
    await deleteFromHistoryStore(id)
  }, [])

  return {
    isGenerating,
    results,
    history,
    generate,
    clearResults,
    clearHistory,
    deleteHistoryItem,
    queueStatus: { pending, running },
  }
}
