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

// Ngày lọc là ngày lịch giờ VN: 16/3/2001 = [2001-03-15T17:00Z, 2001-03-16T17:00Z)
describe('GET admin/audit ngày VN', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  const actor = `e2e-day-${Date.now()}`;
  const stamps = {
    'trước 00:00 ngày 16 (16:59:59.999 UTC)': '2001-03-15T16:59:59.999Z',
    '00:00:00 ngày 16 (17:00:00 UTC)': '2001-03-15T17:00:00.000Z',
    '23:59:59.999 ngày 16 (16:59:59.999 UTC)': '2001-03-16T16:59:59.999Z',
    '00:00:00 ngày 17 (17:00:00 UTC)': '2001-03-16T17:00:00.000Z',
  };

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
    for (const [label, at] of Object.entries(stamps)) {
      await pool.query(
        `INSERT INTO audit_log (actor, action, object_id, created_at) VALUES ($1, 'e2e.day', $2, $3)`,
        [actor, label, at],
      );
    }
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('from = to = 2001-03-16 gồm 00:00:00 và 23:59:59.999 giờ VN, loại một mili giây ngoài hai đầu', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/audit')
      .query({ actor, from: '2001-03-16', to: '2001-03-16' })
      .set('x-dev-user-sub', 'dev-admin')
      .set('x-dev-role', 'admin')
      .expect(200);
    const labels = (res.body as { items: Array<{ objectId: string }> }).items
      .map((r) => r.objectId)
      .sort();
    expect(labels).toEqual(
      [
        '00:00:00 ngày 16 (17:00:00 UTC)',
        '23:59:59.999 ngày 16 (16:59:59.999 UTC)',
      ].sort(),
    );
  });
});
