import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { ClockService } from '../src/common/clock.service';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
// Kỳ quá khứ riêng của suite này — không suite nào khác ghi phiếu vào 2025-06
const YM = '2025-06';
const NOW = '2026-11-05T03:00:00Z';

interface PersonRow {
  request_id: string;
  user_sub: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  user_status: string;
  line_count: number;
  total_qty: number;
  delivered_qty: number;
  custom_pending: number;
  updated_at: string;
}
interface ItemRow {
  key: string;
  item_id: string | null;
  name: string;
  unit: string;
  requested_qty: number;
  people: number;
}

describe('admin/periods/:ym — tổng hợp kỳ cho Hành chính', () => {
  const SUFFIX = `${process.pid}-${Date.now().toString(36)}`;
  const GROUP = `E2E-Sum-${SUFFIX}`;
  const sub = (n: string) => `e2e-sum-${n}-${SUFFIX}`;
  const [U1, U2, U3, LOCKED, OUTSIDER] = [
    'u1',
    'u2',
    'u3',
    'locked',
    'out',
  ].map(sub);
  const ADMIN = sub('admin');
  let app: INestApplication<App>;
  let pool: Pool;
  let savedGroups: unknown;
  let itemId: string;
  let r1: string;
  let r2: string;

  const http = () => request(app.getHttpServer());
  const asAdmin = (path: string, role = 'admin') =>
    http()
      .get(`/api/admin${path}`)
      .set('x-dev-user-sub', ADMIN)
      .set('x-dev-role', role);
  const people = async (query: string) =>
    (await asAdmin(`/periods/${YM}/requests?by=person&${query}`).expect(200))
      .body as { items: PersonRow[]; next_cursor: string | null };

  const addLine = (requestId: string, cols: Record<string, unknown>) => {
    const keys = Object.keys(cols);
    return pool.query(
      `INSERT INTO request_lines (request_id, ${keys.join(', ')})
       VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')})`,
      [requestId, ...Object.values(cols)],
    );
  };

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    savedGroups = (
      await pool.query(
        "SELECT value FROM config WHERE key = 'authorized_groups'",
      )
    ).rows[0]?.value;
    // Gate nhóm chỉ đếm người của suite → headcount không phụ thuộc dữ liệu suite khác
    await pool.query(
      `INSERT INTO config (key, value) VALUES ('authorized_groups', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify([GROUP.toLowerCase()])],
    );
    const inGroup = JSON.stringify(['Khác', GROUP.toUpperCase()]);
    await pool.query(
      `INSERT INTO users (sub, full_name, email, department, status, groups) VALUES
         ($1, 'Bình ' || $6::text, 'binh.' || $6::text || '@pmh.test', 'Phòng B', 'active', $7::jsonb),
         ($2, 'An ' || $6::text, 'an_' || $6::text || '@pmh.test', NULL, 'active', $7::jsonb),
         ($3, 'Chi ' || $6::text, 'chi.' || $6::text || '@pmh.test', 'Phòng A', 'active', $7::jsonb),
         ($4, 'Dũng ' || $6::text, NULL, 'Phòng A', 'locked', $7::jsonb),
         ($5, 'Em ' || $6::text, NULL, 'Phòng A', 'active', '["Khác"]'::jsonb)`,
      [U1, U2, U3, LOCKED, OUTSIDER, SUFFIX, inGroup],
    );
    await pool.query(
      `INSERT INTO periods (ym, deadline) VALUES
         ('2025-06-01', '2025-06-10T17:00:00Z'), ('2026-11-01', '2026-11-10T17:00:00Z')
       ON CONFLICT (ym) DO UPDATE SET deadline = EXCLUDED.deadline, headcount = NULL`,
    );
    itemId = (
      await pool.query<{ id: string }>(
        `INSERT INTO items (name, unit, max_qty) VALUES ($1, 'cay', 5) RETURNING id`,
        [`e2e-sum-item-${SUFFIX}`],
      )
    ).rows[0].id;
    const img = (
      await pool.query<{ id: string }>(
        `INSERT INTO files (original_name, mime, size_bytes, purpose, uploaded_by_sub)
         VALUES ('a.png', 'image/png', 1, 'line_image', $1) RETURNING id`,
        [U1],
      )
    ).rows[0].id;
    const newRequest = async (owner: string, dept: string | null) =>
      (
        await pool.query<{ id: string }>(
          `INSERT INTO requests (period_ym, user_sub, department, created_by_sub)
           VALUES ('2025-06-01', $1, $2, $1) RETURNING id`,
          [owner, dept],
        )
      ).rows[0].id;
    const custom = (name: string, status: string) => ({
      custom_name: name,
      custom_unit: 'cai',
      image_file_id: img,
      review_status: status,
    });
    r1 = await newRequest(U1, 'Phòng B');
    await addLine(r1, { item_id: itemId, qty: 3, delivered_qty: 3 });
    // Hủy nợ hết phần còn lại → không còn chờ giao
    await addLine(r1, {
      ...custom('Bìa còng X', 'accepted'),
      qty: 2,
      cancelled_qty: 2,
    });
    await addLine(r1, { ...custom('Giấy lạ', 'pending'), qty: 1 });
    r2 = await newRequest(U2, null);
    await addLine(r2, { item_id: itemId, qty: 2 });
    await addLine(r2, { ...custom('  bìa CÒNG x ', 'accepted'), qty: 4 });
    await addLine(r2, { ...custom('Rác', 'rejected'), qty: 1 });
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp(
      [],
      [{ token: ClockService, useValue: { now: () => new Date(NOW) } }],
    )) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    const subs = [U1, U2, U3, LOCKED, OUTSIDER];
    await pool.query('DELETE FROM requests WHERE user_sub = ANY($1)', [subs]);
    await pool.query('DELETE FROM files WHERE uploaded_by_sub = $1', [U1]);
    await pool.query('DELETE FROM items WHERE id = $1', [itemId]);
    await pool.query('DELETE FROM users WHERE sub = ANY($1)', [subs]);
    await (savedGroups === undefined
      ? pool.query("DELETE FROM config WHERE key = 'authorized_groups'")
      : pool.query(
          "UPDATE config SET value = $1::jsonb WHERE key = 'authorized_groups'",
          [JSON.stringify(savedGroups)],
        ));
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('summary: registered 2/3 (live: active, cùng group không phân biệt hoa thường), KPI theo dòng hiệu lực', async () => {
    const lowStock = Number(
      (
        await pool.query(
          `SELECT count(*) FROM items WHERE active AND restock_level > 0 AND stock_qty > 0
             AND stock_qty <= floor(restock_level * 0.2)`,
        )
      ).rows[0].count,
    );
    const res = await asAdmin(`/periods/${YM}/summary`).expect(200);
    expect(res.body).toEqual({
      ym: YM,
      deadline: '2025-06-10T17:00:00.000Z',
      is_open: false,
      registered: 2,
      headcount: 3,
      headcount_source: 'live',
      lines_pending_delivery: 2,
      custom_pending: 1,
      low_stock: lowStock,
    });
  });

  it('summary: periods.headcount đã chụp thì dùng snapshot', async () => {
    await pool.query(
      "UPDATE periods SET headcount = 7 WHERE ym = '2025-06-01'",
    );
    try {
      const res = await asAdmin(`/periods/${YM}/summary`).expect(200);
      expect(res.body).toMatchObject({
        headcount: 7,
        headcount_source: 'snapshot',
      });
    } finally {
      await pool.query(
        "UPDATE periods SET headcount = NULL WHERE ym = '2025-06-01'",
      );
    }
  });

  it('summary kỳ quá khứ chưa có dòng periods → 200 rỗng, deadline null', async () => {
    const res = await asAdmin('/periods/2001-01/summary').expect(200);
    expect(res.body).toMatchObject({
      ym: '2001-01',
      deadline: null,
      is_open: false,
      registered: 0,
      lines_pending_delivery: 0,
      custom_pending: 0,
    });
  });

  it('summary kỳ đang mở → is_open true', async () => {
    const res = await asAdmin('/periods/2026-11/summary').expect(200);
    expect(res.body).toMatchObject({ ym: '2026-11', is_open: true });
  });

  it.each([
    ['2026-13', 'tháng sai dạng'],
    ['2026-12', 'kỳ sau kỳ đang mở'],
  ])('ym=%s (%s) → 400 INVALID_PERIOD', async (ym) => {
    for (const path of [
      `/periods/${ym}/summary`,
      `/periods/${ym}/requests`,
      `/periods/${ym}/unregistered`,
    ]) {
      const res = await asAdmin(path).expect(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PERIOD' });
    }
  });

  it('member gọi các endpoint tổng hợp → 403', async () => {
    for (const path of [
      `/periods/${YM}/summary`,
      `/periods/${YM}/requests`,
      `/periods/${YM}/unregistered`,
      `/requests/${r1}`,
    ]) {
      await asAdmin(path, 'member').expect(403);
    }
  });

  it('by=person: sắp theo phòng ban (NULL cuối) rồi tên; số chỉ tính dòng hiệu lực', async () => {
    const page = await people('');
    expect(page.next_cursor).toBeNull();
    expect(page.items).toEqual([
      {
        request_id: r1,
        user_sub: U1,
        full_name: `Bình ${SUFFIX}`,
        email: `binh.${SUFFIX}@pmh.test`,
        department: 'Phòng B',
        user_status: 'active',
        line_count: 3,
        total_qty: 5,
        delivered_qty: 3,
        custom_pending: 1,
        updated_at: expect.any(String) as string,
      },
      expect.objectContaining({
        request_id: r2,
        department: null,
        line_count: 3,
        total_qty: 6,
        delivered_qty: 0,
        custom_pending: 0,
      }),
    ]);
  });

  it('by=person phân trang keyset limit=1 không trùng/sót', async () => {
    const first = await people('limit=1');
    expect(first.items.map((i) => i.request_id)).toEqual([r1]);
    expect(first.next_cursor).toEqual(expect.any(String));
    const second = await people(
      `limit=1&cursor=${encodeURIComponent(first.next_cursor!)}`,
    );
    expect(second.items.map((i) => i.request_id)).toEqual([r2]);
    expect(second.next_cursor).toBeNull();
  });

  it('by=person cursor hỏng → 400 VALIDATION', async () => {
    const res = await asAdmin(
      `/periods/${YM}/requests?by=person&cursor=xyz`,
    ).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION' });
  });

  it('filter=custom_pending chỉ phiếu có dòng chờ xem; pending_delivery bỏ dòng pending/rejected/đã hủy nợ', async () => {
    const pending = await people('filter=custom_pending');
    expect(pending.items.map((i) => i.request_id)).toEqual([r1]);
    const delivery = await people('filter=pending_delivery');
    expect(delivery.items.map((i) => i.request_id)).toEqual([r2]);
    await asAdmin(`/periods/${YM}/requests?filter=bogus`).expect(400);
  });

  it('q tìm theo tên/email; ký tự % _ là chữ thường (escapeLike)', async () => {
    expect(
      (await people(`q=${encodeURIComponent(`an_${SUFFIX}@`)}`)).items.map(
        (i) => i.request_id,
      ),
    ).toEqual([r2]);
    expect((await people('q=BINH.')).items.map((i) => i.request_id)).toEqual([
      r1,
    ]);
    expect((await people('q=%25')).items).toEqual([]);
  });

  it('by=item: gộp món theo item_id, dòng ngoài DM theo tên trim/không phân biệt hoa thường + ĐVT', async () => {
    const res = await asAdmin(`/periods/${YM}/requests?by=item`).expect(200);
    const items = (res.body as { items: ItemRow[] }).items;
    expect(items).toHaveLength(2);
    expect(items).toEqual(
      expect.arrayContaining([
        {
          key: itemId,
          item_id: itemId,
          name: `e2e-sum-item-${SUFFIX}`,
          unit: 'cay',
          requested_qty: 5,
          people: 2,
        },
        {
          key: expect.any(String) as string,
          item_id: null,
          name: expect.stringMatching(/^bìa còng x$/i) as string,
          unit: 'cai',
          requested_qty: 6,
          people: 2,
        },
      ]),
    );
  });

  it('unregistered = người trong headcount chưa có phiếu (bỏ locked, ngoài group)', async () => {
    const res = await asAdmin(`/periods/${YM}/unregistered`).expect(200);
    expect(res.body).toEqual({
      items: [
        {
          sub: U3,
          full_name: `Chi ${SUFFIX}`,
          email: `chi.${SUFFIX}@pmh.test`,
          department: 'Phòng A',
        },
      ],
    });
  });

  it('admin/requests/:id → RequestView + user_status; không có → 404 REQUEST_NOT_FOUND', async () => {
    await pool.query("UPDATE users SET status = 'locked' WHERE sub = $1", [U2]);
    try {
      const res = await asAdmin(`/requests/${r2}`).expect(200);
      expect(res.body).toMatchObject({
        id: r2,
        period_ym: YM,
        user_sub: U2,
        is_open: false,
        user_status: 'locked',
      });
      expect((res.body as { lines: unknown[] }).lines).toHaveLength(3);
    } finally {
      await pool.query("UPDATE users SET status = 'active' WHERE sub = $1", [
        U2,
      ]);
    }
    const missing = await asAdmin(
      '/requests/00000000-0000-4000-8000-000000000000',
    ).expect(404);
    expect(missing.body).toMatchObject({ code: 'REQUEST_NOT_FOUND' });
    await asAdmin('/requests/not-a-uuid').expect(400);
  });
});
