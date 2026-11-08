/**
 * Registra o Service Worker do PWA quando suportado pelo navegador.
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined') return

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.info('[PWA] Nova versão instalada e pronta para uso.')
              }
            })
          }
        })
      } catch (err) {
        console.warn('[PWA] Falha ao registrar Service Worker:', err)
      }
    })
  }
}
