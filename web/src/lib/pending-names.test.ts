import { describe, expect, it } from 'vitest';
import { MAX_PENDING_NAMES, pendingNames, pendingNamesText } from './pending-names';

const t = (k: string, o?: Record<string, unknown>) => `${k}:${String(o?.k)}`;

describe('pendingNames', () => {
  it('tối đa 5 tên, phần dư thành số món nữa (theo tổng nếu có)', () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    expect(MAX_PENDING_NAMES).toBe(5);
    expect(pendingNames(names)).toEqual({ shown: ['a', 'b', 'c', 'd', 'e'], more: 2 });
    expect(pendingNames(['a'], 4)).toEqual({ shown: ['a'], more: 3 });
  });

  it('chuỗi: nối bằng dấu phẩy, thêm "(và k món nữa)" khi dư', () => {
    expect(pendingNamesText(['a', 'b'], t)).toBe('a, b');
    expect(pendingNamesText(['a', 'b', 'c', 'd', 'e', 'f'], t)).toBe('a, b, c, d, e warn.W8more:1');
  });
});
