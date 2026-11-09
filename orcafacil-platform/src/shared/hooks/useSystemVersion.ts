import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@app/config/supabase'
import {
  systemUpdateService,
  formatSystemVersion,
  DEFAULT_SYSTEM_VERSION,
} from '@shared/services/system-update.service'

const LATEST_VERSION_STORAGE_KEY = 'jb_system_latest_version'

export function useSystemVersion(): {
  version: string
  refreshVersion: () => Promise<string>
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

  useEffect(() => {
    let isMounted = true

    // Carrega versão mais recente no mount
    void systemUpdateService.getLatestVersion().then((latest) => {
      if (isMounted && latest) {
        setVersion(formatSystemVersion(latest))
      }
    })

    // Escuta eventos locais emitidos no mesmo navegador (ex: ao salvar atualização)
    const handleLocalChange = (event: Event) => {
      const detail = (event as CustomEvent<{ version: string }>).detail
      if (detail?.version && isMounted) {
        setVersion(formatSystemVersion(detail.version))
      }
    }
    window.addEventListener('system-version-changed', handleLocalChange)

    // Escuta mudanças no Supabase em tempo real (qualquer alteração na tabela system_updates)
    const channel = supabase
      .channel('system-updates-version-tracker')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_updates',
        },
        () => {
          void systemUpdateService.getLatestVersion().then((latest) => {
            if (isMounted && latest) {
              setVersion(latest)
            }
          })
        },
      )
      .subscribe()

    return () => {
      isMounted = false
      window.removeEventListener('system-version-changed', handleLocalChange)
      void supabase.removeChannel(channel)
    }
  }, [])

  return { version, refreshVersion }
}
