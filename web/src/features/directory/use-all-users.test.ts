import { describe, expect, it } from 'vitest';
import { DIRECTORY_FULL_LOAD_MAX, exceedsFullLoad, loadAllUsers } from './use-all-users';
import type { AdminUser } from './directory.api';

const user = (i: number): AdminUser => ({ sub: `u${i}`, fullName: `N${i}`, email: null, department: null, status: 'active', employeeCode: null, groups: [], lastLoginAt: null });

function pagesOf(total: number, size = 200) {
  const calls: (string | null)[] = [];
  const fetchPage = async (cursor: string | null) => {
    calls.push(cursor);
    const from = cursor ? Number(cursor) : 0;
    const to = Math.min(from + size, total);
    return { items: Array.from({ length: to - from }, (_, i) => user(from + i)), next_cursor: to < total ? String(to) : null };
  };
  return { fetchPage, calls };
}

describe('loadAllUsers (ngưỡng tải hết 2000)', () => {
  it('ngưỡng là 2000', () => {
    expect(DIRECTORY_FULL_LOAD_MAX).toBe(2000);
    expect(exceedsFullLoad(2000)).toBe(false);
    expect(exceedsFullLoad(2001)).toBe(true);
  });

  it('đúng 2000 người → tải hết 10 trang, lọc phía trang (overflow=false)', async () => {
    const { fetchPage, calls } = pagesOf(2000);
    const r = await loadAllUsers(fetchPage);
    expect(r.overflow).toBe(false);
    expect(r.items).toHaveLength(2000);
    expect(calls).toHaveLength(10);
  });

  it('2001 người → overflow=true, chuyển sang tìm ở server (dừng tải ở trang 11)', async () => {
    const { fetchPage, calls } = pagesOf(2001);
    const r = await loadAllUsers(fetchPage);
    expect(r.overflow).toBe(true);
    expect(calls).toHaveLength(11);
  });

  it('danh bạ rỗng → không overflow, không người', async () => {
    const r = await loadAllUsers(pagesOf(0).fetchPage);
    expect(r).toEqual({ items: [], overflow: false });
  });
});
