import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useOrderQty } from './use-order-qty';
import { reportFixture } from './reports-fixtures';

const report = reportFixture();
const PEN = report.byItem[0].key;
const TAPE = report.custom[0].key;

function setup() {
  return renderHook(() => useOrderQty(report));
}

describe('useOrderQty — ô Đặt mua', () => {
  it('mặc định = Cần mua, chưa có ô nào sửa', () => {
    const { result } = setup();
    expect(result.current.value(PEN)).toBe(String(report.byItem[0].need));
    expect(result.current.value(TAPE)).toBe(String(report.custom[0].need));
    expect(result.current.edited).toEqual({});
    expect(result.current.isEdited(PEN)).toBe(false);
    expect(result.current.invalid).toBe(false);
  });

  it('sửa 7 → edited chỉ có khóa đó; sửa về đúng Cần mua → không còn là ô đã sửa', () => {
    const { result } = setup();
    act(() => result.current.set(PEN, '7'));
    expect(result.current.edited).toEqual({ [PEN]: 7 });
    expect(result.current.isEdited(PEN)).toBe(true);
    expect(result.current.isEdited(TAPE)).toBe(false);
    act(() => result.current.set(PEN, String(report.byItem[0].need)));
    expect(result.current.edited).toEqual({});
    expect(result.current.isEdited(PEN)).toBe(false);
  });

  it.each([
    ['0', 0],
    ['99999', 99999],
  ])('biên hợp lệ "%s" → gửi %d', (text, n) => {
    const { result } = setup();
    act(() => result.current.set(PEN, text));
    expect(result.current.hasError(PEN)).toBe(false);
    expect(result.current.edited).toEqual({ [PEN]: n });
  });

  it.each(['-1', '100000', '1.5', '', 'abc'])('"%s" → lỗi tại ô, không gửi, cả bảng invalid', (text) => {
    const { result } = setup();
    act(() => result.current.set(PEN, text));
    expect(result.current.hasError(PEN)).toBe(true);
    expect(result.current.hasError(TAPE)).toBe(false);
    expect(result.current.edited).toEqual({});
    expect(result.current.invalid).toBe(true);
  });

  it('reset → về Cần mua', () => {
    const { result } = setup();
    act(() => result.current.set(PEN, '-1'));
    act(() => result.current.reset(PEN));
    expect(result.current.value(PEN)).toBe(String(report.byItem[0].need));
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

  it('đếm ô: errorCount gồm ô gõ sai + ô server từ chối; editedCount gồm ô khác Cần mua và ô sai; resetAll về Cần mua hết', () => {
    const { result } = setup();
    act(() => result.current.set(PEN, '100000'));
    act(() => result.current.set(TAPE, '7'));
    expect(result.current.errorCount).toBe(1);
    expect(result.current.editedCount).toBe(2);
    act(() => result.current.reject([`order_qty.${TAPE}`]));
    expect(result.current.errorCount).toBe(2);
    act(() => result.current.resetAll());
    expect(result.current.errorCount).toBe(0);
    expect(result.current.editedCount).toBe(0);
    expect(result.current.dirty).toBe(false);
    expect(result.current.value(TAPE)).toBe(String(report.custom[0].need));
  });
});
