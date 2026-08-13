import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/** Web bundle @vpp/shared từ MÃ NGUỒN TypeScript, không qua `dist/` (bản build là
 *  CommonJS — Rollup không phân tích tĩnh được `__exportStar(require(...))`).
 *  Lợi thêm: sửa shared là HMR ngay, không phải build lại. */
const sharedSrc = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), '');

  return {
    plugins: [react()],
    resolve: { alias: { '@vpp/shared': sharedSrc } },
    server: {
      port: Number(env.WEB_PORT ?? 8090),
      /**
       * Proxy `/api` sang backend để trình duyệt chỉ thấy MỘT origin — giống hệt
       * lúc chạy thật (nginx proxy `/api` → api). Nhờ vậy cookie phiên là
       * same-origin và luồng redirect OIDC không phải xử lý gì thêm.
       */
      proxy: {
        '/api': {
          target: env.WEB_API_PROXY ?? 'http://localhost:3001',
          changeOrigin: false,
        },
      },
    },
  };
});
