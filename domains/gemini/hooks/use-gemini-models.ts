"use client"

import { useState, useEffect } from "react"

export interface GeminiModel {
  id: string
  name: string
  description: string
  supportsThinking: boolean
  maxResolution: "1K" | "2K" | "4K"
}

// Gemini 图片生成模型列表（根据官方文档）
const GEMINI_MODELS: GeminiModel[] = [
  {
    id: "gemini-2.5-flash-image",
    name: "Gemini 2.5 Flash Image",
    description: "快速高效，1K 分辨率，适合大批量低延迟任务",
    supportsThinking: false,
    maxResolution: "1K",
  },
  {
    id: "gemini-3-pro-image-preview",
    name: "Gemini 3 Pro Image (Preview)",
    description: "高级模型，支持 4K 分辨率和深度思考",
    supportsThinking: true,
    maxResolution: "4K",
  },
]

export function useGeminiModels() {
  const [models] = useState<GeminiModel[]>(GEMINI_MODELS)
  const [isLoading] = useState(false)

  return {
    models,
    isLoading,
  }
}

