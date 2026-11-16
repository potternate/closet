import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

function devApi(): Plugin {
  return {
    name: 'closet-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/(product|image)(\?|$)/)
        if (!match) return next()
        try {
          const handler = (await server.ssrLoadModule(`/api/${match[1]}.ts`)) as { GET: (request: Request) => Promise<Response> }
          const response = await handler.GET(new Request(new URL(req.url!, 'http://localhost')))
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          next(error)
        }
      })
    },
  }
}

export default defineConfig({
  preview: { allowedHosts: true },
  server: { allowedHosts: true },
  plugins: [
    devApi(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Closet',
        short_name: 'Closet',
        description: 'Your digital closet. Add clothes from photos or product links.',
        theme_color: '#f5f5f4',
        background_color: '#f5f5f4',
        display: 'standalone',
        share_target: { action: '/', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        globIgnores: ['**/ort-*', '**/ort.*'],
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
})
