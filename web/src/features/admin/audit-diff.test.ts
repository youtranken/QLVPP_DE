import { describe, expect, it } from 'vitest';
import { changedFields, otherDetail } from './audit-diff';

describe('changedFields', () => {
  it('chỉ liệt kê khóa khác nhau giữa before và after', () => {
    expect(changedFields({ a: 1, b: 'x', c: { k: 1 } }, { a: 1, b: 'y', c: { k: 1 } })).toEqual([{ key: 'b', before: '"x"', after: '"y"' }]);
  });

  it('khóa chỉ có một phía hiện giá trị phía kia là rỗng; một phía null coi như {}', () => {
    expect(changedFields({ a: 1 }, { a: 1, b: 2 })).toEqual([{ key: 'b', before: null, after: '2' }]);
    expect(changedFields(null, { n: 'A' })).toEqual([{ key: 'n', before: null, after: '"A"' }]);
  });

  it('không phải object cả hai phía thì không có bảng', () => {
    expect(changedFields('x', undefined)).toBeNull();
    expect(changedFields([1], 3)).toBeNull();
  });
});

describe('otherDetail', () => {
  it('trả các khóa ngoài before/after; detail không phải object thì rỗng', () => {
    expect(otherDetail({ before: {}, after: {}, self: true })).toEqual([{ key: 'self', value: 'true' }]);
    expect(otherDetail(null)).toEqual([]);
    expect(otherDetail({ ip: '10.0.0.5' })).toEqual([{ key: 'ip', value: '"10.0.0.5"' }]);
  });
});
