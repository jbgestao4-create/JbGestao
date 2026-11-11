import 'bootstrap/dist/css/bootstrap-grid.min.css'
import '@/styles/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { checkEnvironment } from '@app/config/env'
import { ConfigMissingScreen } from '@shared/components/ConfigMissingScreen'

// Garante que qualquer Service Worker legado seja desregistrado (operação 100% online)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      void registration.unregister()
    }
  })
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Elemento #root não encontrado no DOM. Verifique o index.html.')
}

const envStatus = checkEnvironment()
const root = createRoot(rootElement)

if (!envStatus.isValid) {
  root.render(
    <StrictMode>
      <ConfigMissingScreen missing={envStatus.missing} />
    </StrictMode>,
  )
} else {
  void import('@app/App').then(({ App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
