import { resolve } from 'node:path';
import { config } from 'dotenv';

/** Gốc repo: từ `src/infra/config` (hoặc `dist/infra/config`) lên 5 cấp. */
const ROOT_ENV_PATH = resolve(__dirname, '../../../../../.env');

/**
 * Nạp `.env` ở GỐC repo — một file cấu hình duy nhất cho cả monorepo.
 * Chỉ có tác dụng khi chạy trên máy dev. Trong Docker, biến do compose truyền vào và
 * `override: false` giữ cho biến thật luôn thắng file .env.
 * Thiếu file .env KHÔNG phải lỗi: giá trị có thể đến từ môi trường, và `parseEnv`
 * mới là nơi báo lỗi nếu cấu hình không hợp lệ.
 */
export function loadRootEnv(): void {
  config({ path: ROOT_ENV_PATH, override: false, quiet: true });
}
