import '@/styles/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@app/App'
import { validateEnvironment } from '@app/config/env'

// Valida variáveis de ambiente obrigatórias antes de montar a aplicação
validateEnvironment()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Elemento #root não encontrado no DOM. Verifique o index.html.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
