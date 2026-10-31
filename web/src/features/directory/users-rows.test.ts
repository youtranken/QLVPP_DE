import { describe, expect, it } from 'vitest';
import { applyUsersView, departmentsOf, parseUsersFilter, usersStats } from './users-rows';
import type { AdminUser } from './directory.api';

const u = (sub: string, over: Partial<AdminUser> = {}): AdminUser => ({
  sub, fullName: sub, email: null, department: null, status: 'active', employeeCode: null, groups: [], lastLoginAt: '2026-10-27T02:30:00.000Z', ...over,
});
const USERS = [
  u('an', { department: 'Phòng Công trình', employeeCode: 'NV0231', email: 'an@pmh.com.vn' }),
  u('binh', { department: 'Phòng Kế toán', status: 'locked', lastLoginAt: null }),
  u('chi', { department: 'Phòng Công trình', lastLoginAt: null }),
];

describe('users-rows', () => {
  it('đếm thẻ: đang dùng 2 · chưa đăng nhập 2 · đã khóa 1 (người khóa chưa đăng nhập tính cả hai thẻ)', () => {
    expect(usersStats(USERS)).toEqual({ active: 2, never: 2, locked: 1 });
  });

  it('lọc theo từng thẻ và phòng ban', () => {
    const view = { filter: null, dept: '', q: '' };
    expect(applyUsersView(USERS, { ...view, filter: 'locked' }, true).map((x) => x.sub)).toEqual(['binh']);
    expect(applyUsersView(USERS, { ...view, filter: 'never' }, true).map((x) => x.sub)).toEqual(['binh', 'chi']);
    expect(applyUsersView(USERS, { ...view, dept: 'Phòng Công trình' }, true).map((x) => x.sub)).toEqual(['an', 'chi']);
    expect(applyUsersView(USERS, { filter: 'never', dept: 'Phòng Công trình', q: '' }, true).map((x) => x.sub)).toEqual(['chi']);
  });

  it('tìm không dấu theo tên, email, mã NV; clientSearch=false bỏ qua ô tìm (server đã lọc)', () => {
    expect(applyUsersView(USERS, { filter: null, dept: '', q: 'nv0231' }, true).map((x) => x.sub)).toEqual(['an']);
    expect(applyUsersView(USERS, { filter: null, dept: '', q: 'an@pmh' }, true).map((x) => x.sub)).toEqual(['an']);
    expect(applyUsersView(USERS, { filter: null, dept: '', q: 'zzz' }, false)).toHaveLength(3);
  });

  it('phòng ban dẫn xuất: bỏ trống, bỏ trùng, xếp theo tiếng Việt', () => {
    expect(departmentsOf([...USERS, u('d')])).toEqual(['Phòng Công trình', 'Phòng Kế toán']);
  });

  it('parseUsersFilter chỉ nhận active|never|locked', () => {
    expect(['active', 'never', 'locked', 'x', null].map(parseUsersFilter)).toEqual(['active', 'never', 'locked', null, null]);
  });
});
