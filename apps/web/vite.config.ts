import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Web bundle @vpp/shared từ MÃ NGUỒN TypeScript, không qua `dist/` (bản build là
 *  CommonJS — Rollup không phân tích tĩnh được `__exportStar(require(...))`).
 *  Lợi thêm: sửa shared là HMR ngay, không phải build lại. */
const sharedSrc = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@vpp/shared': sharedSrc } },
  server: { port: 8080 },
});
