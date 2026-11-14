import { useEffect, useRef } from 'react'
import { screenTimeService } from '@shared/services/screen-time.service'
import { systemSettingsService } from '@shared/services/system-settings.service'

const SYNC_INTERVAL_SECONDS = 30 // Sincroniza com Supabase a cada 30 segundos (reduz tráfego contínuo)

/**
 * Retorna o tempo configurado de inatividade em milissegundos
 */
export function getInactivityTimeoutMs(): number {
  return systemSettingsService.getLocalInactivityTimeoutMinutes() * 60 * 1000
}

/**
 * Verifica se a aplicação encontra-se no modo Tela Cheia do PDV
 */
export function isPdvFullscreenActive(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false
  const inFullscreen = Boolean(document.fullscreenElement)
  const isPdvLocked = sessionStorage.getItem('pdv_fullscreen_locked') === 'true'
  const isPdvPath =
    window.location.pathname.startsWith('/orcafacil/sales') ||
    window.location.pathname.startsWith('/sales') ||
    window.location.pathname.includes('/pdv')
  return inFullscreen && (isPdvLocked || isPdvPath)
}

/**
 * Hook para monitoramento contínuo do tempo de tela, atualização do último acesso
 * e encerramento de sessão automático por inatividade de 2 minutos (exceto tela cheia do PDV).
 */
export function useScreenTimeTracker(
  userId?: string | null,
  orgId?: string | null,
  onInactiveLogout?: () => void,
) {
  const pendingSecondsRef = useRef(0)
  const lastActiveTimestampRef = useRef(Date.now())
  const lastStorageWriteRef = useRef(Date.now())
  const hasLoggedOutRef = useRef(false)
  const timeoutMsRef = useRef(getInactivityTimeoutMs())

  useEffect(() => {
    // Escuta alterações locais e sincroniza o tempo de timeout
    const handleTimeoutChanged = (e: any) => {
      const mins = e.detail?.timeoutMinutes
      if (typeof mins === 'number' && mins >= 1) {
        timeoutMsRef.current = mins * 60 * 1000
      }
    }
    window.addEventListener('inactivity-timeout-changed', handleTimeoutChanged)

    // Consulta configuração remota do Supabase
    void systemSettingsService.getInactivitySettings().then((res) => {
      if (res.success && res.data) {
        timeoutMsRef.current = res.data.timeoutMinutes * 60 * 1000
      }
    })

    return () => {
      window.removeEventListener('inactivity-timeout-changed', handleTimeoutChanged)
    }
  }, [])

  useEffect(() => {
    if (!userId) return

    // 1. Marca imediatamente o último acesso ao iniciar a sessão
    void screenTimeService.recordScreenTime(userId, 0, orgId)

    const handleUserActivity = () => {
      const now = Date.now()
      lastActiveTimestampRef.current = now
      hasLoggedOutRef.current = false

      // Debounce na escrita do localStorage para sincronizar abas do mesmo navegador
      if (now - lastStorageWriteRef.current > 3000) {
        lastStorageWriteRef.current = now
        try {
          localStorage.setItem('jb_last_user_activity', String(now))
        } catch {
          // ignore
        }
      }
    }

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true })
    })

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'jb_last_user_activity' && e.newValue) {
        const remoteTime = Number(e.newValue)
        if (!isNaN(remoteTime) && remoteTime > lastActiveTimestampRef.current) {
          lastActiveTimestampRef.current = remoteTime
          hasLoggedOutRef.current = false
        }
      }
    }
    window.addEventListener('storage', handleStorageEvent)

    const flush = () => {
      const secs = pendingSecondsRef.current
      if (secs > 0) {
        pendingSecondsRef.current = 0
        void screenTimeService.recordScreenTime(userId, secs, orgId)
        window.dispatchEvent(
          new CustomEvent('screen-time-tick', {
            detail: { userId, pendingSeconds: 0 },
          }),
        )
      }
    }

    // 2. Contador de segundos e verificação de inatividade a cada 1 segundo
    const intervalId = window.setInterval(() => {
      const now = Date.now()
      const sharedLastActive = Math.max(
        lastActiveTimestampRef.current,
        Number(localStorage.getItem('jb_last_user_activity') || 0),
      )
      const inactiveDuration = now - sharedLastActive

      // REGRA DE SEGURANÇA: Deslogar após tempo de inatividade configurado (exceto se em tela cheia do PDV)
      const currentTimeoutMs = timeoutMsRef.current || getInactivityTimeoutMs()

      if (inactiveDuration >= currentTimeoutMs && !hasLoggedOutRef.current) {
        if (isPdvFullscreenActive()) {
          // No modo tela cheia do PDV, a sessão permanece ativa continuamente sem deslogar
          lastActiveTimestampRef.current = now
          try {
            localStorage.setItem('jb_last_user_activity', String(now))
          } catch {
            // ignore
          }
        } else {
          hasLoggedOutRef.current = true
          flush()
          if (onInactiveLogout) {
            onInactiveLogout()
          } else {
            window.dispatchEvent(new CustomEvent('inactivity-logout-required'))
          }
          return
        }
      }

      const isVisible = document.visibilityState === 'visible'
      const isNotIdle = inactiveDuration < currentTimeoutMs

      if (isVisible && isNotIdle) {
        pendingSecondsRef.current += 1
        window.dispatchEvent(
          new CustomEvent('screen-time-tick', {
            detail: { userId, pendingSeconds: pendingSecondsRef.current },
          }),
        )
      }

      if (pendingSecondsRef.current >= SYNC_INTERVAL_SECONDS) {
        flush()
      }
    }, 1000)

    // 3. Sincroniza ao mudar de aba ou minimizar
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flush()
      } else {
        lastActiveTimestampRef.current = Date.now()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 4. Sincroniza antes de descarregar a página
    const handleBeforeUnload = () => {
      flush()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      flush()
      clearInterval(intervalId)
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleUserActivity)
      })
      window.removeEventListener('storage', handleStorageEvent)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [userId, orgId, onInactiveLogout])
}
