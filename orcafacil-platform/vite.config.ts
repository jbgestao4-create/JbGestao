import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  // Restringe a injeção automática de variáveis no bundle exclusivamente ao prefixo VITE_SUPABASE_
  // Isso impede que variáveis de sistema da Vercel (VITE_VERCEL_GIT_COMMIT_*, VITE_VERCEL_DEPLOYMENT_ID, etc.)
  // sejam expostas no objeto import.meta.env do cliente.
  envPrefix: 'VITE_SUPABASE_',
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@modules': fileURLToPath(new URL('./src/modules', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) {
              return 'supabase'
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor'
            }
          }
        },
      },
    },
  },
})
