"use client"

import { useState, useEffect, useCallback } from "react"
import { loadJSON, saveJSON } from "@/lib/persist"
import type { GenerationParams } from "@/lib/api-client"

export interface GenerationHistoryItem {
  id: string
  timestamp: number
  prompt: string
  providerId: string
  modelId?: string
  params: Partial<GenerationParams>
  label?: string // 用户自定义的标签名称
}

const STORAGE_KEY = "ai-image-generation-history"
const MAX_HISTORY_ITEMS = 50

export function useGenerationHistory() {
  const [history, setHistory] = useState<GenerationHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 加载历史记录
  useEffect(() => {
    if (typeof window === "undefined") return
    
    const loaded = loadJSON<GenerationHistoryItem[]>(STORAGE_KEY, [])
    // 按时间戳倒序排列
    const sorted = loaded.sort((a, b) => b.timestamp - a.timestamp)
    setHistory(sorted)
    setIsLoading(false)
  }, [])

  // 保存历史记录
  const saveHistory = useCallback((items: GenerationHistoryItem[]) => {
    // 限制历史记录数量
    const limited = items.slice(0, MAX_HISTORY_ITEMS)
    setHistory(limited)
    saveJSON(STORAGE_KEY, limited)
  }, [])

  // 添加新的历史记录
  const addHistoryItem = useCallback(
    (item: Omit<GenerationHistoryItem, "id" | "timestamp">) => {
      const newItem: GenerationHistoryItem = {
        ...item,
        id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: Date.now(),
      }
      
      const updated = [newItem, ...history]
      saveHistory(updated)
    },
    [history, saveHistory]
  )

  // 删除历史记录
  const deleteHistoryItem = useCallback(
    (id: string) => {
      const updated = history.filter((item) => item.id !== id)
      saveHistory(updated)
    },
    [history, saveHistory]
  )

  // 更新历史记录标签
  const updateHistoryLabel = useCallback(
    (id: string, label: string) => {
      const updated = history.map((item) =>
        item.id === id ? { ...item, label } : item
      )
      saveHistory(updated)
    },
    [history, saveHistory]
  )

  // 清空历史记录
  const clearHistory = useCallback(() => {
    saveHistory([])
  }, [saveHistory])

  // 获取单个历史记录
  const getHistoryItem = useCallback(
    (id: string) => {
      return history.find((item) => item.id === id)
    },
    [history]
  )

  return {
    history,
    isLoading,
    addHistoryItem,
    deleteHistoryItem,
    updateHistoryLabel,
    clearHistory,
    getHistoryItem,
  }
}

