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
    // Vite 8 (rolldown): codeSplitting.groups thay manualChunks. Cùng ưu tiên → nhóm đứng trước thắng, và mỗi nhóm
    // kéo theo cả phụ thuộc của module đã khớp nếu chưa nhóm nào nhận. Kết quả build thực tế:
    //  - data-vendor: @tanstack/* VÀ react + react/jsx-runtime (kéo theo từ @tanstack/react-*, nhóm này xét trước).
    //  - i18n-vendor: i18next, react-i18next + use-sync-external-store, html-parse-stringify, void-elements.
    //  - react-vendor: react-dom, react-router, scheduler, và @floating-ui/react, @floating-ui/react-dom (regex
    //    khớp thư mục `react`/`react-dom` lồng sau scope) kéo theo @floating-ui/core, dom, utils.
    //  @radix-ui/react-* và react-remove-scroll* không khớp nhóm nào → nằm ở index.
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
