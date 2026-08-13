import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit chạy với cwd = apps/api; .env nằm ở gốc repo.
config({ path: '../../.env', override: false, quiet: true });

/** Cấu hình drizzle-kit (sinh migration từ schema). */
export default defineConfig({
  schema: './src/infra/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://vpp:vpp@localhost:5433/vpp',
  },
  casing: 'snake_case',
  verbose: true,
  strict: true,
});
