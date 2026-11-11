import { cancelNoteOf } from './cancel-reason';
import type { CancelBody } from './delivery.dto';

const body = (over: Partial<CancelBody>): CancelBody => ({
  expected_delivered_qty: 0,
  expected_qty: 1,
  ...over,
});
const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as { getResponse(): { code: string } }).getResponse().code;
  }
  return 'OK';
};

describe('cancelNoteOf — lý do Hủy nợ', () => {
  it('thiếu mã → REASON_REQUIRED (kể cả có ghi chú)', () => {
    expect(codeOf(() => cancelNoteOf(body({})))).toBe('REASON_REQUIRED');
    expect(codeOf(() => cancelNoteOf(body({ reason: 'abc' })))).toBe(
      'REASON_REQUIRED',
    );
  });

  it('other: ghi chú 2 mã điểm (sau trim) → REASON_REQUIRED; 3 → "Khác: abc"; emoji 3 mã điểm (6 UTF-16) → được', () => {
    expect(
      codeOf(() =>
        cancelNoteOf(body({ reason_code: 'other', reason: ' ab ' })),
      ),
    ).toBe('REASON_REQUIRED');
    expect(
      cancelNoteOf(body({ reason_code: 'other', reason: ' abc ' })),
    ).toEqual({ code: 'other', note: 'Khác: abc' });
    expect(
      cancelNoteOf(body({ reason_code: 'other', reason: '😀😀😀' })).note,
    ).toBe('Khác: 😀😀😀');
  });

  it.each([
    ['not_needed', 'Người nhận không cần nữa'],
    ['user_left', 'Người đã nghỉ'],
    ['adm_out_of_stock', 'NCC hết hàng'],
  ] as const)(
    '%s không ghi chú → "%s"; có ghi chú → nhãn + ": " + ghi chú',
    (code, label) => {
      expect(cancelNoteOf(body({ reason_code: code })).note).toBe(label);
      expect(
        cancelNoteOf(body({ reason_code: code, reason: '   ' })).note,
      ).toBe(label);
      expect(
        cancelNoteOf(body({ reason_code: code, reason: ' x ' })).note,
      ).toBe(`${label}: x`);
    },
  );
});
