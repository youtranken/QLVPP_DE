import type { Pool } from 'pg';
import type { ClockService } from '../../common/clock.service';
import type { PeriodsService } from '../periods/periods.service';
import { FileAccessPolicy } from './file-access.policy';

const ref = (name: string, purpose: 'item_image' | 'line_image') => ({
  name,
  purpose,
  readCondition: `${name}_read`,
  referencedCondition: `${name}_ref`,
});

describe('FileAccessPolicy.cleanupScope — dọn fail-closed theo purpose', () => {
  const policy = () =>
    new FileAccessPolicy({} as Pool, {} as PeriodsService, {} as ClockService);

  it('chưa đăng ký reference nào → null (không dọn gì)', () => {
    expect(policy().cleanupScope()).toBeNull();
  });

  it('chỉ có reference item_image → chỉ dọn purpose item_image, giữ tệp khớp bất kỳ reference nào', () => {
    const p = policy();
    p.registerReference(ref('items', 'item_image'));
    expect(p.cleanupScope()).toEqual({
      purposes: ['item_image'],
      referencedSql: '(items_ref)',
    });
  });

  it('nhiều reference → purpose không lặp, điều kiện giữ là OR của tất cả', () => {
    const p = policy();
    p.registerReference(ref('items', 'item_image'));
    p.registerReference(ref('lines', 'line_image'));
    p.registerReference(ref('items_from_lines', 'line_image'));
    expect(p.cleanupScope()).toEqual({
      purposes: ['item_image', 'line_image'],
      referencedSql: '(items_ref) OR (lines_ref) OR (items_from_lines_ref)',
    });
  });

  it('đăng ký trùng tên → lỗi', () => {
    const p = policy();
    p.registerReference(ref('items', 'item_image'));
    expect(() => p.registerReference(ref('items', 'item_image'))).toThrow();
  });
});
