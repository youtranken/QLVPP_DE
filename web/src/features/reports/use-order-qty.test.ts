import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useOrderQty } from './use-order-qty';
import { orderTextError } from './use-order-qty';
import { defaultOrder } from '@/lib/report-qty';
import { reportFixture } from './reports-fixtures';

const report = reportFixture();
const PEN = report.byItem[0].key;
const TAPE = report.custom[0].key;

function setup() {
  return renderHook(() => useOrderQty(report));
}

describe('useOrderQty — ô Đề nghị', () => {
  it('mặc định = số gộp (đăng ký + nợ, không trừ tủ), chưa có ô nào sửa', () => {
    const { result } = setup();
    expect(result.current.value(PEN)).toBe(String(defaultOrder(report.byItem[0])));
    expect(result.current.value(TAPE)).toBe(String(defaultOrder(report.custom[0])));
    expect(result.current.edited).toEqual({});
    expect(result.current.isEdited(PEN)).toBe(false);
    expect(result.current.invalid).toBe(false);
  });

  it('sửa 7 → edited chỉ có khóa đó; sửa về đúng số gợi ý → không còn là ô đã sửa', () => {
    const { result } = setup();
    act(() => result.current.set(PEN, '7'));
    expect(result.current.edited).toEqual({ [PEN]: 7 });
    expect(result.current.isEdited(PEN)).toBe(true);
    expect(result.current.isEdited(TAPE)).toBe(false);
    act(() => result.current.set(PEN, String(defaultOrder(report.byItem[0]))));
    expect(result.current.edited).toEqual({});
    expect(result.current.isEdited(PEN)).toBe(false);
  });

  it.each([
    ['0', 0],
    ['1000', 1000],
  ])('biên hợp lệ "%s" → gửi %d', (text, n) => {
    const { result } = setup();
    act(() => result.current.set(PEN, text));
    expect(result.current.hasError(PEN)).toBe(false);
    expect(result.current.edited).toEqual({ [PEN]: n });
  });

  it.each(['-1', '1001', '1.5', '', 'abc'])('"%s" → lỗi tại ô, không gửi, cả bảng invalid', (text) => {
    const { result } = setup();
    act(() => result.current.set(PEN, text));
    expect(result.current.hasError(PEN)).toBe(true);
    expect(result.current.hasError(TAPE)).toBe(false);
    expect(result.current.edited).toEqual({});
    expect(result.current.invalid).toBe(true);
  });

  it('reset → về số gợi ý', () => {
    const { result } = setup();
    act(() => result.current.set(PEN, '-1'));
    act(() => result.current.reset(PEN));
    expect(result.current.value(PEN)).toBe(String(defaultOrder(report.byItem[0])));
    expect(result.current.hasError(PEN)).toBe(false);
    expect(result.current.dirty).toBe(false);
  });

  it('server VALIDATION order_qty.<key> → lỗi đúng ô đó cho tới khi sửa lại ô', () => {
    const { result } = setup();
    act(() => result.current.set(TAPE, '5'));
    act(() => result.current.reject([`order_qty.${TAPE}`, 'kind']));
    expect(result.current.hasError(TAPE)).toBe(true);
    expect(result.current.hasError(PEN)).toBe(false);
    expect(result.current.invalid).toBe(true);
    act(() => result.current.set(TAPE, '6'));
    expect(result.current.hasError(TAPE)).toBe(false);
    expect(result.current.invalid).toBe(false);
  });

  it('đếm ô: errorCount gồm ô gõ sai + ô server từ chối; editedCount gồm ô khác số gợi ý và ô sai; resetAll về số gợi ý hết', () => {
    const { result } = setup();
    act(() => result.current.set(PEN, '1001'));
    act(() => result.current.set(TAPE, '7'));
    expect(result.current.errorCount).toBe(1);
    expect(result.current.editedCount).toBe(2);
    act(() => result.current.reject([`order_qty.${TAPE}`]));
    expect(result.current.errorCount).toBe(2);
    act(() => result.current.resetAll());
    expect(result.current.errorCount).toBe(0);
    expect(result.current.editedCount).toBe(0);
    expect(result.current.dirty).toBe(false);
    expect(result.current.value(TAPE)).toBe(String(defaultOrder(report.custom[0])));
  });

  it('số mặc định hệ thống > 1000: không đỏ, không kẹp, không chặn; chỉ đánh dấu vượt trần để hiện ghi chú vàng', () => {
    const big = { ...report, byItem: [{ ...report.byItem[0], requested: 1200, backlog_prev: 0, adm_owed: 0, left_excluded: 0 }] };
    const { result } = renderHook(() => useOrderQty(big));
    expect(result.current.value(PEN)).toBe('1200');
    expect(result.current.hasError(PEN)).toBe(false);
    expect(result.current.overMax(PEN)).toBe(true);
    expect(result.current.errorCount).toBe(0);
    expect(result.current.edited).toEqual({});
  });

  it('số khởi tạo từ bản đã gửi > 1000 khác mặc định sống (sẽ gửi đi) → đỏ kèm lý do "bản đã gửi"; gõ 1000 → hết đỏ, gửi 1000', () => {
    const { result } = renderHook(() => useOrderQty(report, { initial: { [PEN]: 1200 } }));
    expect(result.current.hasError(PEN)).toBe(true);
    expect(result.current.errorOf(PEN)).toBe('sent');
    expect(result.current.overMax(PEN)).toBe(false);
    expect(result.current.errorCount).toBe(1);
    expect(result.current.invalid).toBe(true);
    expect(result.current.edited).toEqual({});
    act(() => result.current.set(PEN, '1500'));
    expect(result.current.errorOf(PEN)).toBe('max');
    act(() => result.current.set(PEN, '1000'));
    expect(result.current.hasError(PEN)).toBe(false);
    expect(result.current.edited).toEqual({ [PEN]: 1000 });
  });

  it('số > 1000 bằng đúng mặc định sống (không gửi đi) → chỉ ghi chú vàng, kể cả khởi tạo từ bản đã gửi hay người dùng gõ lại đúng số đó', () => {
    const big = { ...report, byItem: [{ ...report.byItem[0], requested: 1200, backlog_prev: 0, adm_owed: 0, left_excluded: 0 }] };
    const { result } = renderHook(() => useOrderQty(big, { initial: { [PEN]: 1200 } }));
    expect(result.current.hasError(PEN)).toBe(false);
    expect(result.current.overMax(PEN)).toBe(true);
    act(() => result.current.set(PEN, '1300'));
    expect(result.current.errorOf(PEN)).toBe('max');
    act(() => result.current.set(PEN, '1200'));
    expect(result.current.hasError(PEN)).toBe(false);
    expect(result.current.overMax(PEN)).toBe(true);
    expect(result.current.edited).toEqual({});
  });

  it('ô sai dạng → lỗi "invalid"', () => {
    const { result } = setup();
    act(() => result.current.set(PEN, 'abc'));
    expect(result.current.errorOf(PEN)).toBe('invalid');
  });
});

describe('orderTextError — lý do sai dạng của ô Đề nghị', () => {
  it('"0" và "1000" hợp lệ (null); "2.5" → decimal; "2,5" → decimal; "-1" → negative; "" và "abc" → invalid', () => {
    expect(orderTextError('0')).toBeNull();
    expect(orderTextError('1000')).toBeNull();
    expect(orderTextError('2.5')).toBe('decimal');
    expect(orderTextError('2,5')).toBe('decimal');
    expect(orderTextError('-1')).toBe('negative');
    expect(orderTextError('')).toBe('invalid');
    expect(orderTextError('abc')).toBe('invalid');
  });
});
