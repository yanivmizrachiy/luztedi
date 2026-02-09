import { readFile } from 'node:fs/promises'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),

    // Dev server: serve the single source of truth at /data/schedule.json
    {
      name: 'serve-schedule-json',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url) return next()
          const url = req.url.split('?')[0]
          if (url !== '/data/schedule.json') return next()
          try {
            const json = await readFile('data/schedule.json', 'utf8')
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.statusCode = 200
            res.end(json)
          } catch {
            res.statusCode = 404
            res.end('')
          }
        })
      },
    },

    // Build: copy data/schedule.json into dist/data/schedule.json
    viteStaticCopy({
      targets: [{ src: 'data/schedule.json', dest: 'data' }],
    }),

    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'לוז בית-ספרי',
        short_name: 'לוז',
        description:
          'לוז בית-ספרי מסונכרן ל-GitHub עם שמירה מקומית וייבוא/ייצוא JSON.',
        lang: 'he',
        dir: 'rtl',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2563eb',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
})
