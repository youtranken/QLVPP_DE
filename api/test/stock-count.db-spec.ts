import { randomUUID } from 'node:crypto';
import { ADMIN, RECEIVER, stockFixture } from './stock.fixture';

describe('kiểm kê: POST admin/items/:id/stock/count (Postgres thật)', () => {
  const f = stockFixture();
  const { http, admin, stock, qtyOf, newItem, movements, itemRow } = f;
  const count = (id: string, body: object) =>
    admin(http().post(`/api/admin/items/${id}/stock/count`)).send(body);
  const auditsOf = async (id: string) =>
    (
      await f
        .pool()
        .query<{ detail: Record<string, unknown> }>(
          "SELECT detail FROM audit_log WHERE action = 'stock.adjust' AND object_id = $1 ORDER BY id",
          [id],
        )
    ).rows.map((r) => r.detail);

  it('tồn 3, đếm 5 → 201 tồn 5; sổ cái adjust +2 lý do đã trim; audit stock.adjust before 3 after 5', async () => {
    const id = await newItem(3);
    const res = await count(id, {
      counted_qty: 5,
      expected_stock_qty: 3,
      note: '  đếm kho  ',
    }).expect(201);
    expect(res.body).toMatchObject({ stock_qty: 5 });
    expect((await movements(id)).items[0]).toMatchObject({
      delta: 2,
      reason: 'adjust',
      note: 'đếm kho',
      actor_sub: ADMIN,
    });
    expect(await auditsOf(id)).toEqual([
      expect.objectContaining({
        before: { stock_qty: 3 },
        after: { stock_qty: 5 },
        delta: 2,
      }),
    ]);
  });

  it('biên counted: 0 → 201 tồn 0; −1 → 400 VALIDATION {fields:[counted_qty]}', async () => {
    const id = await newItem(4);
    const neg = await count(id, {
      counted_qty: -1,
      expected_stock_qty: 4,
      note: 'đếm kho',
    }).expect(400);
    expect(neg.body).toMatchObject({
      code: 'VALIDATION',
      fields: ['counted_qty'],
    });
    await count(id, {
      counted_qty: 0,
      expected_stock_qty: 4,
      note: 'đếm kho',
    }).expect(201);
    expect((await qtyOf(id)).stock_qty).toBe(0);
  });

  it('biên counted: 1 000 000 → 201; 1 000 001 → 400 VALIDATION', async () => {
    const id = await newItem(0);
    const over = await count(id, {
      counted_qty: 1_000_001,
      expected_stock_qty: 0,
      note: 'đếm kho',
    }).expect(400);
    expect(over.body).toMatchObject({ code: 'VALIDATION' });
    await count(id, {
      counted_qty: 1_000_000,
      expected_stock_qty: 0,
      note: 'đếm kho',
    }).expect(201);
    expect((await qtyOf(id)).stock_qty).toBe(1_000_000);
  });

  it('expected lệch 1 (tồn 3, gửi 2 hoặc 4) → 409 STALE_UPDATE {stock_qty: 3}, không ghi sổ', async () => {
    const id = await newItem(3);
    for (const expected of [2, 4]) {
      const res = await count(id, {
        counted_qty: 7,
        expected_stock_qty: expected,
        note: 'đếm kho',
      }).expect(409);
      expect(res.body).toMatchObject({ code: 'STALE_UPDATE', stock_qty: 3 });
    }
    expect((await qtyOf(id)).stock_qty).toBe(3);
    expect((await movements(id)).items).toEqual([]);
  });

  it('đếm bằng đúng tồn → 400 VALIDATION, không sổ cái, không audit', async () => {
    const id = await newItem(3);
    const res = await count(id, {
      counted_qty: 3,
      expected_stock_qty: 3,
      note: 'đếm kho',
    }).expect(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION',
      fields: ['counted_qty'],
    });
    expect((await movements(id)).items).toEqual([]);
    expect(await auditsOf(id)).toEqual([]);
  });

  it('lý do trim 2 ký tự/thiếu → 400 REASON_REQUIRED; trim 3 ký tự → 201', async () => {
    const id = await newItem(3);
    for (const note of [undefined, '  ab  ']) {
      const res = await count(id, {
        counted_qty: 5,
        expected_stock_qty: 3,
        note,
      }).expect(400);
      expect(res.body).toMatchObject({ code: 'REASON_REQUIRED' });
    }
    await count(id, {
      counted_qty: 5,
      expected_stock_qty: 3,
      note: ' abc ',
    }).expect(201);
  });

  it('mốc restock_level như adjust: món chưa có mốc đếm 0→6 đặt mốc 6; món có mốc 100 đếm lên không đổi mốc', async () => {
    const fresh = await newItem(0);
    await count(fresh, {
      counted_qty: 6,
      expected_stock_qty: 0,
      note: 'tồn đầu kỳ',
    }).expect(201);
    expect(await itemRow(fresh)).toMatchObject({ restock_level: 6 });
    const tracked = await newItem(0);
    await stock(tracked, { delta: 100, reason: 'purchase' }).expect(201);
    await count(tracked, {
      counted_qty: 120,
      expected_stock_qty: 100,
      note: 'đếm dư',
    }).expect(201);
    expect(await itemRow(tracked)).toMatchObject({
      stock_qty: 120,
      restock_level: 100,
    });
  });

  it('món không có → 404 ITEM_NOT_FOUND; member → 403', async () => {
    const body = { counted_qty: 1, expected_stock_qty: 0, note: 'đếm kho' };
    const missing = await count(randomUUID(), body).expect(404);
    expect(missing.body).toMatchObject({ code: 'ITEM_NOT_FOUND' });
    await http()
      .post(`/api/admin/items/${await newItem(0)}/stock/count`)
      .set('x-dev-user-sub', RECEIVER)
      .set('x-dev-role', 'member')
      .send(body)
      .expect(403);
  });

  it('hai lần kiểm kê song song cùng expected → một 201, một 409 STALE_UPDATE; một dòng sổ cái', async () => {
    const id = await newItem(3);
    const results = await Promise.all(
      [5, 8].map((counted_qty) =>
        count(id, { counted_qty, expected_stock_qty: 3, note: 'đếm kho' }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const lost = results.find((r) => r.status === 409)!;
    const won = results.find((r) => r.status === 201)!;
    expect(lost.body).toMatchObject({
      code: 'STALE_UPDATE',
      stock_qty: won.body.stock_qty,
    });
    expect((await movements(id)).items).toHaveLength(1);
  });
});
