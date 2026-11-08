import '@/styles/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { checkEnvironment } from '@app/config/env'
import { ConfigMissingScreen } from '@shared/components/ConfigMissingScreen'
import { registerServiceWorker } from '@shared/offline/registerServiceWorker'
import { syncEngine } from '@shared/offline/sync.engine'

// Inicializa capacidades Offline-First e Sync Engine
registerServiceWorker()
syncEngine.init()

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
