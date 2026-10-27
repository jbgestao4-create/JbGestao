import '@/styles/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@app/App'
import { checkEnvironment } from '@app/config/env'
import { ConfigMissingScreen } from '@shared/components/ConfigMissingScreen'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Elemento #root não encontrado no DOM. Verifique o index.html.')
}

const envStatus = checkEnvironment()

createRoot(rootElement).render(
  <StrictMode>
    {envStatus.isValid ? <App /> : <ConfigMissingScreen missing={envStatus.missing} />}
  </StrictMode>,
)
