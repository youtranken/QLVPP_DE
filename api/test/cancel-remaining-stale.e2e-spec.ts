import { deliveryFixture } from './delivery.fixture';
import type { RequestView } from './me-request.fixture';

describe('POST admin/lines/:id/cancel-remaining: hộp hủy đã cũ → STALE_UPDATE', () => {
  const f = deliveryFixture('cancel-stale');
  const { ADMIN, as, backlog, bellsOf, cancel, deliver, http, lockedLine } = f;

  const adminSetQty = async (requestId: string, qty: number) => {
    const r = (
      await as(
        http().get(`/api/admin/requests/${requestId}`),
        ADMIN,
        'admin',
      ).expect(200)
    ).body as RequestView;
    await as(http().put(`/api/admin/requests/${r.id}/lines`), ADMIN, 'admin')
      .send({
        lines: [{ id: r.lines[0].id, qty }],
        expected_updated_at: r.updated_at,
        reason: 'Bổ sung theo yêu cầu',
      })
      .expect(200);
  };
  const backlogLineIds = async () =>
    (await backlog('item')).flatMap((g) => g.lines.map((l) => l.line_id));
  const cancelledQty = async (lineId: string) =>
    (
      await f.pool().query<{
        cancelled_qty: number;
      }>('SELECT cancelled_qty FROM request_lines WHERE id = $1', [lineId])
    ).rows[0].cancelled_qty;

  it('expected_delivered_qty lệch → 409 STALE_UPDATE {delivered_qty: 3}, không hủy', async () => {
    const { line } = await lockedLine(10);
    await deliver(line.id, { qty: 3, expected_delivered_qty: 0 }).expect(200);
    const res = await cancel(line.id, {
      reason: 'Người đã nghỉ',
      expected_delivered_qty: 0,
      expected_qty: 5,
    }).expect(409);
    expect(res.body).toMatchObject({ code: 'STALE_UPDATE', delivered_qty: 3 });
    expect(await backlogLineIds()).toContain(line.id);
  });

  it('mở hộp lúc qty 5 (còn 2), Hành chính tăng qty lên 7 → expected_qty 5: 409 STALE_UPDATE {qty: 7, delivered_qty: 3}, không hủy, không chuông; expected_qty 7: 200 hủy 4', async () => {
    const { request, line } = await lockedLine(10);
    await deliver(line.id, { qty: 3, expected_delivered_qty: 0 }).expect(200);
    await adminSetQty(request.id, 7);
    const stale = await cancel(line.id, {
      reason: 'Người đã nghỉ',
      expected_delivered_qty: 3,
      expected_qty: 5,
    }).expect(409);
    expect(stale.body).toMatchObject({
      code: 'STALE_UPDATE',
      qty: 7,
      delivered_qty: 3,
    });
    expect(await cancelledQty(line.id)).toBe(0);
    expect(await bellsOf('line_cancelled')).toEqual([]);
    const ok = await cancel(line.id, {
      reason: 'Người đã nghỉ',
      expected_delivered_qty: 3,
      expected_qty: 7,
    }).expect(200);
    expect(ok.body).toMatchObject({
      line: { qty: 7, cancelled_qty: 4 },
      cancelled_now: 4,
    });
  });

  it('expected_qty thiếu / 0 / 1.5 → 400 VALIDATION {fields: [expected_qty]}; 1 (lệch qty 5) → 409 STALE_UPDATE', async () => {
    const { line } = await lockedLine(10);
    const body = { reason: 'Người đã nghỉ', expected_delivered_qty: 0 };
    for (const extra of [{}, { expected_qty: 0 }, { expected_qty: 1.5 }]) {
      const res = await cancel(line.id, { ...body, ...extra }).expect(400);
      expect(res.body).toMatchObject({
        code: 'VALIDATION',
        fields: ['expected_qty'],
      });
    }
    const one = await cancel(line.id, { ...body, expected_qty: 1 }).expect(409);
    expect(one.body).toMatchObject({ code: 'STALE_UPDATE', qty: 5 });
    expect(await cancelledQty(line.id)).toBe(0);
  });
});
