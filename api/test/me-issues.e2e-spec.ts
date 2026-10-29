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
const RUN = `iss${Date.now().toString(36)}`;
const A = `e2e-iss-a-${RUN}`;
const B = `e2e-iss-b-${RUN}`;

interface IssuePage {
  items: Array<{ item_name: string; qty: number; note: string }>;
  next_cursor: string | null;
}

describe('GET me/issues: chỉ xuất lẻ của chính người gọi', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let itemId: string;

  const http = () => request(app.getHttpServer());
  const mine = (sub: string, query = '') =>
    http()
      .get(`/api/me/issues${query}`)
      .set('x-dev-user-sub', sub)
      .set('x-dev-role', 'member');
  const issue = (recipient: string | null, qty: number, note: string) =>
    pool.query(
      `INSERT INTO stock_movements (item_id, delta, reason, note, recipient_sub, actor_sub)
       VALUES ($1, $2, 'issue', $3, $4, 'admin')`,
      [itemId, -qty, note, recipient],
    );

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
    await pool.query('INSERT INTO users (sub) VALUES ($1), ($2)', [A, B]);
    itemId = (
      await pool.query<{ id: string }>(
        `INSERT INTO items (name, unit, stock_qty) VALUES ($1, 'cay', 100) RETURNING id`,
        [`${RUN} bút`],
      )
    ).rows[0].id;
    await issue(A, 2, `${RUN} cho A 1`);
    await issue(A, 3, `${RUN} cho A 2`);
    await issue(B, 5, `${RUN} cho B`);
    await issue(null, 7, `${RUN} dùng chung`);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM stock_movements WHERE item_id = $1', [
      itemId,
    ]);
    await pool.query('DELETE FROM items WHERE id = $1', [itemId]);
    await pool.query('DELETE FROM users WHERE sub = ANY($1)', [[A, B]]);
    await app.close();
    await pool.end();
  });

  it('A thấy xuất lẻ của mình (mới nhất trước), không thấy của B và của "Dùng chung"', async () => {
    const res = await mine(A).expect(200);
    const body = res.body as IssuePage;
    expect(body.items.map((i) => i.note)).toEqual([
      `${RUN} cho A 2`,
      `${RUN} cho A 1`,
    ]);
    expect(body.items[0]).toMatchObject({ qty: 3, item_name: `${RUN} bút` });
  });

  it('B chỉ thấy phần của B', async () => {
    const body = (await mine(B).expect(200)).body as IssuePage;
    expect(body.items.map((i) => i.note)).toEqual([`${RUN} cho B`]);
  });

  it('limit đúng bằng số mục → không next_cursor; limit nhỏ hơn 1 → có cursor và trang sau không trùng', async () => {
    const exact = (await mine(A, '?limit=2').expect(200)).body as IssuePage;
    expect(exact.items).toHaveLength(2);
    expect(exact.next_cursor).toBeNull();
    const first = (await mine(A, '?limit=1').expect(200)).body as IssuePage;
    expect(first.items).toHaveLength(1);
    expect(first.next_cursor).not.toBeNull();
    const second = (
      await mine(
        A,
        `?limit=1&cursor=${encodeURIComponent(first.next_cursor!)}`,
      ).expect(200)
    ).body as IssuePage;
    expect(second.items.map((i) => i.note)).toEqual([`${RUN} cho A 1`]);
    expect(second.next_cursor).toBeNull();
  });

  it('limit 0 và 201 → VALIDATION; 200 hợp lệ', async () => {
    for (const bad of ['0', '201']) {
      const res = await mine(A, `?limit=${bad}`).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION', fields: ['limit'] });
    }
    await mine(A, '?limit=200').expect(200);
  });
});
