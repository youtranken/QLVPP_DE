import { INestApplication } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
const SUFFIX = `${process.pid}-${Date.now().toString(36)}`;
const OWNER = `db-adjust-owner-${SUFFIX}`;
const ADMINS = [`db-adjust-a1-${SUFFIX}`, `db-adjust-a2-${SUFFIX}`];
// Kỳ rất cũ: luôn đã khóa so với đồng hồ thật, không đụng kỳ của suite khác
const YM = '2001-03-01';

describe('điều chỉnh phiếu: hai Hành chính cùng lúc, batch_id (Postgres thật)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let dir: string;
  let itemId: string;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.query(
      "INSERT INTO users (sub, full_name, status) VALUES ($1, 'Chủ phiếu', 'active')",
      [OWNER],
    );
    await pool.query(
      `INSERT INTO periods (ym, deadline) VALUES ($1, '2001-03-10T17:00:00Z') ON CONFLICT (ym) DO NOTHING`,
      [YM],
    );
    itemId = (
      await pool.query<{ id: string }>(
        "INSERT INTO items (name, unit, max_qty) VALUES ($1, 'cay', 10) RETURNING id",
        [`db-adjust-${SUFFIX}`],
      )
    ).rows[0].id;
    dir = await mkdtemp(join(tmpdir(), 'vpp-adjust-'));
    process.env.FILES_DIR = dir;
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    await pool.query('DELETE FROM requests WHERE user_sub = $1', [OWNER]);
    await pool.query('DELETE FROM in_app_notifications WHERE user_sub = $1', [
      OWNER,
    ]);
    await pool.query('DELETE FROM items WHERE id = $1', [itemId]);
    await pool.query('DELETE FROM users WHERE sub = $1', [OWNER]);
    await pool.end();
    await rm(dir, { recursive: true, force: true });
    delete process.env.FILES_DIR;
    delete process.env.AUTH_DEV_MODE;
  });

  const seed = async () => {
    await pool.query('DELETE FROM requests WHERE user_sub = $1', [OWNER]);
    const { rows } = await pool.query<{ id: string; updated_at: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub, updated_at)
       VALUES ($1, $2, $2, '2001-03-05T03:00:00Z') RETURNING id,
       to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at`,
      [YM, OWNER],
    );
    const line = await pool.query<{ id: string }>(
      'INSERT INTO request_lines (request_id, item_id, qty) VALUES ($1, $2, 5) RETURNING id',
      [rows[0].id, itemId],
    );
    return { ...rows[0], lineId: line.rows[0].id };
  };

  const put = (
    admin: string,
    r: { id: string; updated_at: string; lineId: string },
    qty: number,
  ) =>
    request(app.getHttpServer())
      .put(`/api/admin/requests/${r.id}/lines`)
      .set('x-dev-user-sub', admin)
      .set('x-dev-role', 'admin')
      .send({
        expected_updated_at: r.updated_at,
        lines: [
          { id: r.lineId, qty, expected_qty: 5, reason_code: 'over_quota' },
        ],
      });

  it('5 vòng Promise.all hai HC cùng expected_* giảm cùng dòng → đúng một 200, một 409 STALE_UPDATE; 1 bản ghi; batch_id = id audit_log', async () => {
    for (let round = 0; round < 5; round++) {
      const r = await seed();
      const results = await Promise.all([
        put(ADMINS[0], r, 4),
        put(ADMINS[1], r, 3),
      ]);
      const statuses = results.map((x) => x.status).sort();
      expect(statuses).toEqual([200, 409]);
      expect(results.find((x) => x.status === 409)!.body.code).toBe(
        'STALE_UPDATE',
      );
      const records = await pool.query<{ batch_id: string }>(
        'SELECT batch_id FROM request_line_adjustments WHERE request_id = $1',
        [r.id],
      );
      expect(records.rows).toHaveLength(1);
      const audit = await pool.query<{ id: string }>(
        "SELECT id FROM audit_log WHERE action = 'request.updated' AND object_id = $1",
        [r.id],
      );
      expect(audit.rows.map((a) => a.id)).toEqual([records.rows[0].batch_id]);
    }
  });
});
