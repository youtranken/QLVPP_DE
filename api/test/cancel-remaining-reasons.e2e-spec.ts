import { deliveryFixture } from './delivery.fixture';

const NOT_NEEDED = 'Người nhận không cần nữa';

describe('POST admin/lines/:id/cancel-remaining: lý do có sẵn, chỉ nợ tháng trước', () => {
  const f = deliveryFixture('cancel-reason');
  const { A, auditOf, bellsOf, cancel, debtLine, deliver, freeze, lockedLine } =
    f;
  const allBells = async () =>
    (
      await f.pool().query<{
        topic: string;
      }>('SELECT topic FROM in_app_notifications WHERE user_sub = $1', [A])
    ).rows;
  const body = (line: { qty: number }, extra: object) => ({
    expected_delivered_qty: 0,
    expected_qty: line.qty,
    ...extra,
  });

  it('thiếu reason_code (kể cả có reason "abc") → 400 REASON_REQUIRED; mã lạ "lost" → 400 VALIDATION {fields: [reason_code]}; dòng không đổi', async () => {
    const { line } = await debtLine(10);
    for (const extra of [{}, { reason: 'abc' }]) {
      const res = await cancel(line.id, body(line, extra)).expect(400);
      expect(res.body.code).toBe('REASON_REQUIRED');
    }
    const odd = await cancel(
      line.id,
      body(line, { reason_code: 'lost' }),
    ).expect(400);
    expect(odd.body).toMatchObject({
      code: 'VALIDATION',
      fields: ['reason_code'],
    });
    expect(await f.lineRow(line.id)).toMatchObject({ cancelled_qty: 0 });
  });

  it('other: ghi chú "  ab  " (trim 2) → 400 REASON_REQUIRED; "  abc " (3) → 200, cancel_note "Khác: abc"', async () => {
    const { line } = await debtLine(10);
    for (const reason of [undefined, '  ab  ']) {
      const res = await cancel(
        line.id,
        body(line, { reason_code: 'other', reason }),
      ).expect(400);
      expect(res.body.code).toBe('REASON_REQUIRED');
    }
    const ok = await cancel(
      line.id,
      body(line, { reason_code: 'other', reason: '  abc ' }),
    ).expect(200);
    expect(ok.body).toMatchObject({
      line: { cancelled_qty: 5, cancel_note: 'Khác: abc' },
      cancelled_now: 5,
    });
  });

  it('ghi chú 201 ký tự → 400 VALIDATION {fields: [reason]}, dòng không đổi; 200 ký tự → 200', async () => {
    const { line } = await debtLine(10);
    const over = await cancel(
      line.id,
      body(line, { reason_code: 'other', reason: 'x'.repeat(201) }),
    ).expect(400);
    expect(over.body).toMatchObject({ code: 'VALIDATION', fields: ['reason'] });
    expect(await f.lineRow(line.id)).toMatchObject({ cancelled_qty: 0 });
    const ok = await cancel(
      line.id,
      body(line, { reason_code: 'other', reason: 'x'.repeat(200) }),
    ).expect(200);
    expect(ok.body.line.cancel_note).toBe(`Khác: ${'x'.repeat(200)}`);
  });

  it('ghi chú đếm sau NFC + trim: 200 ký tự + khoảng trắng hai đầu → 200; 200 chữ "ế" gõ dạng NFD → 200; 201 chữ "ế" NFD → 400 VALIDATION {fields: [reason]}', async () => {
    const nfd = (n: number) => 'ế'.normalize('NFD').repeat(n);
    const { line } = await debtLine(10);
    const over = await cancel(
      line.id,
      body(line, { reason_code: 'other', reason: nfd(201) }),
    ).expect(400);
    expect(over.body).toMatchObject({ code: 'VALIDATION', fields: ['reason'] });
    expect(await f.lineRow(line.id)).toMatchObject({ cancelled_qty: 0 });
    const ok = await cancel(
      line.id,
      body(line, { reason_code: 'other', reason: nfd(200) }),
    ).expect(200);
    expect(ok.body.line.cancel_note).toBe(`Khác: ${'ế'.repeat(200)}`);
    const { line: padded } = await debtLine(10, 5, f.B);
    const trimmed = await cancel(
      padded.id,
      body(padded, { reason_code: 'other', reason: ` ${'x'.repeat(200)}  ` }),
    ).expect(200);
    expect(trimmed.body.line.cancel_note).toBe(`Khác: ${'x'.repeat(200)}`);
  });

  it('chủ phiếu đã nghỉ: not_needed → 200 nhưng 0 chuông (mọi topic)', async () => {
    const { line } = await debtLine(10);
    await f
      .pool()
      .query("UPDATE users SET status = 'locked' WHERE sub = $1", [A]);
    try {
      await cancel(line.id, body(line, { reason_code: 'not_needed' })).expect(
        200,
      );
      expect(await allBells()).toEqual([]);
    } finally {
      await f
        .pool()
        .query("UPDATE users SET status = 'active' WHERE sub = $1", [A]);
    }
  });

  it('not_needed không ghi chú → 200, cancel_note "Người nhận không cần nữa", đúng 1 chuông line_cancelled với lý do đó, audit có reason_code', async () => {
    const { request, line } = await debtLine(10);
    const res = await cancel(
      line.id,
      body(line, { reason_code: 'not_needed' }),
    ).expect(200);
    expect(res.body.line.cancel_note).toBe(NOT_NEEDED);
    const bells = await bellsOf('line_cancelled');
    expect(bells).toHaveLength(1);
    expect(bells[0].params).toMatchObject({ qty: 5, reason: NOT_NEEDED });
    expect(await auditOf('line.cancel_remaining', line.id)).toEqual([
      {
        request_id: request.id,
        before: { cancelled_qty: 0 },
        after: { cancelled_qty: 5 },
        reason: NOT_NEEDED,
        reason_code: 'not_needed',
      },
    ]);
  });

  it('not_needed có ghi chú "  Đổi mẫu " → cancel_note "Người nhận không cần nữa: Đổi mẫu"', async () => {
    const { line } = await debtLine(10);
    const res = await cancel(
      line.id,
      body(line, { reason_code: 'not_needed', reason: '  Đổi mẫu ' }),
    ).expect(200);
    expect(res.body.line.cancel_note).toBe(`${NOT_NEEDED}: Đổi mẫu`);
  });

  it('user_left → 200, cancel_note "Đã nghỉ việc", 0 chuông (mọi topic)', async () => {
    const { line } = await debtLine(10);
    const res = await cancel(
      line.id,
      body(line, { reason_code: 'user_left' }),
    ).expect(200);
    expect(res.body).toMatchObject({
      line: { cancelled_qty: 5, cancel_note: 'Đã nghỉ việc' },
      cancelled_now: 5,
    });
    expect(await allBells()).toEqual([]);
  });

  it('adm_out_of_stock trên dòng nợ tháng trước (không cần đánh dấu) → 200, cancel_note "ADM hết hàng", 1 chuông line_cancelled', async () => {
    const { line } = await debtLine(10);
    const res = await cancel(
      line.id,
      body(line, { reason_code: 'adm_out_of_stock' }),
    ).expect(200);
    expect(res.body.line.cancel_note).toBe('ADM hết hàng');
    expect(await bellsOf('line_cancelled')).toHaveLength(1);
  });

  it('dòng tháng đang giao (K* = 2026-11): đã giao 2 → not_needed 409 NOT_DEBT_YET, dòng không đổi, không chuông; mốc khóa kỳ 12: 2026-12-10T16:59:59.999Z vẫn 409, 17:00:00.000Z → 200', async () => {
    const { line } = await lockedLine(10);
    await deliver(line.id, { qty: 2, expected_delivered_qty: 0 }).expect(200);
    const req = {
      reason_code: 'not_needed',
      expected_delivered_qty: 2,
      expected_qty: line.qty,
    };
    const now = await cancel(line.id, req).expect(409);
    expect(now.body).toMatchObject({
      code: 'NOT_DEBT_YET',
      message:
        'Đây là phần chưa nhận của tháng đang giao — giảm ở Tổng hợp nếu không giao nữa.',
    });
    freeze('2026-12-10T16:59:59.999Z');
    const edge = await cancel(line.id, req).expect(409);
    expect(edge.body.code).toBe('NOT_DEBT_YET');
    expect(await f.lineRow(line.id)).toMatchObject({
      delivered_qty: 2,
      cancelled_qty: 0,
      cancel_note: null,
    });
    expect(await bellsOf('line_cancelled')).toEqual([]);
    freeze('2026-12-10T17:00:00.000Z');
    const ok = await cancel(line.id, req).expect(200);
    expect(ok.body.cancelled_now).toBe(3);
  });
});
