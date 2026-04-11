"use client"

import { useState, useEffect, useCallback } from "react"
import {
  consumeFalLegacyInvalidatedNotice,
  loadProviderSettings,
  saveProviderSettings,
  type ProviderSettings,
  type ProviderConfig,
} from "@/lib/providers"
import { useToast } from "@/hooks/use-toast"

let cachedSettings: ProviderSettings | null = null
const subscribers = new Set<(settings: ProviderSettings | null) => void>()

function notifySubscribers(settings: ProviderSettings | null) {
  cachedSettings = settings
  subscribers.forEach((subscriber) => subscriber(settings))
}

function subscribe(subscriber: (settings: ProviderSettings | null) => void) {
  subscribers.add(subscriber)
  return () => subscribers.delete(subscriber)
}

export function useProviderSettings() {
  const [settings, setSettings] = useState<ProviderSettings | null>(cachedSettings)
  const [isLoading, setIsLoading] = useState(!cachedSettings)
  const [hasFalLegacyConfigInvalidated, setHasFalLegacyConfigInvalidated] = useState(() =>
    consumeFalLegacyInvalidatedNotice(),
  )
  const { toast } = useToast()

  useEffect(() => {
    let isMounted = true

    if (!cachedSettings) {
      loadProviderSettings()
        .then((loaded) => {
          if (!isMounted) return
          setSettings(loaded)
          notifySubscribers(loaded)
          setHasFalLegacyConfigInvalidated(consumeFalLegacyInvalidatedNotice())
        })
        .finally(() => {
          if (isMounted) setIsLoading(false)
        })
    }

    const unsubscribe = subscribe((updated) => {
      setSettings(updated)
    })

    const handleStorage = async (event: StorageEvent) => {
      if (event.key === "ai-image-tool-providers") {
        const loaded = await loadProviderSettings()
        notifySubscribers(loaded)
        setHasFalLegacyConfigInvalidated(consumeFalLegacyInvalidatedNotice())
      }
    }

    window.addEventListener("storage", handleStorage)

    return () => {
      isMounted = false
      unsubscribe()
      window.removeEventListener("storage", handleStorage)
    }
  }, [])

  const updateProvider = useCallback(
    async (providerId: string, config: Partial<ProviderConfig>) => {
      if (!settings) return

      const updated = {
        ...settings,
        [providerId]: {
          ...settings[providerId as keyof ProviderSettings],
          ...config,
        },
      }

      setSettings(updated)
      await saveProviderSettings(updated)
      notifySubscribers(updated)

      toast({
        title: "保存成功",
        description: "供应商配置已更新",
      })
    },
    [settings, toast],
  )

  const getProvider = useCallback(
    (providerId: string): ProviderConfig | null => {
      if (!settings) return null
      return settings[providerId as keyof ProviderSettings]
    },
    [settings],
  )

  const getEnabledProviders = useCallback((): ProviderConfig[] => {
    if (!settings) return []
    return Object.values(settings).filter((provider) => provider.enabled && provider.apiKey)
  }, [settings])

  return {
    settings,
    isLoading,
    updateProvider,
    getProvider,
    getEnabledProviders,
    hasFalLegacyConfigInvalidated,
    dismissFalLegacyConfigNotice: () => setHasFalLegacyConfigInvalidated(false),
  }
}
