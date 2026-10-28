import { Pool } from 'pg';

// DB treo thì pg mặc định chờ kết nối vô hạn — health phải trả 503 nhanh thay vì treo theo
const CONNECTION_TIMEOUT_MS = 3000;

export function createPgPool(connectionString: string | undefined): Pool {
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  });
  // Không có listener 'error' thì client idle rớt kết nối sẽ giết cả process.
  pool.on('error', (error) => {
    console.error('[pg-pool] lỗi kết nối idle:', error);
  });
  return pool;
}
