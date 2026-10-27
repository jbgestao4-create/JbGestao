import '@testing-library/jest-dom'

// Mock para variáveis de ambiente nos testes
Object.assign(import.meta.env, {
  VITE_SUPABASE_URL: 'https://test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'test-anon-key',
  DEV: true,
  PROD: false,
})

