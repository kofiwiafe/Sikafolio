import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/gse': {
        target: 'https://afx.kwayisi.org',
        rewrite: () => '/gse/',
        changeOrigin: true,
        secure: true,
      },
      '/api/trades':    { target: 'https://sikafolio.vercel.app', changeOrigin: true },
      '/api/users':     { target: 'https://sikafolio.vercel.app', changeOrigin: true },
      '/api/sync-meta': { target: 'https://sikafolio.vercel.app', changeOrigin: true },
      '/api/ocr':       { target: 'https://sikafolio.vercel.app', changeOrigin: true },
      '/api/news':      { target: 'https://sikafolio.vercel.app', changeOrigin: true },
      '/api/summarize': { target: 'https://sikafolio.vercel.app', changeOrigin: true },
      '/api/comments':  { target: 'https://sikafolio.vercel.app', changeOrigin: true },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'SikaFolio',
        short_name: 'SikaFolio',
        description: 'Your Ghana Stock Exchange portfolio, tracked automatically from Gmail.',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/afx\.kwayisi\.org\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'gse-prices', expiration: { maxAgeSeconds: 300 } }
          }
        ]
      }
    }),
  ]
})
