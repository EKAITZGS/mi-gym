import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base './' => funciona en GitHub Pages (subruta /repo/) y en cualquier hosting estático
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'ex/**/*.webp'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,webp,svg}'],
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'Mi Gym',
        short_name: 'Mi Gym',
        description: 'Entrenos, ejercicios y calorías',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
