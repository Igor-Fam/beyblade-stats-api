import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['garnishable-nubia-nobler.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: 'http://api:3000',
        changeOrigin: true
      }
    }
  }
})
