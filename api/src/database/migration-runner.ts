import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';

// Hai instance api khởi động cùng lúc không được chạy migration chồng nhau.
const MIGRATION_LOCK_ID = 727_101;

// Zero-pad bắt buộc: sort chuỗi '10_' < '2_' nếu không pad.
const MIGRATION_NAME_PATTERN = /^\d{4}_.+\.sql$/;

export interface MigrationLogger {
  log(message: string): void;
}

// Mỗi file một transaction, journal ở _migrations; file đã apply mà bị sửa → fail, không để schema drift.
export async function runMigrations(
  pool: Pool,
  dir: string,
  logger: MigrationLogger = console,
): Promise<string[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const invalid = files.filter((f) => !MIGRATION_NAME_PATTERN.test(f));
  if (invalid.length > 0) {
    throw new Error(
      `Tên migration sai format NNNN_<mô-tả>.sql (bắt buộc zero-pad 4 số): ${invalid.join(', ')}`,
    );
  }
  const applied: string[] = [];
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS _migrations (
         name text PRIMARY KEY,
         checksum text NOT NULL,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    for (const file of files) {
      const sql = await readFile(join(dir, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const done = await client.query<{ checksum: string }>(
        'SELECT checksum FROM _migrations WHERE name = $1',
        [file],
      );
      if ((done.rowCount ?? 0) > 0) {
        if (done.rows[0].checksum !== checksum) {
          throw new Error(
            `Migration ${file} đã apply nhưng nội dung file đã bị sửa (checksum lệch). ` +
              'Không sửa migration đã chạy — tạo migration mới.',
          );
        }
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (name, checksum) VALUES ($1, $2)',
          [file, checksum],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(
          `Migration ${file} thất bại: ${(error as Error).message}`,
          { cause: error },
        );
      }
      applied.push(file);
      logger.log(`Migration applied: ${file}`);
    }
  } finally {
    await client
      .query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID])
      .catch(() => undefined);
    client.release();
  }
  return applied;
}

// dist/main.js → dist/migrations (nest-cli assets); ts-jest → src/migrations.
export function resolveMigrationsDir(): string {
  return process.env.MIGRATIONS_DIR ?? join(__dirname, '..', 'migrations');
}
