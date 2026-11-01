import { countDelta, countNote } from './stock-count';

const codeOf = (run: () => unknown) => {
  try {
    run();
  } catch (e) {
    return (e as { getResponse: () => object }).getResponse();
  }
  return null;
};

describe('kiểm kê: luật số đếm', () => {
  it('đếm 5 khi tồn 3 (đúng expected) → delta +2; đếm 0 khi tồn 3 → −3', () => {
    expect(countDelta({ counted: 5, expected: 3, stock: 3 })).toBe(2);
    expect(countDelta({ counted: 0, expected: 3, stock: 3 })).toBe(-3);
  });

  it('expected lệch 1 so với tồn (2 hoặc 4 khi tồn 3) → STALE_UPDATE {stock_qty: 3}', () => {
    for (const expected of [2, 4]) {
      expect(
        codeOf(() => countDelta({ counted: 5, expected, stock: 3 })),
      ).toMatchObject({ code: 'STALE_UPDATE', stock_qty: 3 });
    }
  });

  it('đếm bằng đúng tồn → VALIDATION (không có gì để ghi); lệch 1 (2 hoặc 4) → ghi được', () => {
    expect(
      codeOf(() => countDelta({ counted: 3, expected: 3, stock: 3 })),
    ).toMatchObject({ code: 'VALIDATION', fields: ['counted_qty'] });
    expect(countDelta({ counted: 2, expected: 3, stock: 3 })).toBe(-1);
    expect(countDelta({ counted: 4, expected: 3, stock: 3 })).toBe(1);
  });

  it('lý do trim 2 ký tự hoặc thiếu → REASON_REQUIRED; trim 3 ký tự → trả lý do đã trim', () => {
    for (const note of [undefined, null, '  ab  ', '   ']) {
      expect(codeOf(() => countNote(note))).toMatchObject({
        code: 'REASON_REQUIRED',
      });
    }
    expect(countNote('  abc  ')).toBe('abc');
  });
});
