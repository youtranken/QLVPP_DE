import { deliveryFixture } from './delivery.fixture';
import type { DeliverResult } from './delivery.fixture';

describe('POST admin/lines/:id/deliver: giao một dòng', () => {
  const f = deliveryFixture('deliver');
  const {
    A,
    customLine,
    deliver,
    deliveriesOf,
    freeze,
    lockedLine,
    movementsOf,
    review,
    stockOf,
  } = f;

  it('giao 3/5 với expected 0 → delivered_qty 3, movement −3, tồn 7, 1 dòng line_deliveries', async () => {
    const { item, line } = await lockedLine(10);
    const res = await deliver(line.id, {
      qty: 3,
      expected_delivered_qty: 0,
    }).expect(200);
    const body = res.body as DeliverResult;
    expect(body).toEqual({
      line: { id: line.id, qty: 5, delivered_qty: 3, cancelled_qty: 0 },
      movement_id: expect.any(String),
      stock_qty: 7,
      request_complete: false,
    });
    expect(await movementsOf(line.id)).toEqual([
      { id: body.movement_id, delta: -3, reason: 'delivery' },
    ]);
    expect(await stockOf(item)).toBe(7);
    expect(await deliveriesOf(line.id)).toEqual([
      { qty: 3, movement_id: body.movement_id },
    ]);
  });

  it('giờ của movement giao = giờ ClockService (như line_deliveries, last_delivered_at), không phải now() DB', async () => {
    const { line } = await lockedLine(10);
    freeze('2026-11-12T03:00:00Z');
    await deliver(line.id, { qty: 3, expected_delivered_qty: 0 }).expect(200);
    const { rows } = await f.pool().query<{ m: Date; d: Date }>(
      `SELECT m.created_at AS m, d.created_at AS d FROM stock_movements m
       JOIN line_deliveries d ON d.movement_id = m.id WHERE m.ref_line_id = $1`,
      [line.id],
    );
    expect(rows.map((r) => [r.m.toISOString(), r.d.toISOString()])).toEqual([
      ['2026-11-12T03:00:00.000Z', '2026-11-12T03:00:00.000Z'],
    ]);
  });

  it('gửi lại cùng body → 409 STALE_UPDATE {delivered_qty: 3}, tồn vẫn 7', async () => {
    const { item, line } = await lockedLine(10);
    const body = { qty: 3, expected_delivered_qty: 0 };
    await deliver(line.id, body).expect(200);
    const again = await deliver(line.id, body).expect(409);
    expect(again.body).toMatchObject({
      code: 'STALE_UPDATE',
      delivered_qty: 3,
    });
    expect(await stockOf(item)).toBe(7);
    expect(await deliveriesOf(line.id)).toHaveLength(1);
  });

  it('giao 3 khi còn 2 → 400 DELIVER_EXCEEDS_QTY {remaining: 2}; giao 2 (= phần còn lại) → 200, request_complete true', async () => {
    const { item, line } = await lockedLine(10);
    await deliver(line.id, { qty: 3, expected_delivered_qty: 0 }).expect(200);
    const over = await deliver(line.id, {
      qty: 3,
      expected_delivered_qty: 3,
    }).expect(400);
    expect(over.body).toMatchObject({
      code: 'DELIVER_EXCEEDS_QTY',
      remaining: 2,
    });
    expect(await stockOf(item)).toBe(7);
    const exact = await deliver(line.id, {
      qty: 2,
      expected_delivered_qty: 3,
    }).expect(200);
    expect(exact.body).toMatchObject({
      line: { delivered_qty: 5 },
      stock_qty: 5,
      request_complete: true,
    });
  });

  it('qty 0 → 400 VALIDATION; qty 1 → 200; qty 1.5 → 400 VALIDATION; 9999 qua DTO (DELIVER_EXCEEDS_QTY), 10000 → VALIDATION', async () => {
    const { line } = await lockedLine(10);
    for (const qty of [0, 1.5, 10000]) {
      const res = await deliver(line.id, {
        qty,
        expected_delivered_qty: 0,
      }).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION', fields: ['qty'] });
    }
    const max = await deliver(line.id, {
      qty: 9999,
      expected_delivered_qty: 0,
    }).expect(400);
    expect(max.body).toMatchObject({
      code: 'DELIVER_EXCEEDS_QTY',
      remaining: 5,
    });
    await deliver(line.id, { qty: 1, expected_delivered_qty: 0 }).expect(200);
  });

  it('tồn 2 giao 3 → 409 STOCK_INSUFFICIENT {available: 2}, dòng không đổi; tồn 3 giao 3 → 200, tồn 0', async () => {
    const short = await lockedLine(2);
    const res = await deliver(short.line.id, {
      qty: 3,
      expected_delivered_qty: 0,
    }).expect(409);
    expect(res.body).toMatchObject({
      code: 'STOCK_INSUFFICIENT',
      available: 2,
    });
    expect(await deliveriesOf(short.line.id)).toHaveLength(0);
    expect(await stockOf(short.item)).toBe(2);
    const exact = await lockedLine(3, 5, f.B);
    const ok = await deliver(exact.line.id, {
      qty: 3,
      expected_delivered_qty: 0,
    }).expect(200);
    expect(ok.body).toMatchObject({ stock_qty: 0 });
    expect(await stockOf(exact.item)).toBe(0);
  });

  it('dòng pending → 409 LINE_NOT_REVIEWED; rejected → 409 LINE_REJECTED', async () => {
    const { line } = await customLine();
    freeze('2026-11-12T03:00:00Z');
    const pending = await deliver(line.id, {
      qty: 1,
      expected_delivered_qty: 0,
    }).expect(409);
    expect(pending.body.code).toBe('LINE_NOT_REVIEWED');
    await review(line.id, { action: 'reject', note: 'Không mua' }).expect(200);
    const rejected = await deliver(line.id, {
      qty: 1,
      expected_delivered_qty: 0,
    }).expect(409);
    expect(rejected.body.code).toBe('LINE_REJECTED');
  });

  it('accepted (ngoài DM) giao 2 → không movement, movement_id null, stock_qty null; có line_deliveries', async () => {
    const { line } = await customLine();
    await review(line.id, { action: 'accept' }).expect(200);
    freeze('2026-11-12T03:00:00Z');
    const res = await deliver(line.id, {
      qty: 2,
      expected_delivered_qty: 0,
    }).expect(200);
    expect(res.body).toEqual({
      line: { id: line.id, qty: 2, delivered_qty: 2, cancelled_qty: 0 },
      movement_id: null,
      stock_qty: null,
      request_complete: true,
    });
    expect(await movementsOf(line.id)).toHaveLength(0);
    expect(await deliveriesOf(line.id)).toEqual([
      { qty: 2, movement_id: null },
    ]);
  });

  it('PERIOD_NOT_LOCKED khi giao lúc 2026-11-10T16:59:59.999Z (23:59:59.999 ngày 10 VN); giao được lúc 2026-11-10T17:00:00.000Z (00:00 ngày 11 VN)', async () => {
    const { item, line } = await lockedLine(10);
    freeze('2026-11-10T16:59:59.999Z');
    const early = await deliver(line.id, {
      qty: 1,
      expected_delivered_qty: 0,
    }).expect(409);
    expect(early.body.code).toBe('PERIOD_NOT_LOCKED');
    expect(await stockOf(item)).toBe(10);
    freeze('2026-11-10T17:00:00.000Z');
    await deliver(line.id, { qty: 1, expected_delivered_qty: 0 }).expect(200);
  });

  it('id không tồn tại → 404 LINE_NOT_FOUND; id không phải uuid → 400; member → 403', async () => {
    const missing = await deliver('00000000-0000-4000-8000-000000000000', {
      qty: 1,
      expected_delivered_qty: 0,
    }).expect(404);
    expect(missing.body.code).toBe('LINE_NOT_FOUND');
    await deliver('x', { qty: 1, expected_delivered_qty: 0 }).expect(400);
    const { line } = await lockedLine(10);
    await deliver(
      line.id,
      { qty: 1, expected_delivered_qty: 0 },
      A,
      'member',
    ).expect(403);
  });

  it('expected_delivered_qty thiếu / -1 → 400 VALIDATION {fields: [expected_delivered_qty]}', async () => {
    const { line } = await lockedLine(10);
    for (const body of [{ qty: 1 }, { qty: 1, expected_delivered_qty: -1 }]) {
      const res = await deliver(line.id, body).expect(400);
      expect(res.body).toMatchObject({
        code: 'VALIDATION',
        fields: ['expected_delivered_qty'],
      });
    }
  });
});
