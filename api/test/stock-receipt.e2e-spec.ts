import { randomUUID } from 'node:crypto';
import { markSent } from './sent-snapshot.helper';
import { ADMIN, stockFixture } from './stock.fixture';

describe('POST admin/stock/receipts: vai, validate, mã lỗi (Postgres thật)', () => {
  const f = stockFixture();
  const { http, admin, qtyOf, newItem, movements } = f;
  // Kỳ quá khứ (đã khóa) riêng của suite
  const YM = '2024-05';
  const receipts = (body: object) =>
    admin(http().post('/api/admin/stock/receipts')).send(body);
  const line = (item_id: string, qty = 1, expected_stock_qty = 0) => ({
    item_id,
    qty,
    expected_stock_qty,
  });
  beforeAll(async () => {
    for (const ym of [YM, '2025-12']) await markSent(f.pool(), ym);
  });
  const auditsOf = async (action: string, ids: string[]) =>
    (
      await f
        .pool()
        .query<{ object_id: string; detail: Record<string, unknown> }>(
          'SELECT object_id, detail FROM audit_log WHERE action = $1 AND object_id = ANY($2) ORDER BY id',
          [action, ids],
        )
    ).rows;

  it('nhập 2 món → 200, cộng tồn cả hai, 2 movement purchase, audit stock.purchase ×2 + stock.receipt có before/after', async () => {
    const a = await newItem(3);
    const b = await newItem(0);
    const res = await receipts({
      lines: [line(a, 5, 3), line(b, 2, 0)],
      ym: YM,
      note: '  đợt 1  ',
    }).expect(200);
    expect(res.body.items).toEqual([
      { item_id: a, stock_qty: 8, movement_id: expect.any(String) },
      { item_id: b, stock_qty: 2, movement_id: expect.any(String) },
    ]);
    expect((await qtyOf(a)).stock_qty).toBe(8);
    expect((await qtyOf(b)).stock_qty).toBe(2);
    expect((await movements(a)).items[0]).toMatchObject({
      delta: 5,
      reason: 'purchase',
      note: `Về bù kỳ ${YM} · đợt 1`,
      receipt_ym: YM,
      actor_sub: ADMIN,
    });
    expect((await movements(b)).items[0].note).toBe(`Về bù kỳ ${YM} · đợt 1`);
    const purchases = await auditsOf('stock.purchase', [a, b]);
    expect(purchases.map((p) => p.object_id).sort()).toEqual([a, b].sort());
    expect(purchases.find((p) => p.object_id === a)!.detail).toMatchObject({
      before: { stock_qty: 3 },
      after: { stock_qty: 8 },
      delta: 5,
    });
    const [summary] = (
      await f
        .pool()
        .query<{ detail: Record<string, unknown> }>(
          "SELECT detail FROM audit_log WHERE action = 'stock.receipt' AND object_type = 'period' AND object_id = $1 AND detail->'lines' @> $2::jsonb ORDER BY id DESC LIMIT 1",
          [YM, JSON.stringify([{ item_id: a, qty: 5 }])],
        )
    ).rows;
    expect(summary.detail).toEqual({
      lines: [
        { item_id: a, qty: 5, name: expect.any(String), name_en: null },
        { item_id: b, qty: 2, name: expect.any(String), name_en: null },
      ],
      note: 'đợt 1',
    });
  });

  it('kỳ trước kỳ làm việc, không có ghi chú: note movement chỉ là "Về bù kỳ {ym}"', async () => {
    const a = await newItem(0);
    await receipts({ lines: [line(a)], ym: YM }).expect(200);
    expect((await movements(a)).items[0].note).toBe(`Về bù kỳ ${YM}`);
  });

  it('nhập đặt lại mốc restock_level và xóa low_stock_notified_at như purchase', async () => {
    const a = await newItem(1);
    await f
      .pool()
      .query(
        'UPDATE items SET restock_level = 10, low_stock_notified_at = now() WHERE id = $1',
        [a],
      );
    await receipts({ lines: [line(a, 4, 1)], ym: YM }).expect(200);
    const row = (
      await f
        .pool()
        .query<{ restock_level: number; low: Date | null }>(
          'SELECT restock_level, low_stock_notified_at AS low FROM items WHERE id = $1',
          [a],
        )
    ).rows[0];
    expect(row).toEqual({ restock_level: 5, low: null });
  });

  describe('biên hai phía', () => {
    let item: string;
    beforeAll(async () => {
      item = await newItem(0);
    });
    const one = (qty: number) =>
      receipts({ lines: [line(item, qty, 0)], ym: YM });

    it('qty 1 → 200', async () => {
      await one(1).expect(200);
      await f
        .pool()
        .query('UPDATE items SET stock_qty = 0 WHERE id = $1', [item]);
    });
    it('qty 0 → 400', async () => {
      await one(0).expect(400);
    });
    it('qty 99999 → 200', async () => {
      await one(99_999).expect(200);
      await f
        .pool()
        .query('UPDATE items SET stock_qty = 0 WHERE id = $1', [item]);
    });
    it('qty 100000 → 400', async () => {
      const res = await one(100_000).expect(400);
      expect(res.body.code).toBe('VALIDATION');
    });
    it('ym 2026-13 (tháng 13) → 400, 2025-12 (đã khóa) → 200', async () => {
      await receipts({ lines: [line(item, 1, 0)], ym: '2026-13' }).expect(400);
      await receipts({ lines: [line(item, 1, 0)], ym: '2026-00' }).expect(400);
      await receipts({ lines: [line(item, 1, 0)], ym: '2025-12' }).expect(200);
    });
    it('expected_stock_qty -1 → 400', async () => {
      await receipts({ lines: [line(item, 1, -1)], ym: YM }).expect(400);
    });

    const many = async (n: number) => {
      const { rows } = await f
        .pool()
        .query<{ id: string }>(
          "INSERT INTO items (name, unit, stock_qty) SELECT 'Biên db ' || g, 'cai', 0 FROM generate_series(1, $1) g RETURNING id",
          [n],
        );
      return rows.map((r) => line(r.id));
    };
    it('200 dòng → 200', async () => {
      const res = await receipts({ lines: await many(200), ym: YM }).expect(
        200,
      );
      expect(res.body.items).toHaveLength(200);
    });
    it('201 dòng → 400', async () => {
      await receipts({ lines: await many(201), ym: YM }).expect(400);
    });
    it('0 dòng → 400', async () => {
      await receipts({ lines: [], ym: YM }).expect(400);
    });

    it('note 500 ký tự → 200', async () => {
      const a = await newItem(0);
      await receipts({
        lines: [line(a)],
        ym: YM,
        note: 'n'.repeat(500),
      }).expect(200);
    });
    it('note 501 ký tự → 400', async () => {
      const a = await newItem(0);
      await receipts({
        lines: [line(a)],
        ym: YM,
        note: 'n'.repeat(501),
      }).expect(400);
    });
  });

  it('item_id trùng → 400 VALIDATION fields.lines', async () => {
    const a = await newItem(0);
    const res = await receipts({
      lines: [line(a), line(a, 2)],
      ym: YM,
    }).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION', fields: ['lines'] });
    expect((await qtyOf(a)).stock_qty).toBe(0);
  });

  it('cùng uuid khác hoa thường → 400 VALIDATION fields.lines', async () => {
    const a = await newItem(0);
    const res = await receipts({
      lines: [line(a.toLowerCase()), line(a.toUpperCase(), 2)],
      ym: YM,
    }).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION', fields: ['lines'] });
  });

  it('món không tồn tại → 404 ITEM_NOT_FOUND kèm item_id, không món nào được cộng', async () => {
    const a = await newItem(0);
    const ghost = randomUUID();
    const res = await receipts({
      lines: [line(a), line(ghost)],
      ym: YM,
    }).expect(404);
    expect(res.body).toMatchObject({ code: 'ITEM_NOT_FOUND', item_id: ghost });
    expect((await qtyOf(a)).stock_qty).toBe(0);
  });

  it('món ngừng dùng → 404 ITEM_NOT_FOUND', async () => {
    const a = await newItem(0);
    await f.pool().query('UPDATE items SET active = false WHERE id = $1', [a]);
    const res = await receipts({ lines: [line(a)], ym: YM }).expect(404);
    expect(res.body).toMatchObject({ code: 'ITEM_NOT_FOUND', item_id: a });
  });

  it('member → 403', async () => {
    const a = await newItem(0);
    await http()
      .post('/api/admin/stock/receipts')
      .set('x-dev-user-sub', 'db-stock-member')
      .set('x-dev-role', 'member')
      .send({ lines: [line(a)], ym: YM })
      .expect(403);
  });

  it.each(['2031-5', '2031-05-01', 'abcd-ef', ''])(
    'ym %p sai định dạng → 400',
    async (ym) => {
      const a = await newItem(0);
      await receipts({ lines: [line(a)], ym }).expect(400);
    },
  );

  describe('kỳ chưa gửi NCC báo cáo → không nhận hàng kỳ đó', () => {
    // Kỳ quá khứ riêng, chưa có bản chốt có hàng
    const NOT_SENT = '2024-02';
    const noOrderYm = '2024-01';
    beforeAll(async () => {
      // Lần chạy trước đã "gửi" kỳ này ở ca cuối: dọn để suite chạy lại được
      await f
        .pool()
        .query(
          "DELETE FROM report_snapshots WHERE period_ym IN ('2024-01-01', '2024-02-01')",
        );
      await f.pool().query(
        `INSERT INTO periods (ym, deadline) VALUES ('2024-02-01', '2024-02-10'), ('2024-01-01', '2024-01-10')
         ON CONFLICT (ym) DO NOTHING`,
      );
      await f
        .pool()
        .query(
          "UPDATE periods SET no_order_at = now(), no_order_by = $1 WHERE ym = '2024-01-01'",
          [ADMIN],
        );
    });

    it('chưa có bản chốt có hàng → 409 REPORT_NOT_SENT kèm ym, không cộng tồn, không movement', async () => {
      const a = await newItem(2);
      const res = await receipts({
        lines: [line(a, 3, 2)],
        ym: NOT_SENT,
      }).expect(409);
      expect(res.body).toMatchObject({ code: 'REPORT_NOT_SENT', ym: NOT_SENT });
      expect((await qtyOf(a)).stock_qty).toBe(2);
      expect((await movements(a)).items).toEqual([]);
    });

    it('chỉ có bản chốt rỗng (không món nào) vẫn là chưa gửi → 409', async () => {
      await f.pool().query(
        `INSERT INTO report_snapshots (period_ym, kind, data, created_by_sub, created_at)
         VALUES ('2024-02-01', 'print', '{"order_qty": {"x": 0}, "byItem": [], "custom": []}'::jsonb, $1, now())`,
        [ADMIN],
      );
      const a = await newItem(0);
      const res = await receipts({ lines: [line(a)], ym: NOT_SENT }).expect(
        409,
      );
      expect(res.body.code).toBe('REPORT_NOT_SENT');
    });

    it('kỳ "Không cần đề nghị" (không có đơn gửi NCC) → 409 REPORT_NOT_SENT: không có hàng kỳ đó để nhận', async () => {
      const a = await newItem(0);
      const res = await receipts({ lines: [line(a)], ym: noOrderYm }).expect(
        409,
      );
      expect(res.body.code).toBe('REPORT_NOT_SENT');
    });

    it('snapshot_id null (client thấy chưa có bản) cũng → REPORT_NOT_SENT, không phải STALE_UPDATE', async () => {
      const a = await newItem(0);
      const res = await receipts({
        lines: [line(a)],
        ym: NOT_SENT,
        snapshot_id: null,
      }).expect(409);
      expect(res.body.code).toBe('REPORT_NOT_SENT');
    });

    it('nhập ngoài kỳ ở Tủ/Kho (POST admin/items/:id/stock) không bị chặn', async () => {
      const a = await newItem(0);
      await f.stock(a, { delta: 4, reason: 'purchase' }).expect(201);
      expect((await qtyOf(a)).stock_qty).toBe(4);
    });

    it('gửi NCC xong → nhận được', async () => {
      await markSent(f.pool(), NOT_SENT);
      const a = await newItem(0);
      await receipts({ lines: [line(a, 2, 0)], ym: NOT_SENT }).expect(200);
      expect((await qtyOf(a)).stock_qty).toBe(2);
    });
  });
});
