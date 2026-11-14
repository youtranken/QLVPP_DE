import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { LogoutTokenJtiService } from '../src/modules/auth/logout-token-jti.service';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

describe('logout_token_jti — chống dùng lại logout_token (Postgres thật)', () => {
  let app: INestApplication;
  let pool: Pool;
  let jtis: LogoutTokenJtiService;
  const P = `jti-${Date.now()}-`;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), { log: () => undefined });
    app = await createTestApp();
    jtis = app.get(LogoutTokenJtiService);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM logout_token_jti WHERE jti LIKE $1', [
      `${P}%`,
    ]);
    await pool.end();
    await app.close();
  });

  const insert = (jti: string) =>
    pool.query(
      `INSERT INTO logout_token_jti (jti, expires_at) VALUES ($1, now() + interval '1 minute')`,
      [jti],
    );

  it('CHECK độ dài: 255 ký tự được, 256 bị từ chối, rỗng bị từ chối', async () => {
    await expect(insert(P + 'a'.repeat(255 - P.length))).resolves.toBeDefined();
    await expect(insert(P + 'b'.repeat(256 - P.length))).rejects.toThrow(
      /check constraint/,
    );
    await expect(insert('')).rejects.toThrow(/check constraint/);
  });

  it('claim: lần đầu true, lần 2 cùng jti false', async () => {
    const jti = P + randomUUID();
    const exp = new Date(Date.now() + 120_000);
    await expect(jtis.claim(jti, exp)).resolves.toBe(true);
    await expect(jtis.claim(jti, exp)).resolves.toBe(false);
  });

  it('giữ tới exp + 60 s: exp cách đây 55 s → vẫn chặn; exp cách đây 65 s → dòng đã dọn, nhận lại', async () => {
    const still = P + randomUUID();
    await jtis.claim(still, new Date(Date.now() - 55_000));
    await expect(
      jtis.claim(still, new Date(Date.now() - 55_000)),
    ).resolves.toBe(false);
    const gone = P + randomUUID();
    await jtis.claim(gone, new Date(Date.now() - 65_000));
    await expect(jtis.claim(gone, new Date(Date.now() - 65_000))).resolves.toBe(
      true,
    );
  });
});
