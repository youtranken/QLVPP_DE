import { describe, expect, it } from 'vitest';
import { SUMMARY_KEY, keepWithinMonth } from './summary.api';

// Kỳ tháng: đổi tìm/lọc trong cùng tháng giữ danh sách cũ (không chớp); sang tháng khác thì bỏ (không tính bằng người tháng trước)
describe('keepWithinMonth — giữ dữ liệu người theo tháng', () => {
  const prev = { pages: [] };
  const key = (ym: string) => ({ queryKey: [...SUMMARY_KEY, ym, 'person', 'all', ''] });

  it('cùng tháng → giữ', () => {
    expect(keepWithinMonth('2026-11')(prev, key('2026-11'))).toBe(prev);
  });

  it('khác tháng hoặc chưa có truy vấn trước → bỏ', () => {
    expect(keepWithinMonth('2026-11')(prev, key('2026-10'))).toBeUndefined();
    expect(keepWithinMonth('2026-11')(prev, undefined)).toBeUndefined();
  });
});
