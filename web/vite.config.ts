import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { CHUNK_GROUPS } from './chunk-groups.ts'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // 'static' thay 'assets' để nginx không nuốt route SPA /assets
    assetsDir: 'static',
    // Vite 8 (rolldown): codeSplitting.groups thay manualChunks. Cùng ưu tiên → nhóm đứng trước thắng, và mỗi nhóm
    // kéo theo cả phụ thuộc của module đã khớp nếu chưa nhóm nào nhận. Hash một chunk đổi khi chunk nó import đổi tên,
    // nên react-vendor (thứ mọi chunk khác import) phải đứng ĐẦU và chỉ chứa thứ ít đổi:
    //  - react-vendor: react (+ jsx-runtime), react-dom, scheduler — không gì khác.
    //  - data-vendor: @tanstack/* (đổi nhiều nhất; nâng bản chỉ đổi chunk này và chunk app, không đổi react/i18n-vendor).
    //  - i18n-vendor: i18next, react-i18next + use-sync-external-store, html-parse-stringify, void-elements.
    //  - router-vendor: react-router, react-router-dom (+ cookie, set-cookie-parser).
    //  @floating-ui/*, @radix-ui/*, react-remove-scroll* không khớp nhóm nào → nằm ở chunk app.
    //  Code app tách theo route (shell/route-chunks.ts): chunk chính + admin-pages / member-pages / print-pages nạp lười.
    //  CSS vẫn một file (main.tsx gom mọi CSS đúng thứ tự cũ), nên không cần cssCodeSplit hay chờ CSS khi đổi trang.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: CHUNK_GROUPS,
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
