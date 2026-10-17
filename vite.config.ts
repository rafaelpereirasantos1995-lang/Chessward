import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'pieces/**/*.svg', 'stockfish/*'],
      manifest: {
        name: 'Chessward — Centro de Treinamento',
        short_name: 'Chessward',
        description: 'Treine xadrez com mapa de vulnerabilidades e treinador ao vivo.',
        lang: 'pt-BR',
        theme_color: '#1c1917',
        background_color: '#1c1917',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,json}'],
        // O motor (stockfish.wasm) tem ~7 MB e precisa ficar em cache para jogar offline.
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
  test: { environment: 'node' },
})
