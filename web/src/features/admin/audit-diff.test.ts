import { describe, expect, it } from 'vitest';
import { auditObjectName, changedFields, otherDetail } from './audit-diff';

describe('changedFields', () => {
  it('chỉ liệt kê khóa khác nhau giữa before và after', () => {
    expect(changedFields({ a: 1, b: 'x', c: { k: 1 } }, { a: 1, b: 'y', c: { k: 2 } })).toEqual([
      { key: 'b', before: 'x', after: 'y' },
      { key: 'c', before: '{"k":1}', after: '{"k":2}' },
    ]);
  });

  it('khóa chỉ có một phía hiện giá trị phía kia là rỗng; một phía null coi như {}', () => {
    expect(changedFields({ a: 1 }, { a: 1, b: 2 })).toEqual([{ key: 'b', before: null, after: '2' }]);
    expect(changedFields(null, { n: 'A' })).toEqual([{ key: 'n', before: null, after: 'A' }]);
    expect(changedFields({ r: 'u-1' }, { r: null })).toEqual([{ key: 'r', before: 'u-1', after: null }]);
  });

  it('không phải object cả hai phía thì không có bảng', () => {
    expect(changedFields('x', undefined)).toBeNull();
    expect(changedFields([1], 3)).toBeNull();
  });
});

describe('otherDetail', () => {
  it('trả các khóa ngoài before/after (chuỗi không ngoặc kép, null là rỗng); detail không phải object thì rỗng', () => {
    expect(otherDetail({ before: {}, after: {}, self: true })).toEqual([{ key: 'self', value: 'true' }]);
    expect(otherDetail(null)).toEqual([]);
    expect(otherDetail({ ip: '10.0.0.5', recipient_sub: null })).toEqual([
      { key: 'ip', value: '10.0.0.5' },
      { key: 'recipient_sub', value: null },
    ]);
  });
});

describe('auditObjectName', () => {
  it('lấy name rồi custom_name ở after, rồi before; không có thì null', () => {
    expect(auditObjectName({ before: { name: 'Cũ' }, after: { name: 'Mới' } })).toBe('Mới');
    expect(auditObjectName({ before: { custom_name: 'Băng keo' }, after: { review_status: 'accepted' } })).toBe('Băng keo');
    expect(auditObjectName({ before: null, after: { name: '  ' } })).toBeNull();
    expect(auditObjectName({ before: { stock_qty: 1 }, after: { stock_qty: 2 } })).toBeNull();
    expect(auditObjectName(null)).toBeNull();
  });
});
