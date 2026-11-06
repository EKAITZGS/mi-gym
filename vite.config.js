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
      injectRegister: false,
      includeManifestIcons: false,
      includeAssets: ['favicon.png', 'logo.svg', 'ex/**/*.webp'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,jpg,webp,svg}', 'favicon.png'],
        globIgnores: ['**/ios-icon-*.png', '**/app-icon-*.png'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
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
        background_color: '#0a0b0e',
        theme_color: '#0a0b0e',
        icons: [
          { src: 'ios-icon-180.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
          { src: 'app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'app-icon-1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
          { src: 'app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
