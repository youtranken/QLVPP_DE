import { ADMIN, LOCKED, RECEIVER, stockFixture } from './stock.fixture';
import type { Movement } from './stock.fixture';

describe('kho: nhập, điều chỉnh, xuất lẻ, sổ cái (Postgres thật)', () => {
  const f = stockFixture();
  const { http, admin, stock, issue, qtyOf, newItem, movements, usageHook } = f;
  let itemId: string;

  beforeAll(async () => {
    itemId = await newItem();
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
    const audit = await f
      .pool()
      .query(
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
    const audit = await f
      .pool()
      .query(
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

  it('purchase sau khi low_stock_notified_at đã set → về NULL', async () => {
    await f
      .pool()
      .query('UPDATE items SET low_stock_notified_at = now() WHERE id = $1', [
        itemId,
      ]);
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
