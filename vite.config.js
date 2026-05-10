import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function visionDevPlugin(env) {
  return {
    name: 'vision-api-dev',
    configureServer(server) {
      server.middlewares.use('/api/vision', (req, res, next) => {
        if (req.method !== 'POST') { next(); return }
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', async () => {
          try {
            const { image } = JSON.parse(body)
            const key = env.GOOGLE_VISION_KEY
            if (!key) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'GOOGLE_VISION_KEY not set in .env' }))
              return
            }
            const visionRes = await fetch(
              `https://vision.googleapis.com/v1/images:annotate?key=${key}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  requests: [{ image: { content: image }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }],
                }),
              }
            )
            const data = await visionRes.json()
            const text = data.responses?.[0]?.fullTextAnnotation?.text || ''
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ text }))
          } catch (err) {
            res.statusCode = 502
            res.end(JSON.stringify({ error: err.message }))
          }
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
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
    visionDevPlugin(env),
  ]
  }
})
