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
      manifestFilename: 'manifest-v4.webmanifest',
      includeAssets: ['favicon.png', 'logo.svg', 'ex/**/*.webp'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,jpg,webp,svg}', 'favicon.png'],
        globIgnores: ['**/ios-icon-*.png', '**/app-icon-*.png', '**/icono.html'],
        navigateFallback: 'index.html',
        // nunca responder con la página a peticiones de iconos/manifest (iOS los pide al añadir a inicio)
        navigateFallbackDenylist: [/\.(png|jpg|jpeg|webp|svg|ico|webmanifest|json)$/i, /icono\.html$/],
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
          { src: 'icon-192.png?v=4', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png?v=4', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
