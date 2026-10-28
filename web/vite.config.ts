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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@tanstack')) return 'data-vendor';
          if (id.includes('i18next')) return 'i18n-vendor';
          if (
            id.includes('react-router') ||
            id.includes('react-dom') ||
            id.includes('/react/') ||
            id.includes('scheduler')
          )
            return 'react-vendor';
        },
      },
    },
  },
  server: {
    // Same-origin /api như nginx prod — cookie SameSite=Strict cần
    proxy: {
      '/api': { target: 'https://localhost', changeOrigin: true, secure: false },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
    restoreMocks: true,
    unstubGlobals: true,
  },
})
