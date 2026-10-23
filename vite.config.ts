import preact from '@preact/preset-vite'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// Set VITE_BASE=/repo-name/ when deploying under a sub-path (GitHub Pages).
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'liftlog',
        short_name: 'liftlog',
        description: 'Open-source workout tracker with an exercise library.',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#DFE0DC',
        theme_color: '#DFE0DC',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2,json}'] },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
