import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const KEYS = ['registration_last_day', 'reminder_days_left'];

describe('admin/config: hai PUT đồng thời không lách luật reminder ≤ hạn − 1', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let saved: Array<{ key: string; value: unknown }>;
  const put = (body: object) =>
    request(app.getHttpServer())
      .put('/api/admin/config')
      .set('x-dev-user-sub', 'e2e-config-conc')
      .set('x-dev-role', 'admin')
      .send(body);
  const setPair = (lastDay: number, reminder: number) =>
    pool.query(
      `UPDATE config SET value = CASE key WHEN 'registration_last_day' THEN $1::jsonb ELSE $2::jsonb END
       WHERE key = ANY($3)`,
      [String(lastDay), String(reminder), KEYS],
    );

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    saved = (
      await pool.query('SELECT key, value FROM config WHERE key = ANY($1)', [
        KEYS,
      ])
    ).rows;
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    for (const row of saved) {
      await pool.query('UPDATE config SET value = $2 WHERE key = $1', [
        row.key,
        JSON.stringify(row.value),
      ]);
    }
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('từ {hạn 10, nhắc 3}: PUT {reminder 7} ∥ PUT {hạn 5} → đúng một 200 và một 400 CONFIG_INVALID, config cuối thỏa luật (5 vòng)', async () => {
    for (let i = 0; i < 5; i++) {
      await setPair(10, 3);
      const res = await Promise.all([
        put({ reminder_days_left: 7 }),
        put({ registration_last_day: 5 }),
      ]);
      const outcome = res
        .map((r) => `${r.status}${r.status === 400 ? ` ${r.body.code}` : ''}`)
        .sort();
      expect(outcome).toEqual(['200', '400 CONFIG_INVALID']);
      const { rows } = await pool.query<{ key: string; value: number }>(
        'SELECT key, value FROM config WHERE key = ANY($1)',
        [KEYS],
      );
      const v = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      expect(v.reminder_days_left).toBeLessThanOrEqual(
        v.registration_last_day - 1,
      );
    }
  });
});
