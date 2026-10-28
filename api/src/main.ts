import { NestFactory } from '@nestjs/core';
import { Pool } from 'pg';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import {
  resolveMigrationsDir,
  runMigrations,
} from './database/migration-runner';

function requiredPort(): number {
  const raw = process.env.PORT ?? '3000';
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`PORT không hợp lệ: ${JSON.stringify(raw)}`);
  }
  return port;
}

async function migrate(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Thiếu DATABASE_URL — không khởi động (tránh pg fallback localhost).',
    );
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pool.on('error', (error) => {
    console.error('[migration-pool] lỗi kết nối idle:', error);
  });
  try {
    await runMigrations(pool, resolveMigrationsDir());
  } finally {
    await pool.end();
  }
}

async function bootstrap(): Promise<void> {
  const port = requiredPort();
  await migrate();
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((error: Error) => {
  console.error('[FATAL] Khởi động thất bại:', error);
  process.exit(1);
});
