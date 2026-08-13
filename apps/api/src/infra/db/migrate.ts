import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { parseEnv } from '../config/env';
import { loadRootEnv } from '../config/load-env';

/** Chạy toàn bộ migration trong `drizzle/` lên DB trỏ bởi DATABASE_URL. */
async function main(): Promise<void> {
  loadRootEnv();
  const { DATABASE_URL } = parseEnv();
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    await migrate(drizzle(pool), { migrationsFolder: resolve(__dirname, '../../../drizzle') });
    console.log('Migration hoàn tất.');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Migration thất bại:', error);
  process.exit(1);
});
