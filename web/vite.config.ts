import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // /device/pending and /device/approve are real backend routes (ESP32
  // poll/approve), not under /api -- found missing here while building the
  // frontend's /device page's tamper check, which silently hit Vite's own
  // dev server instead of the backend. A bare '/device' prefix is too
  // broad: it also matches this app's OWN client-side route at /device
  // (the page itself), so Vite proxied the page navigation to the backend
  // instead of serving the SPA -- caught live via a "Cannot GET /device"
  // screenshot. Only the two backend leaf paths are proxied.
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/device/pending': 'http://localhost:3000',
      '/device/approve': 'http://localhost:3000',
    },
  },
})
