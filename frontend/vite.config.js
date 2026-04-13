import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/chat': 'http://localhost:3001',
      '/customer': 'http://localhost:3001',
      '/customers': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
      '/status': 'http://localhost:3001',
    },
  },
})
