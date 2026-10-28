import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { ITEM_USAGE_HOOK } from '../src/modules/catalog/item-usage.hook';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const ADMIN = 'db-stock-admin';
const RECEIVER = 'db-stock-receiver';
const LOCKED = 'db-stock-locked';

interface Movement {
  id: string;
  delta: number;
  reason: string;
  note: string | null;
  actor_sub: string;
  recipient_sub: string | null;
}

describe('kho: nhập, điều chỉnh, xuất lẻ, sổ cái (Postgres thật)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let itemId: string;
  const usageHook = { isUsed: jest.fn().mockResolvedValue(false) };

  const http = () => request(app.getHttpServer());
  const admin = (req: request.Test) =>
    req.set('x-dev-user-sub', ADMIN).set('x-dev-role', 'admin');
  const stock = (id: string, body: object) =>
    admin(http().post(`/api/admin/items/${id}/stock`)).send(body);
  const issue = (id: string, body: object) =>
    admin(http().post(`/api/admin/items/${id}/issue`)).send(body);
  const qtyOf = async (id: string) =>
    (
      await pool.query<{ stock_qty: number; low: Date | null }>(
        'SELECT stock_qty, low_stock_notified_at AS low FROM items WHERE id = $1',
        [id],
      )
    ).rows[0];
  const newItem = async (stockQty = 0) =>
    (
      await pool.query<{ id: string }>(
        "INSERT INTO items (name, unit, stock_qty) VALUES ('Giấy A4 db', 'ram', $1) RETURNING id",
        [stockQty],
      )
    ).rows[0].id;
  const movements = async (id: string) =>
    (await admin(http().get(`/api/admin/items/${id}/movements`)).expect(200))
      .body as { items: Movement[]; next_cursor: string | null };

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.query(
      `INSERT INTO users (sub, full_name, status) VALUES
         ($1, 'Người nhận', 'active'), ($2, 'Đã khóa', 'locked')
       ON CONFLICT (sub) DO UPDATE SET status = EXCLUDED.status`,
      [RECEIVER, LOCKED],
    );
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp(
      [],
      [{ token: ITEM_USAGE_HOOK, useValue: usageHook }],
    )) as INestApplication<App>;
    itemId = await newItem();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('purchase +100 → stock_qty=100, movement purchase; audit stock.purchase before 0 after 100', async () => {
    const res = await stock(itemId, {
      delta: 100,
      reason: 'purchase',
      note: 'ĐH 12',
    }).expect(201);
    expect(res.body).toMatchObject({ stock_qty: 100 });
    expect((await qtyOf(itemId)).stock_qty).toBe(100);
    expect((await movements(itemId)).items[0]).toMatchObject({
      delta: 100,
      reason: 'purchase',
      note: 'ĐH 12',
      actor_sub: ADMIN,
    });
    const audit = await pool.query(
      "SELECT detail FROM audit_log WHERE action = 'stock.purchase' AND object_id = $1",
      [itemId],
    );
    expect(audit.rows[0].detail).toMatchObject({
      before: { stock_qty: 0 },
      after: { stock_qty: 100 },
    });
  });

  it('adjust không note → 400 REASON_REQUIRED; reason=issue/delivery → 400 VALIDATION; purchase âm → 400 VALIDATION', async () => {
    for (const body of [
      { delta: -1, reason: 'adjust' },
      { delta: -1, reason: 'adjust', note: '   ' },
    ]) {
      const res = await stock(itemId, body).expect(400);
      expect(res.body).toMatchObject({ code: 'REASON_REQUIRED' });
    }
    for (const body of [
      { delta: -1, reason: 'issue', note: 'x' },
      { delta: -1, reason: 'delivery', note: 'x' },
      { delta: -1, reason: 'purchase', note: 'x' },
      { delta: 0, reason: 'adjust', note: 'x' },
    ]) {
      const res = await stock(itemId, body).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION' });
    }
    expect((await qtyOf(itemId)).stock_qty).toBe(100);
  });

  it('adjust âm quá tồn → 409 STOCK_INSUFFICIENT {available: 100}', async () => {
    const res = await stock(itemId, {
      delta: -101,
      reason: 'adjust',
      note: 'kiểm kê',
    }).expect(409);
    expect(res.body).toMatchObject({
      code: 'STOCK_INSUFFICIENT',
      available: 100,
    });
  });

  it('issue 3 cho user active → tồn 97, movement issue có recipient_sub; người nhận thấy ở me/issues', async () => {
    const res = await issue(itemId, {
      qty: 3,
      recipient_sub: RECEIVER,
      reason: 'Người mới',
    }).expect(201);
    expect(res.body).toMatchObject({ stock_qty: 97 });
    expect((await movements(itemId)).items[0]).toMatchObject({
      delta: -3,
      reason: 'issue',
      note: 'Người mới',
      recipient_sub: RECEIVER,
    });
    const mine = await http()
      .get('/api/me/issues')
      .set('x-dev-user-sub', RECEIVER)
      .set('x-dev-role', 'member')
      .expect(200);
    expect(
      (mine.body as { items: Array<Record<string, unknown>> }).items[0],
    ).toMatchObject({ item_id: itemId, qty: 3, note: 'Người mới' });
    const audit = await pool.query(
      "SELECT detail FROM audit_log WHERE action = 'stock.issue' AND object_id = $1",
      [itemId],
    );
    expect(audit.rows[0].detail).toMatchObject({
      before: { stock_qty: 100 },
      after: { stock_qty: 97 },
      recipient_sub: RECEIVER,
    });
  });

  it('issue thiếu reason → 400 REASON_REQUIRED; người nhận locked → 409 USER_INACTIVE; sub lạ → 404 USER_NOT_FOUND', async () => {
    const noReason = await issue(itemId, { qty: 1 }).expect(400);
    expect(noReason.body).toMatchObject({ code: 'REASON_REQUIRED' });
    const locked = await issue(itemId, {
      qty: 1,
      recipient_sub: LOCKED,
      reason: 'x',
    }).expect(409);
    expect(locked.body).toMatchObject({ code: 'USER_INACTIVE' });
    const unknown = await issue(itemId, {
      qty: 1,
      recipient_sub: 'khong-ton-tai',
      reason: 'x',
    }).expect(404);
    expect(unknown.body).toMatchObject({ code: 'USER_NOT_FOUND' });
    expect((await qtyOf(itemId)).stock_qty).toBe(97);
  });

  it('issue 200 → 409 STOCK_INSUFFICIENT {available: 97}; không recipient = dùng chung', async () => {
    const res = await issue(itemId, { qty: 200, reason: 'A4 chung' }).expect(
      409,
    );
    expect(res.body).toMatchObject({
      code: 'STOCK_INSUFFICIENT',
      available: 97,
    });
  });

  it('tồn 1 + hai issue 1 song song → một 201, một 409 STOCK_INSUFFICIENT, tồn 0', async () => {
    const one = await newItem(1);
    const results = await Promise.all([
      issue(one, { qty: 1, reason: 'song song 1' }),
      issue(one, { qty: 1, reason: 'song song 2' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const failed = results.find((r) => r.status === 409)!;
    expect(failed.body).toMatchObject({
      code: 'STOCK_INSUFFICIENT',
      available: 0,
    });
    expect((await qtyOf(one)).stock_qty).toBe(0);
    expect((await movements(one)).items).toHaveLength(1);
  });

  it('sắp hết = đã dùng 80 % tồn sau lần nhập gần nhất; adjust không đổi mốc', async () => {
    const low = async () =>
      (
        (await admin(http().get('/api/admin/stock/low')).expect(200))
          .body as Array<{ id: string }>
      ).map((i) => i.id);
    const row = async (id: string) =>
      (
        (await admin(http().get('/api/admin/items')).expect(200))
          .body as Array<{
          id: string;
          stock_qty: number;
          restock_level: number | null;
          stock_state: string;
        }>
      ).find((i) => i.id === id)!;
    const issueTo = async (id: string, target: number) => {
      const qty = (await qtyOf(id)).stock_qty - target;
      await issue(id, { qty, reason: 'dùng' }).expect(201);
    };
    const id = await newItem();
    expect(await row(id)).toMatchObject({
      restock_level: null,
      stock_state: 'untracked',
    });
    expect(await low()).not.toContain(id);

    await stock(id, { delta: 30, reason: 'purchase' }).expect(201);
    expect(await row(id)).toMatchObject({
      restock_level: 30,
      stock_state: 'ok',
    });
    await issueTo(id, 7);
    expect(await low()).not.toContain(id);
    await issueTo(id, 6);
    expect(await low()).toContain(id);
    expect((await row(id)).stock_state).toBe('low');

    await stock(id, { delta: 20, reason: 'purchase' }).expect(201);
    expect(await row(id)).toMatchObject({
      stock_qty: 26,
      restock_level: 26,
      stock_state: 'ok',
    });
    expect(await low()).not.toContain(id);
    await issueTo(id, 5);
    expect(await low()).toContain(id);

    await stock(id, { delta: 10, reason: 'adjust', note: 'kiểm kê' }).expect(
      201,
    );
    expect((await row(id)).restock_level).toBe(26);
    await stock(id, { delta: -5, reason: 'adjust', note: 'kiểm kê' }).expect(
      201,
    );
    expect((await row(id)).restock_level).toBe(26);

    await issueTo(id, 0);
    expect(await row(id)).toMatchObject({ stock_qty: 0, stock_state: 'out' });
    expect(await low()).not.toContain(id);

    await stock(id, { delta: 30, reason: 'purchase' }).expect(201);
    await issueTo(id, 6);
    expect(await low()).toContain(id);
    await pool.query('UPDATE items SET active = false WHERE id = $1', [id]);
    expect(await low()).not.toContain(id);
  });

  it('tồn đầu kỳ qua adjust: đặt mốc khi chưa có; giữ mốc đã có; adjust âm không đặt mốc', async () => {
    const level = async (id: string) =>
      (
        await pool.query<{ restock_level: number | null }>(
          'SELECT restock_level FROM items WHERE id = $1',
          [id],
        )
      ).rows[0].restock_level;
    const id = await newItem();
    await stock(id, { delta: 10, reason: 'adjust', note: 'tồn đầu' }).expect(
      201,
    );
    expect(await level(id)).toBe(10);
    await stock(id, { delta: -3, reason: 'adjust', note: 'kiểm kê' }).expect(
      201,
    );
    expect(await level(id)).toBe(10);
    await stock(id, { delta: 5, reason: 'purchase' }).expect(201);
    expect(await level(id)).toBe(12);

    const stocked = await newItem(50);
    await stock(stocked, {
      delta: -20,
      reason: 'adjust',
      note: 'hao hụt',
    }).expect(201);
    expect(await level(stocked)).toBeNull();
  });

  it('purchase sau khi low_stock_notified_at đã set → về NULL', async () => {
    await pool.query(
      'UPDATE items SET low_stock_notified_at = now() WHERE id = $1',
      [itemId],
    );
    await stock(itemId, { delta: 5, reason: 'purchase' }).expect(201);
    expect(await qtyOf(itemId)).toEqual({ stock_qty: 102, low: null });
  });

  it('sổ cái phân trang mới nhất trước: limit=2 → next_cursor, trang sau nối tiếp không trùng', async () => {
    const page1 = await admin(
      http().get(`/api/admin/items/${itemId}/movements?limit=2`),
    ).expect(200);
    const body1 = page1.body as { items: Movement[]; next_cursor: string };
    expect(body1.items.map((m) => m.reason)).toEqual(['purchase', 'issue']);
    const page2 = await admin(
      http().get(
        `/api/admin/items/${itemId}/movements?limit=2&cursor=${body1.next_cursor}`,
      ),
    ).expect(200);
    const body2 = page2.body as { items: Movement[]; next_cursor: null };
    expect(body2.items.map((m) => m.reason)).toEqual(['purchase']);
    expect(body2.next_cursor).toBeNull();
  });

  it('admin/issues?ym=tháng này có đợt xuất lẻ; ym sai dạng/thiếu → 400 INVALID_PERIOD', async () => {
    const ym = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
    }).format(new Date());
    const res = await admin(http().get(`/api/admin/issues?ym=${ym}`)).expect(
      200,
    );
    expect(
      (res.body as Array<Record<string, unknown>>).find(
        (r) => r.item_id === itemId,
      ),
    ).toMatchObject({
      qty: 3,
      recipient_sub: RECEIVER,
      recipient_name: 'Người nhận',
    });
    for (const q of ['?ym=2026-13', '?ym=2026-1', '?ym=abc', '?ym=', '']) {
      const bad = await admin(http().get(`/api/admin/issues${q}`)).expect(400);
      expect(bad.body).toMatchObject({ code: 'INVALID_PERIOD' });
    }
  });

  it('DELETE món đã có sổ cái → 409 ITEM_IN_USE; hook báo đã dùng → 409 ITEM_IN_USE', async () => {
    const res = await admin(http().delete(`/api/admin/items/${itemId}`)).expect(
      409,
    );
    expect(res.body).toMatchObject({ code: 'ITEM_IN_USE' });
    const fresh = await newItem();
    usageHook.isUsed.mockResolvedValueOnce(true);
    const hooked = await admin(
      http().delete(`/api/admin/items/${fresh}`),
    ).expect(409);
    expect(hooked.body).toMatchObject({ code: 'ITEM_IN_USE' });
    expect(usageHook.isUsed).toHaveBeenCalledWith(fresh, expect.anything());
  });

  it('member gọi stock/issue → 403', async () => {
    await http()
      .post(`/api/admin/items/${itemId}/issue`)
      .set('x-dev-user-sub', RECEIVER)
      .set('x-dev-role', 'member')
      .send({ qty: 1, reason: 'x' })
      .expect(403);
  });
});
