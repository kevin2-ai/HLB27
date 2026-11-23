import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/HLB27/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'HackerLab Bénin 2027',
        short_name: 'HackerLab 27',
        description: 'Suivi de préparation de l’équipe HackerLab Bénin 2027.',
        lang: 'fr',
        theme_color: '#0B0714',
        background_color: '#0B0714',
        display: 'standalone',
        start_url: '/HLB27/',
        scope: '/HLB27/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@supabase/')) return 'supabase'
          if (/\/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(id)) return 'motion'
          if (id.includes('/node_modules/')) return 'vendor'
        },
      },
    },
  },
})
