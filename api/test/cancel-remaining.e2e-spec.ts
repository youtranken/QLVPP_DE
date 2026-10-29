import { deliveryFixture } from './delivery.fixture';
import type { RequestView } from './me-request.fixture';

interface CancelResult {
  line: {
    id: string;
    qty: number;
    delivered_qty: number;
    cancelled_qty: number;
    cancel_note: string | null;
  };
  cancelled_now: number;
}

describe('POST admin/lines/:id/cancel-remaining: hủy nợ', () => {
  const f = deliveryFixture('cancel');
  const {
    A,
    ADMIN,
    as,
    auditOf,
    backlog,
    bellsOf,
    cancel,
    customLine,
    deliver,
    deliverAll,
    freeze,
    http,
    lockedLine,
    review,
  } = f;

  const adminView = async (id: string) =>
    (
      await as(http().get(`/api/admin/requests/${id}`), ADMIN, 'admin').expect(
        200,
      )
    ).body as RequestView;
  const adminSetQty = async (requestId: string, qty: number) => {
    const r = await adminView(requestId);
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
  const lineCancelled = () => bellsOf('line_cancelled');

  it('dòng 5 đã giao 3 → hủy "Người đã nghỉ": cancelled_qty 2, cancelled_now 2, rời Còn nợ, member thấy cancel_note, đúng 1 chuông line_cancelled:<id>:2', async () => {
    const { request, line } = await lockedLine(10);
    await deliver(line.id, { qty: 3, expected_delivered_qty: 0 }).expect(200);
    expect(await backlogLineIds()).toContain(line.id);
    const res = await cancel(line.id, {
      reason: 'Người đã nghỉ',
      expected_delivered_qty: 3,
      expected_qty: line.qty,
    }).expect(200);
    expect(res.body as CancelResult).toEqual({
      line: {
        id: line.id,
        qty: 5,
        delivered_qty: 3,
        cancelled_qty: 2,
        cancel_note: 'Người đã nghỉ',
      },
      cancelled_now: 2,
    });
    expect(await backlogLineIds()).not.toContain(line.id);
    const mine = (
      await as(http().get('/api/me/request?ym=2026-11'), A).expect(200)
    ).body as { lines: Record<string, unknown>[] };
    expect(mine.lines[0]).toMatchObject({
      cancelled_qty: 2,
      cancel_note: 'Người đã nghỉ',
    });
    const [bell, ...more] = await lineCancelled();
    expect(more).toEqual([]);
    expect(bell).toEqual({
      event_id: `line_cancelled:${line.id}:2`,
      params: {
        ym: '2026-11',
        name: expect.stringContaining('e2e-req-item-') as string,
        name_en: null,
        unit: 'cay',
        qty: 2,
        reason: 'Người đã nghỉ',
      },
      link: '/history/2026-11',
    });
    expect(await auditOf('line.cancel_remaining', line.id)).toEqual([
      {
        request_id: request.id,
        before: { cancelled_qty: 0 },
        after: { cancelled_qty: 2 },
        reason: 'Người đã nghỉ',
      },
    ]);
    expect(await bellsOf('request_delivered')).toEqual([]);
  });

  it('sau hủy: giao thêm 1 (= còn lại + 1) → 400 DELIVER_EXCEEDS_QTY {remaining: 0}', async () => {
    const { line } = await lockedLine(10);
    await deliver(line.id, { qty: 3, expected_delivered_qty: 0 }).expect(200);
    await cancel(line.id, {
      reason: 'Người đã nghỉ',
      expected_delivered_qty: 3,
      expected_qty: line.qty,
    }).expect(200);
    const over = await deliver(line.id, {
      qty: 1,
      expected_delivered_qty: 3,
      expected_qty: line.qty,
    }).expect(400);
    expect(over.body).toMatchObject({
      code: 'DELIVER_EXCEEDS_QTY',
      remaining: 0,
    });
  });

  it('reason "ab", "  ab  ", thiếu → 400 REASON_REQUIRED, dòng không đổi; "  abc " → 200, cancel_note "abc"', async () => {
    const { line } = await lockedLine(10);
    for (const body of [
      { reason: 'ab', expected_delivered_qty: 0, expected_qty: line.qty },
      { reason: '  ab  ', expected_delivered_qty: 0, expected_qty: line.qty },
      { expected_delivered_qty: 0, expected_qty: line.qty },
    ]) {
      const res = await cancel(line.id, body).expect(400);
      expect(res.body.code).toBe('REASON_REQUIRED');
    }
    expect(await lineCancelled()).toEqual([]);
    const ok = await cancel(line.id, {
      reason: '  abc ',
      expected_delivered_qty: 0,
      expected_qty: line.qty,
    }).expect(200);
    expect(ok.body).toMatchObject({
      line: { cancelled_qty: 5, cancel_note: 'abc' },
      cancelled_now: 5,
    });
  });

  it('reason 501 ký tự (NOTE_MAX + 1) → 400 VALIDATION {fields: [reason]}, dòng không đổi, không chuông; 500 ký tự → 200, cancel_note dài 500', async () => {
    const { line } = await lockedLine(10);
    const over = await cancel(line.id, {
      reason: 'x'.repeat(501),
      expected_delivered_qty: 0,
      expected_qty: line.qty,
    }).expect(400);
    expect(over.body).toMatchObject({ code: 'VALIDATION', fields: ['reason'] });
    expect(await f.lineRow(line.id)).toMatchObject({
      cancelled_qty: 0,
      cancel_note: null,
    });
    expect(await lineCancelled()).toEqual([]);
    const ok = await cancel(line.id, {
      reason: 'x'.repeat(500),
      expected_delivered_qty: 0,
      expected_qty: line.qty,
    }).expect(200);
    expect((ok.body as CancelResult).line.cancel_note).toHaveLength(500);
    expect(await lineCancelled()).toHaveLength(1);
  });

  it('gọi lại khi phần còn lại 0 → 200 cancelled_now 0, không chuông thứ hai, không audit thứ hai, updated_at phiếu không đổi', async () => {
    const { request, line } = await lockedLine(10);
    const body = {
      reason: 'Người đã nghỉ',
      expected_delivered_qty: 0,
      expected_qty: line.qty,
    };
    await cancel(line.id, body).expect(200);
    const before = (await adminView(request.id)).updated_at;
    freeze('2026-11-13T03:00:00Z');
    const again = await cancel(line.id, {
      ...body,
      reason: 'Lý do khác',
    }).expect(200);
    expect(again.body).toEqual({
      line: {
        id: line.id,
        qty: 5,
        delivered_qty: 0,
        cancelled_qty: 5,
        cancel_note: 'Người đã nghỉ',
      },
      cancelled_now: 0,
    });
    expect(await lineCancelled()).toHaveLength(1);
    expect(await auditOf('line.cancel_remaining', line.id)).toHaveLength(1);
    expect((await adminView(request.id)).updated_at).toBe(before);
  });

  it('có hủy → updated_at phiếu đổi (tab Điều chỉnh cũ nhận STALE_UPDATE)', async () => {
    const { request, line } = await lockedLine(10);
    const before = (await adminView(request.id)).updated_at;
    freeze('2026-11-13T03:00:00Z');
    await cancel(line.id, {
      reason: 'Người đã nghỉ',
      expected_delivered_qty: 0,
      expected_qty: line.qty,
    }).expect(200);
    expect((await adminView(request.id)).updated_at).toBe(
      '2026-11-13T03:00:00.000Z',
    );
    expect(before).not.toBe('2026-11-13T03:00:00.000Z');
  });

  it('PERIOD_NOT_LOCKED lúc 2026-11-10T16:59:59.999Z (23:59:59.999 ngày 10 VN); hủy được lúc 2026-11-10T17:00:00.000Z (00:00 ngày 11 VN)', async () => {
    const { line } = await lockedLine(10);
    const body = {
      reason: 'Người đã nghỉ',
      expected_delivered_qty: 0,
      expected_qty: line.qty,
    };
    freeze('2026-11-10T16:59:59.999Z');
    const early = await cancel(line.id, body).expect(409);
    expect(early.body.code).toBe('PERIOD_NOT_LOCKED');
    freeze('2026-11-10T17:00:00.000Z');
    await cancel(line.id, body).expect(200);
  });

  it('Hành chính tăng qty 5→7 sau khi hủy 2 rồi hủy tiếp → cancelled_qty 4, chuông mới line_cancelled:<id>:4', async () => {
    const { request, line } = await lockedLine(10);
    await deliver(line.id, { qty: 3, expected_delivered_qty: 0 }).expect(200);
    await cancel(line.id, {
      reason: 'Người đã nghỉ',
      expected_delivered_qty: 3,
      expected_qty: line.qty,
    }).expect(200);
    await adminSetQty(request.id, 7);
    const res = await cancel(line.id, {
      reason: 'Vẫn nghỉ',
      expected_delivered_qty: 3,
      expected_qty: 7,
    }).expect(200);
    expect(res.body).toMatchObject({
      line: { qty: 7, cancelled_qty: 4, cancel_note: 'Vẫn nghỉ' },
      cancelled_now: 2,
    });
    expect((await lineCancelled()).map((b) => b.event_id)).toEqual([
      `line_cancelled:${line.id}:2`,
      `line_cancelled:${line.id}:4`,
    ]);
  });

  it('cancelled_qty > 0 rồi tăng qty 5→7 (còn 7−3−2 = 2): giao 3 → DELIVER_EXCEEDS_QTY {remaining: 2}; deliver-all giao đúng 2, chuông giao đủ', async () => {
    const { request, line } = await lockedLine(10);
    await deliver(line.id, { qty: 3, expected_delivered_qty: 0 }).expect(200);
    await cancel(line.id, {
      reason: 'Người đã nghỉ',
      expected_delivered_qty: 3,
      expected_qty: line.qty,
    }).expect(200);
    await adminSetQty(request.id, 7);
    const over = await deliver(line.id, {
      qty: 3,
      expected_delivered_qty: 3,
    }).expect(400);
    expect(over.body).toMatchObject({
      code: 'DELIVER_EXCEEDS_QTY',
      remaining: 2,
    });
    const all = await deliverAll(request.id).expect(200);
    expect(all.body).toEqual({
      delivered: [{ line_id: line.id, qty: 2 }],
      failed: [],
    });
    expect((await bellsOf('request_delivered')).map((b) => b.event_id)).toEqual(
      [`request_delivered:${request.id}:2`],
    );
  });

  it('dòng ngoài DM accepted → chuông có tên/ĐVT của dòng, name_en null', async () => {
    const { line } = await customLine();
    await review(line.id, { action: 'accept' }).expect(200);
    freeze('2026-11-12T03:00:00Z');
    await cancel(line.id, {
      reason: 'Không mua nữa',
      expected_delivered_qty: 0,
      expected_qty: line.qty,
    }).expect(200);
    expect((await lineCancelled())[0].params).toEqual({
      ym: '2026-11',
      name: 'Bìa còng đặc biệt',
      name_en: null,
      unit: 'cai',
      qty: 2,
      reason: 'Không mua nữa',
    });
  });

  it('pending → 409 LINE_NOT_REVIEWED; rejected → 409 LINE_REJECTED', async () => {
    const { line } = await customLine();
    freeze('2026-11-12T03:00:00Z');
    const body = {
      reason: 'Người đã nghỉ',
      expected_delivered_qty: 0,
      expected_qty: line.qty,
    };
    const pending = await cancel(line.id, body).expect(409);
    expect(pending.body.code).toBe('LINE_NOT_REVIEWED');
    await review(line.id, { action: 'reject', note: 'Không mua' }).expect(200);
    const rejected = await cancel(line.id, body).expect(409);
    expect(rejected.body.code).toBe('LINE_REJECTED');
  });

  it('id không có → 404 LINE_NOT_FOUND; id sai dạng → 400; member → 403; expected_delivered_qty -1 → VALIDATION', async () => {
    const body = {
      reason: 'Người đã nghỉ',
      expected_delivered_qty: 0,
      expected_qty: 5,
    };
    const missing = await cancel(
      '00000000-0000-4000-8000-000000000000',
      body,
    ).expect(404);
    expect(missing.body.code).toBe('LINE_NOT_FOUND');
    await cancel('x', body).expect(400);
    const { line } = await lockedLine(10);
    await cancel(line.id, body, A, 'member').expect(403);
    const bad = await cancel(line.id, {
      ...body,
      expected_delivered_qty: -1,
    }).expect(400);
    expect(bad.body).toMatchObject({
      code: 'VALIDATION',
      fields: ['expected_delivered_qty'],
    });
  });
});
