import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    // In dev, proxy /api/* to the local Express backend (port 3001)
    // In production (Vercel), /api/* is served as serverless functions on the same domain
    proxy: mode === 'development' ? {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    } : {},
  },
}))

