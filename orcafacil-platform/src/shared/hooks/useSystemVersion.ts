import { useEffect, useState, useCallback } from 'react'
import {
  systemUpdateService,
  formatSystemVersion,
  DEFAULT_SYSTEM_VERSION,
  initSystemVersionRealtime,
} from '@shared/services/system-update.service'

const LATEST_VERSION_STORAGE_KEY = 'jb_system_latest_version'

export function useSystemVersion(): {
  version: string
  refreshVersion: () => Promise<string>
  setCustomVersion: (newVersion: string) => Promise<string>
} {
  const [version, setVersion] = useState<string>(() => {
    try {
      const cached = localStorage.getItem(LATEST_VERSION_STORAGE_KEY)
      if (cached && cached.trim()) return formatSystemVersion(cached.trim())
    } catch {
      // ignore
    }
    return DEFAULT_SYSTEM_VERSION
  })

  const refreshVersion = useCallback(async (): Promise<string> => {
    const latest = await systemUpdateService.getLatestVersion()
    const formatted = formatSystemVersion(latest)
    setVersion(formatted)
    return formatted
  }, [])

  const setCustomVersion = useCallback(async (newVersion: string): Promise<string> => {
    const res = await systemUpdateService.setCurrentVersion(newVersion)
    const formatted = res.success && res.data ? res.data : formatSystemVersion(newVersion)
    setVersion(formatted)
    return formatted
  }, [])

  useEffect(() => {
    let isMounted = true

    // 1. Inicializa o canal Realtime singleton global do Supabase (executa apenas uma vez)
    initSystemVersionRealtime()

    // 2. Carrega a versão mais recente ao montar o componente
    void systemUpdateService.getLatestVersion().then((latest) => {
      if (isMounted && latest) {
        setVersion(formatSystemVersion(latest))
      }
    })

    // 3. Escuta eventos locais emitidos na mesma janela/aba
    const handleLocalChange = (event: Event) => {
      const detail = (event as CustomEvent<{ version: string }>).detail
      if (detail?.version && isMounted) {
        setVersion(formatSystemVersion(detail.version))
      }
    }
    window.addEventListener('system-version-changed', handleLocalChange)

    // 4. Escuta BroadcastChannel para sincronização instantânea entre abas
    let broadcastChannel: BroadcastChannel | null = null
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        broadcastChannel = new BroadcastChannel('jb_system_version_bus')
        broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'system-version-changed' && event.data?.version && isMounted) {
            setVersion(formatSystemVersion(event.data.version))
          }
        }
      }
    } catch {
      broadcastChannel = null
    }

    // 5. Escuta evento nativo de storage (outras abas)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === LATEST_VERSION_STORAGE_KEY && event.newValue && isMounted) {
        setVersion(formatSystemVersion(event.newValue))
      }
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      isMounted = false
      window.removeEventListener('system-version-changed', handleLocalChange)
      window.removeEventListener('storage', handleStorageChange)
      if (broadcastChannel) {
        broadcastChannel.close()
      }
    }
  }, [])

  return { version, refreshVersion, setCustomVersion }
}
