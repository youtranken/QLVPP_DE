import { HttpException } from '@nestjs/common';
import { normalizeNote, parseAdjustLines, planAdjust } from './adjust-rules';
import type { AdjustLine } from './adjust-rules';
import type { LineRow } from './request-lines.rules';

const row = (
  id: string,
  qty: number,
  over: Partial<LineRow> = {},
): LineRow => ({
  id,
  item_id: 'item-' + id,
  custom_name: null,
  custom_unit: null,
  custom_note: null,
  image_file_id: null,
  qty,
  delivered_qty: 0,
  cancelled_qty: 0,
  cancel_note: null,
  review_status: 'n/a',
  review_note: null,
  added_by_admin: false,
  ...over,
});

const body = (err: () => unknown) => {
  try {
    err();
  } catch (e) {
    const ex = e as HttpException;
    return { status: ex.getStatus(), ...(ex.getResponse() as object) };
  }
  throw new Error('không ném lỗi');
};

const line = (over: Partial<AdjustLine>): AdjustLine => ({
  id: 'a',
  qty: 4,
  expected_qty: 5,
  reason_code: 'over_quota',
  reason_note: null,
  ...over,
});

describe('normalizeNote', () => {
  it('NFC + trim; chỉ khoảng trắng → null; vắng → null', () => {
    expect(normalizeNote('  Bút  ')).toBe('Bút');
    expect(normalizeNote('   ')).toBeNull();
    expect(normalizeNote(undefined)).toBeNull();
    expect(normalizeNote(null)).toBeNull();
  });
});

describe('parseAdjustLines: VALIDATION của mã/ghi chú', () => {
  const nfd200 = 'ú'.repeat(200);

  it('200 mã điểm (nhập NFD → NFC) → ok; 200 chữ + dấu cách cuối → ok (trim trước khi đếm)', () => {
    const [a] = parseAdjustLines([{ id: 'a', qty: 1, reason_note: nfd200 }]);
    expect(a.reason_note).toBe('ú'.repeat(200));
    expect([...a.reason_note!].length).toBe(200);
    const [b] = parseAdjustLines([
      { id: 'a', qty: 1, reason_note: 'x'.repeat(200) + ' ' },
    ]);
    expect(b.reason_note).toBe('x'.repeat(200));
  });

  it('201 mã điểm → 400 VALIDATION fields [lines.reason_note] + line_index', () => {
    expect(
      body(() =>
        parseAdjustLines([
          { id: 'a', qty: 1 },
          { id: 'b', qty: 1, reason_note: '😀'.repeat(201) },
        ]),
      ),
    ).toMatchObject({
      status: 400,
      code: 'VALIDATION',
      fields: ['lines.reason_note'],
      line_index: 1,
    });
  });

  it("mã lạ 'xyz' → 400 VALIDATION fields [lines.reason_code] + line_index", () => {
    expect(
      body(() => parseAdjustLines([{ id: 'a', qty: 1, reason_code: 'xyz' }])),
    ).toMatchObject({
      code: 'VALIDATION',
      fields: ['lines.reason_code'],
      line_index: 0,
    });
  });

  it.each([
    'over_quota',
    'duplicate',
    'user_left',
    'adm_out_of_stock',
    'other',
  ])('mã cũ %s vẫn hợp lệ (lịch sử và người đã nghỉ)', (code) => {
    const [a] = parseAdjustLines([{ id: 'a', qty: 1, reason_code: code }]);
    expect(a.reason_code).toBe(code);
  });

  it('mã lạ "out_of_stock" → VALIDATION lines.reason_code', () => {
    expect(
      body(() =>
        parseAdjustLines([{ id: 'a', qty: 1, reason_code: 'out_of_stock' }]),
      ),
    ).toMatchObject({ code: 'VALIDATION', fields: ['lines.reason_code'] });
  });

  it('ghi chú không phải chuỗi → VALIDATION [lines.reason_note]', () => {
    expect(
      body(() => parseAdjustLines([{ id: 'a', qty: 1, reason_note: 5 }])),
    ).toMatchObject({ code: 'VALIDATION', fields: ['lines.reason_note'] });
  });
});

describe('planAdjust: thứ tự lỗi và lý do', () => {
  const existing = [row('a', 5), row('b', 3)];
  const keepB = line({ id: 'b', qty: 3, expected_qty: 3, reason_code: null });

  it("other 'ab' → REASON_REQUIRED line_id; 'abc' → ok; other '   ' (null) → REASON_REQUIRED", () => {
    for (const note of ['ab', null]) {
      expect(
        body(() =>
          planAdjust(existing, [
            line({ reason_code: 'other', reason_note: note }),
            keepB,
          ]),
        ),
      ).toMatchObject({ status: 400, code: 'REASON_REQUIRED', line_id: 'a' });
    }
    const changes = planAdjust(existing, [
      line({ reason_code: 'other', reason_note: 'abc' }),
      keepB,
    ]);
    expect(changes.map((c) => [c.before.id, c.after])).toEqual([['a', 4]]);
  });

  it('user_left không ghi chú → ok; over_quota không ghi chú → ok; thiếu mã → REASON_REQUIRED', () => {
    for (const code of ['user_left', 'over_quota'] as const) {
      expect(
        planAdjust(existing, [line({ reason_code: code }), keepB]),
      ).toHaveLength(1);
    }
    expect(
      body(() => planAdjust(existing, [line({ reason_code: null }), keepB])),
    ).toMatchObject({ code: 'REASON_REQUIRED', line_id: 'a' });
  });

  it('dòng không đổi số kèm lý do → không thành thay đổi', () => {
    expect(
      planAdjust(existing, [
        line({ qty: 5, reason_code: 'over_quota' }),
        keepB,
      ]),
    ).toEqual([]);
  });

  it('expected_qty lệch → 409 STALE_UPDATE line_id + qty hiện tại, trước LINE_MISSING', () => {
    expect(
      body(() => planAdjust(existing, [line({ expected_qty: 4 })])),
    ).toMatchObject({
      status: 409,
      code: 'STALE_UPDATE',
      line_id: 'a',
      qty: 5,
    });
  });

  it('lines [] trên phiếu 2 dòng → LINE_MISSING dòng đầu', () => {
    expect(body(() => planAdjust(existing, []))).toMatchObject({
      code: 'LINE_MISSING',
      line_id: 'a',
    });
  });

  it('5 → 6 → QTY_INCREASE_FORBIDDEN; dòng không id → LINE_ADD_FORBIDDEN line_index; cả hai: lỗi theo thứ tự body', () => {
    expect(
      body(() => planAdjust(existing, [line({ qty: 6 }), keepB])),
    ).toMatchObject({ code: 'QTY_INCREASE_FORBIDDEN', line_id: 'a' });
    const fresh = line({ id: undefined, expected_qty: undefined, qty: 1 });
    expect(
      body(() => planAdjust(existing, [line({}), keepB, fresh])),
    ).toMatchObject({ code: 'LINE_ADD_FORBIDDEN', line_index: 2 });
    expect(
      body(() => planAdjust(existing, [fresh, line({ qty: 6 }), keepB])),
    ).toMatchObject({ code: 'LINE_ADD_FORBIDDEN', line_index: 0 });
  });

  it('sàn delivered+cancelled: giao 2 hủy 1 → 3 ok, 2 → QTY_BELOW_DELIVERED; QTY_BELOW trước REASON_REQUIRED', () => {
    const served = [row('a', 5, { delivered_qty: 2, cancelled_qty: 1 })];
    expect(planAdjust(served, [line({ qty: 3 })])).toHaveLength(1);
    expect(
      body(() => planAdjust(served, [line({ qty: 2, reason_code: null })])),
    ).toMatchObject({
      code: 'QTY_BELOW_DELIVERED',
      line_id: 'a',
      delivered: 2,
    });
  });

  it('qty 0 chưa giao, mọi trạng thái duyệt → bỏ dòng (after 0)', () => {
    for (const review_status of [
      'n/a',
      'accepted',
      'converted',
      'rejected',
      'pending',
    ] as const) {
      const [c] = planAdjust(
        [row('a', 5, { review_status })],
        [line({ qty: 0 })],
      );
      expect(c.after).toBe(0);
    }
  });

  it('id không thuộc phiếu hoặc gửi trùng → LINE_NOT_FOUND line_index', () => {
    expect(
      body(() => planAdjust(existing, [line({}), line({ id: 'zz' })])),
    ).toMatchObject({ code: 'LINE_NOT_FOUND', line_index: 1 });
    expect(
      body(() => planAdjust(existing, [line({}), line({})])),
    ).toMatchObject({ code: 'LINE_NOT_FOUND', line_index: 1 });
  });
});
