"use client"

import { useState, useEffect, useCallback } from "react"
import { loadJSON, saveJSON } from "@/shared/lib/persist"
import type { GenerationParams } from "@/domains/generation/lib/api-client"
import {
  clearAllHistorySourceImages,
  deleteHistorySourceImages,
  loadHistorySourceImages,
  saveHistorySourceImages,
} from "@/shared/lib/db"

export type OpenAIApiMode = "image-api" | "responses-api"
export type GenerationOperationType = "txt2img" | "img2img"

export interface OpenAIResponseChainMetadata {
  endpoint?: string
  modelId?: string
  openaiMode?: OpenAIApiMode
  operationType?: GenerationOperationType
  requestId?: string
  temperature?: number
  maxOutputTokens?: number
  // 其他供应商/网关的链路信息可预留在此扩展
  extras?: Record<string, string | number | boolean | null>
}

export interface GenerationHistoryItem {
  id: string
  timestamp: number
  prompt: string
  providerId: string
  modelId?: string
  openaiMode?: OpenAIApiMode
  operationType?: GenerationOperationType
  responseChainMetadata?: OpenAIResponseChainMetadata
  params: Partial<GenerationParams>
  label?: string // 用户自定义的标签名称
  sourceImages?: string[] // 图生图模式下的原图（base64 格式）
}

const STORAGE_KEY = "ai-image-generation-history"
const MAX_HISTORY_ITEMS = 50

export function useGenerationHistory() {
  const [history, setHistory] = useState<GenerationHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 加载历史记录
  useEffect(() => {
    if (typeof window === "undefined") return

    let active = true

    const loadStoredHistory = async () => {
      await Promise.resolve()
      if (!active) return

      const loaded = loadJSON<GenerationHistoryItem[]>(STORAGE_KEY, [])
      const sorted = loaded.sort((a, b) => b.timestamp - a.timestamp)
      setHistory(sorted)
      setIsLoading(false)
    }

    void loadStoredHistory()

    return () => {
      active = false
    }
  }, [])

  // 保存历史记录
  const saveHistory = useCallback((items: GenerationHistoryItem[]) => {
    // 限制历史记录数量
    const limited = items.slice(0, MAX_HISTORY_ITEMS)
    setHistory(limited)
    return saveJSON(STORAGE_KEY, limited)
  }, [])

  // 添加新的历史记录
  const addHistoryItem = useCallback(
    async (item: Omit<GenerationHistoryItem, "id" | "timestamp">) => {
      const newItem: GenerationHistoryItem = {
        ...item,
        id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: Date.now(),
        sourceImages: undefined,
      }

      if (item.sourceImages?.length) {
        await saveHistorySourceImages(newItem.id, item.sourceImages)
      }

      const updated = [newItem, ...history]
      const limited = updated.slice(0, MAX_HISTORY_ITEMS)
      const removedIds = updated.slice(MAX_HISTORY_ITEMS).map((entry) => entry.id)

      const saved = saveHistory(updated)
      if (!saved) {
        throw new Error("历史记录保存失败，可能是浏览器存储空间不足。")
      }

      await Promise.all(removedIds.map((id) => deleteHistorySourceImages(id)))

      return limited[0] ?? newItem
    },
    [history, saveHistory]
  )

  // 删除历史记录
  const deleteHistoryItem = useCallback(
    async (id: string) => {
      const updated = history.filter((item) => item.id !== id)
      await deleteHistorySourceImages(id)
      const saved = saveHistory(updated)
      if (!saved) {
        throw new Error("历史记录删除后保存失败。")
      }
    },
    [history, saveHistory]
  )

  // 更新历史记录标签
  const updateHistoryLabel = useCallback(
    (id: string, label: string) => {
      const updated = history.map((item) =>
        item.id === id ? { ...item, label } : item
      )
      const saved = saveHistory(updated)
      if (!saved) {
        throw new Error("历史标签保存失败。")
      }
    },
    [history, saveHistory]
  )

  // 清空历史记录
  const clearHistory = useCallback(async () => {
    await clearAllHistorySourceImages()
    const saved = saveHistory([])
    if (!saved) {
      throw new Error("清空历史后保存失败。")
    }
  }, [saveHistory])

  // 获取单个历史记录
  const getHistoryItem = useCallback(
    (id: string) => {
      return history.find((item) => item.id === id)
    },
    [history]
  )

  const getHistorySourceImages = useCallback(async (id: string) => {
    return loadHistorySourceImages(id)
  }, [])

  return {
    history,
    isLoading,
    addHistoryItem,
    deleteHistoryItem,
    updateHistoryLabel,
    clearHistory,
    getHistoryItem,
    getHistorySourceImages,
  }
}
