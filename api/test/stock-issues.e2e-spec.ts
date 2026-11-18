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
const RUN = `isu${Date.now().toString(36)}`;
const YM = '2031-03';

describe('GET admin/issues: biên tháng theo giờ Asia/Ho_Chi_Minh', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let itemId: string;

  const http = () => request(app.getHttpServer());
  const list = (ym: string, role = 'admin') =>
    http()
      .get(`/api/admin/issues?ym=${ym}`)
      .set('x-dev-user-sub', `e2e-isu-${RUN}`)
      .set('x-dev-role', role);
  const issueAt = (at: string, note: string) =>
    pool.query(
      `INSERT INTO stock_movements (item_id, delta, reason, note, actor_sub, created_at)
       VALUES ($1, -1, 'issue', $2, 'admin', $3::timestamptz)`,
      [itemId, `${RUN} ${note}`, at],
    );
  const notes = async (ym: string) =>
    ((await list(ym).expect(200)).body as Array<{ note: string }>)
      .map((r) => r.note)
      .filter((n) => n.startsWith(RUN))
      .map((n) => n.slice(RUN.length + 1));

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
    itemId = (
      await pool.query<{ id: string }>(
        `INSERT INTO items (name, unit, stock_qty) VALUES ($1, 'cay', 100) RETURNING id`,
        [`${RUN} bút`],
      )
    ).rows[0].id;
    await issueAt('2031-02-28T23:59:59.999+07:00', 'cuối tháng 2');
    await issueAt('2031-03-01T00:00:00+07:00', 'đầu tháng 3');
    await issueAt('2031-03-31T23:59:59.999+07:00', 'cuối tháng 3');
    await issueAt('2031-04-01T00:00:00+07:00', 'đầu tháng 4');
  });

  afterAll(async () => {
    await pool.query('DELETE FROM stock_movements WHERE item_id = $1', [
      itemId,
    ]);
    await pool.query('DELETE FROM items WHERE id = $1', [itemId]);
    await app.close();
    await pool.end();
  });

  it('00:00:00 ngày 1 và 23:59:59.999 ngày cuối thuộc tháng đó; sát hai bên thuộc tháng kề', async () => {
    expect(await notes(YM)).toEqual(['đầu tháng 3', 'cuối tháng 3']);
    expect(await notes('2031-02')).toEqual(['cuối tháng 2']);
    expect(await notes('2031-04')).toEqual(['đầu tháng 4']);
  });

  it('mỗi dòng có actor_name = tên người xuất trong danh bạ (cột "Người xuất"); không có trong danh bạ (SA local) → sub, không null (AD-40)', async () => {
    await pool.query(
      `INSERT INTO users (sub, full_name, status) VALUES ($1, 'Lê Hành Chính', 'active') ON CONFLICT (sub) DO NOTHING`,
      [`e2e-isu-actor-${RUN}`],
    );
    await pool.query(
      `INSERT INTO stock_movements (item_id, delta, reason, note, actor_sub, created_at)
       VALUES ($1, -1, 'issue', $2, $3, '2031-03-15T09:00:00+07:00')`,
      [itemId, `${RUN} có người xuất`, `e2e-isu-actor-${RUN}`],
    );
    const rows = (await list(YM).expect(200)).body as Array<{
      note: string;
      actor_name: string | null;
    }>;
    const named = rows.find((r) => r.note === `${RUN} có người xuất`);
    const unknown = rows.find((r) => r.note === `${RUN} đầu tháng 3`);
    expect(named?.actor_name).toBe('Lê Hành Chính');
    expect(unknown).toHaveProperty('actor_name', 'admin');
    await pool.query('DELETE FROM stock_movements WHERE note = $1', [
      `${RUN} có người xuất`,
    ]);
    await pool.query('DELETE FROM users WHERE sub = $1', [
      `e2e-isu-actor-${RUN}`,
    ]);
  });

  it('member gọi admin/issues → 403 FORBIDDEN_ROLE', async () => {
    const res = await list(YM, 'member').expect(403);
    expect(res.body).toMatchObject({ code: 'FORBIDDEN_ROLE' });
  });

  it.each(['2031-13', '2031-1', 'abc', ''])(
    'ym "%s" sai → 400 INVALID_PERIOD',
    async (ym) => {
      const res = await list(ym).expect(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PERIOD' });
    },
  );
});
