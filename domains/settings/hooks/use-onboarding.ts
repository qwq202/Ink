"use client"

import { useState, useEffect, useCallback } from "react"
import { loadProviderSettings } from "@/domains/settings/lib/providers"

const ONBOARDING_STORAGE_KEY = "ai-image-tool:onboarding:completed"

export interface ExamplePrompt {
  prompt: string
  mode: "txt2img" | "img2img"
  category: string
  description: string
}

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    prompt: "A serene mountain landscape at sunset with snow-capped peaks, golden hour lighting, photorealistic, 8k",
    mode: "txt2img",
    category: "风景",
    description: "壮丽的自然风景",
  },
  {
    prompt: "Portrait of a young woman with flowing hair, studio lighting, professional photography, high detail",
    mode: "txt2img",
    category: "人像",
    description: "专业人像摄影",
  },
  {
    prompt: "Abstract digital art, vibrant colors, geometric patterns, futuristic style, 4k",
    mode: "txt2img",
    category: "艺术",
    description: "抽象艺术创作",
  },
  {
    prompt: "A cute cat sitting on a windowsill, soft natural light, cozy atmosphere, detailed fur texture",
    mode: "txt2img",
    category: "动物",
    description: "可爱的动物场景",
  },
  {
    prompt: "Cyberpunk cityscape at night, neon lights, rain-soaked streets, Blade Runner aesthetic, cinematic",
    mode: "txt2img",
    category: "科幻",
    description: "赛博朋克风格",
  },
]

export function useOnboarding() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(true)
  const [hasEnabledProviders, setHasEnabledProviders] = useState<boolean>(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true"
        setHasCompletedOnboarding(completed)

        const settings = await loadProviderSettings()
        const enabled = Object.values(settings).some((provider) => provider.enabled && provider.apiKey)
        setHasEnabledProviders(enabled)
      } catch (error) {
        console.error("Failed to check onboarding status:", error)
      } finally {
        setIsChecking(false)
      }
    }

    checkOnboarding()
  }, [])

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true")
    setHasCompletedOnboarding(true)
  }, [])

  const shouldShowOnboarding = !hasCompletedOnboarding && !hasEnabledProviders && !isChecking

  return {
    hasCompletedOnboarding,
    hasEnabledProviders,
    shouldShowOnboarding,
    isChecking,
    completeOnboarding,
    examplePrompts: EXAMPLE_PROMPTS,
  }
}

