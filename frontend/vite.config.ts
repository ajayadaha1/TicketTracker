import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/ticket-tracker',
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: ['failsafe.amd.com', 'localhost', '.amd.com'],
    proxy: {
      '/ticket-tracker-api': {
        target: 'http://tickettracker_backend:8000',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/ticket-tracker-api/, ''),
      },
    },
  },
})
