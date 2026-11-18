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
// Tháng riêng của suite — không suite nào khác ghi sổ kho vào 2023-06
const YM = '2023-06';

type Row = {
  id: string;
  reason: string;
  delta: number;
  item_name: string;
  actor_name: string | null;
  recipient_name: string | null;
};
type Body = {
  items: Row[];
  next_cursor: string | null;
  totals: { in: number; out: number };
};

describe('GET admin/stock/movements?ym=&kind= — sổ cái toàn kho (G5)', () => {
  const SUFFIX = `${process.pid}-${Date.now().toString(36)}`;
  const ADMIN = `e2e-ledger-admin-${SUFFIX}`;
  const TAKER = `e2e-ledger-taker-${SUFFIX}`;
  let app: INestApplication<App>;
  let pool: Pool;
  let itemId = '';
  const ids: string[] = [];
  const get = (q: string, role = 'admin') =>
    request(app.getHttpServer())
      .get(`/api/admin/stock/movements?${q}`)
      .set('x-dev-user-sub', ADMIN)
      .set('x-dev-role', role);

  const move = async (
    delta: number,
    reason: string,
    at: string,
    note: string | null = null,
    recipient: string | null = null,
  ) =>
    ids.push(
      (
        await pool.query<{ id: string }>(
          `INSERT INTO stock_movements (item_id, delta, reason, note, recipient_sub, actor_sub, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [itemId, delta, reason, note, recipient, ADMIN, at],
        )
      ).rows[0].id,
    );

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.query(
      `INSERT INTO users (sub, full_name, status, role) VALUES ($1, 'Người xuất', 'active', 'admin'), ($2, 'Người nhận', 'active', 'member')`,
      [ADMIN, TAKER],
    );
    itemId = (
      await pool.query<{ id: string }>(
        `INSERT INTO items (name, unit) VALUES ($1, 'cai') RETURNING id`,
        [`e2e-ledger-${SUFFIX}`],
      )
    ).rows[0].id;
    // 00:00 ngày 1/6 giờ VN = 17:00Z 31/5: thuộc tháng 6; 23:59 ngày 31/5 giờ VN thì không
    await move(50, 'purchase', '2023-05-31T17:00:00Z');
    await move(12, 'purchase', '2023-06-10T03:00:00Z');
    await move(-15, 'issue', '2023-06-12T03:00:00Z', 'xuất phòng họp', TAKER);
    await move(-25, 'issue', '2023-06-30T16:59:59Z', 'xuất lẻ', TAKER);
    await move(7, 'purchase', '2023-05-31T16:59:59Z');
    await move(9, 'purchase', '2023-06-30T17:00:00Z');
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    await pool.query('DELETE FROM stock_movements WHERE id = ANY($1::uuid[])', [
      ids,
    ]);
    await pool.query('DELETE FROM items WHERE id = $1', [itemId]);
    await pool.query('DELETE FROM users WHERE sub = ANY($1)', [[ADMIN, TAKER]]);
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('ym=2023-06: đúng 4 dòng của tháng theo giờ VN (biên 00:00 ngày 1 và 23:59:59 ngày cuối), mới nhất trước, tổng Nhập +62 · Ra −40', async () => {
    const body = (await get(`ym=${YM}`).expect(200)).body as Body;
    expect(body.items.map((r) => r.delta)).toEqual([-25, -15, 12, 50]);
    expect(body.totals).toEqual({ in: 62, out: -40 });
    expect(body.items[0]).toMatchObject({
      reason: 'issue',
      item_name: `e2e-ledger-${SUFFIX}`,
      actor_name: 'Người xuất',
      recipient_name: 'Người nhận',
    });
  });

  it('AD-40: xuất lẻ bằng SA local (sub không có trong users) → actor_name = sub, không null', async () => {
    const sa = `sa:e2e-ledger-${SUFFIX}`;
    const id = (
      await pool.query<{ id: string }>(
        `INSERT INTO stock_movements (item_id, delta, reason, note, actor_sub, created_at)
         VALUES ($1, -1, 'issue', 'sa xuất', $2, '2023-06-20T03:00:00Z') RETURNING id`,
        [itemId, sa],
      )
    ).rows[0].id;
    try {
      const body = (await get(`ym=${YM}&kind=issue`).expect(200)).body as Body;
      expect(body.items.find((r) => r.id === id)?.actor_name).toBe(sa);
      expect(body.items.find((r) => r.id !== id)?.actor_name).toBe('Người xuất');
    } finally {
      await pool.query('DELETE FROM stock_movements WHERE id = $1', [id]);
    }
  });

  it('kind=issue → chỉ xuất lẻ, tổng chỉ tính phần lọc', async () => {
    const body = (await get(`ym=${YM}&kind=issue`).expect(200)).body as Body;
    expect(body.items.map((r) => r.reason)).toEqual(['issue', 'issue']);
    expect(body.totals).toEqual({ in: 0, out: -40 });
  });

  it('phân trang limit=3 → trang sau còn 1 dòng, không trùng', async () => {
    const first = (await get(`ym=${YM}&limit=3`).expect(200)).body as Body;
    expect(first.items).toHaveLength(3);
    const second = (
      await get(
        `ym=${YM}&limit=3&cursor=${encodeURIComponent(first.next_cursor!)}`,
      ).expect(200)
    ).body as Body;
    expect(second.items.map((r) => r.delta)).toEqual([50]);
    expect(second.next_cursor).toBeNull();
  });

  it('member → 403 FORBIDDEN_ROLE', async () => {
    const res = await get(`ym=${YM}`, 'member').expect(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('thiếu/sai ym, kind lạ → 400 VALIDATION', async () => {
    for (const q of ['', 'ym=2023-13', 'ym=2023-6', `ym=${YM}&kind=steal`]) {
      const res = await get(q).expect(400);
      expect(res.body.code).toBe('VALIDATION');
    }
  });
});
