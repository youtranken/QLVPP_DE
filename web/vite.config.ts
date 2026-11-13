import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // 'static' thay 'assets' để nginx không nuốt route SPA /assets
    assetsDir: 'static',
    // Vite 8 (rolldown): codeSplitting.groups thay manualChunks. Cùng ưu tiên → nhóm đứng trước thắng,
    // giữ đúng thứ tự cũ: @tanstack → *i18next* → react (react-i18next về i18n, @tanstack/react-* về data).
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'data-vendor', test: /node_modules[\\/]@tanstack[\\/]/ },
            { name: 'i18n-vendor', test: /node_modules[\\/][^\\/]*i18next[^\\/]*[\\/]/ },
            {
              name: 'react-vendor',
              test: /node_modules[\\/](?:.*[\\/])?(?:react|react-dom|react-router[^\\/]*|scheduler)[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: {
    // Same-origin /api như nginx prod (cookie SameSite=Strict); api dev publish 127.0.0.1:3000 ở override
    proxy: {
      '/api': { target: process.env.VITE_API_TARGET ?? 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    setupFiles: './src/test/setup.ts',
    css: false,
    restoreMocks: true,
    unstubGlobals: true,
  },
})
