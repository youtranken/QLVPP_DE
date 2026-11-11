import { describe, expect, it } from 'vitest';
import { receiptOf } from './ledger-lines';

describe('receiptOf', () => {
  it('có receipt_ym: hàng về kỳ / về bù kỳ, tách ghi chú người gõ', () => {
    expect(receiptOf({ receipt_ym: '2026-11', note: 'Hàng về kỳ 2026-11' })).toEqual({ kind: 'arrival', ym: '2026-11', rest: null });
    expect(receiptOf({ receipt_ym: '2026-10', note: 'Về bù kỳ 2026-10 · đợt 1' })).toEqual({ kind: 'makeup', ym: '2026-10', rest: 'đợt 1' });
  });

  it('dòng "Về bù kỳ" cũ không có receipt_ym vẫn là về bù (không thành nhập ngoài kỳ)', () => {
    expect(receiptOf({ receipt_ym: null, note: 'Về bù kỳ 2026-09 · giao thiếu' })).toEqual({ kind: 'makeup', ym: '2026-09', rest: 'giao thiếu' });
    expect(receiptOf({ note: 'Về bù kỳ 2026-09' })).toEqual({ kind: 'makeup', ym: '2026-09', rest: null });
  });

  it('nhập ngoài kỳ (không receipt_ym, ghi chú thường) → null', () => {
    expect(receiptOf({ receipt_ym: null, note: 'Đơn số 12' })).toBeNull();
    expect(receiptOf({ receipt_ym: null, note: null })).toBeNull();
  });
});
