import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveApiBaseUrl } from './src/api/base-url.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  if (mode === 'production') {
    resolveApiBaseUrl(env.VITE_API_URL, true)
  }

  return {
    plugins: [react()],
  }
})
