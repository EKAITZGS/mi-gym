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
      includeAssets: ['favicon.png', 'logo.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,jpg,webp,svg,woff2}', 'favicon.png', 'body/*.png'],
        // las fotos de ejercicios no se descargan al instalar: se bajan al verlas y se guardan (ver runtimeCaching)
        globIgnores: ['**/ios-icon-*.png', '**/app-icon-*.png', '**/icono.html', '**/ex/**'],
        runtimeCaching: [
          {
            urlPattern: /\/ex\/.+\.(webp|jpg)$/i,
            handler: 'CacheFirst',
            options: { cacheName: 'ex-fotos', expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
        navigateFallback: 'index.html',
        // nunca responder con la página a peticiones de iconos/manifest (iOS los pide al añadir a inicio)
        navigateFallbackDenylist: [/\.(png|jpg|jpeg|webp|svg|ico|webmanifest|json)$/i, /icono\.html$/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // avisos push: muestra la notificación y abre la app al tocarla
        importScripts: ['push-sw.js?v=2'],
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
        background_color: '#0b0b0b',
        theme_color: '#0b0b0b',
        icons: [
          { src: 'icon-192.png?v=5', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png?v=5', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
