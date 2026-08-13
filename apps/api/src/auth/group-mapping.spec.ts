import { describe, expect, it } from 'vitest';
import { DEFAULT_ADMIN_GROUP } from '@vpp/shared';
import { mapGroups } from './group-mapping';

describe('mapGroups', () => {
  it('có group admin ⇒ role admin + phòng ban đầu tiên', () => {
    const id = mapGroups([DEFAULT_ADMIN_GROUP, 'Hành chính'], DEFAULT_ADMIN_GROUP);
    expect(id.role).toBe('admin');
    expect(id.department).toBe('Hành chính');
  });

  it('không có group admin ⇒ member', () => {
    const id = mapGroups(['Kế toán'], DEFAULT_ADMIN_GROUP);
    expect(id.role).toBe('member');
    expect(id.department).toBe('Kế toán');
  });

  it('chỉ có group admin ⇒ không phòng ban', () => {
    const id = mapGroups([DEFAULT_ADMIN_GROUP], DEFAULT_ADMIN_GROUP);
    expect(id.role).toBe('admin');
    expect(id.department).toBeNull();
  });
});
