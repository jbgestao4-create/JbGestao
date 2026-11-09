import { useEffect, useRef } from 'react'
import { screenTimeService } from '@shared/services/screen-time.service'

const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutos sem interação pausa o contador de tela
const SYNC_INTERVAL_SECONDS = 5 // Sincroniza a cada 5 segundos

/**
 * Hook para monitoramento contínuo do tempo de tela e atualização do último acesso.
 */
export function useScreenTimeTracker(userId?: string | null, orgId?: string | null) {
  const pendingSecondsRef = useRef(0)
  const lastActiveTimestampRef = useRef(Date.now())

  useEffect(() => {
    if (!userId) return

    // 1. Marca imediatamente o último acesso ao iniciar a sessão
    void screenTimeService.recordScreenTime(userId, 0, orgId)

    const handleUserActivity = () => {
      lastActiveTimestampRef.current = Date.now()
    }

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true })
    })

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

    // 2. Contador de segundos ativo (1 tick por segundo)
    const intervalId = window.setInterval(() => {
      const isVisible = document.visibilityState === 'visible'
      const isNotIdle = Date.now() - lastActiveTimestampRef.current < IDLE_TIMEOUT_MS

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
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [userId])
}
