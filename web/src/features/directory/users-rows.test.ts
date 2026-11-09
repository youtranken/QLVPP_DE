import { describe, expect, it } from 'vitest';
import { applyUsersView, departmentsOf, parseRegFilter, parseUsersFilter, regOf, usersStats } from './users-rows';
import type { AdminUser } from './directory.api';

const u = (sub: string, over: Partial<AdminUser> = {}): AdminUser => ({
  sub, fullName: sub, email: null, department: null, status: 'active', employeeCode: null, team: null, role: 'member', lastLoginAt: '2026-10-27T02:30:00.000Z', ...over,
});
const USERS = [
  u('an', { department: 'Phòng Công trình', employeeCode: 'NV0231', email: 'an@pmh.com.vn' }),
  u('binh', { department: 'Phòng Kế toán', status: 'locked', lastLoginAt: null }),
  u('chi', { department: 'Phòng Công trình', lastLoginAt: null }),
  u('dung', { status: 'no_access', team: 'QS' }),
];

describe('users-rows', () => {
  it('đếm thẻ: đang dùng 2 · đã khóa 1 · không còn quyền 1', () => {
    expect(usersStats(USERS)).toEqual({ active: 2, locked: 1, no_access: 1 });
  });

  it('lọc theo từng thẻ và phòng ban', () => {
    const view = { filter: null, reg: null, dept: '', q: '' };
    expect(applyUsersView(USERS, { ...view, filter: 'locked' }, true).map((x) => x.sub)).toEqual(['binh']);
    expect(applyUsersView(USERS, { ...view, filter: 'no_access' }, true).map((x) => x.sub)).toEqual(['dung']);
    expect(applyUsersView(USERS, { ...view, filter: 'active' }, true).map((x) => x.sub)).toEqual(['an', 'chi']);
    expect(applyUsersView(USERS, { ...view, dept: 'Phòng Công trình' }, true).map((x) => x.sub)).toEqual(['an', 'chi']);
    expect(applyUsersView(USERS, { ...view, filter: 'active', dept: 'Phòng Công trình' }, true).map((x) => x.sub)).toEqual(['an', 'chi']);
  });

  it('tìm không dấu theo tên, email, mã NV; clientSearch=false bỏ qua ô tìm (server đã lọc)', () => {
    expect(applyUsersView(USERS, { filter: null, reg: null, dept: '', q: 'nv0231' }, true).map((x) => x.sub)).toEqual(['an']);
    expect(applyUsersView(USERS, { filter: null, reg: null, dept: '', q: 'an@pmh' }, true).map((x) => x.sub)).toEqual(['an']);
    expect(applyUsersView(USERS, { filter: null, reg: null, dept: '', q: 'zzz' }, false)).toHaveLength(4);
    expect(applyUsersView(USERS, { filter: null, reg: null, dept: '', q: 'qs' }, true).map((x) => x.sub)).toEqual(['dung']);
  });

  it('phòng ban dẫn xuất: bỏ trống, bỏ trùng, xếp theo tiếng Việt', () => {
    expect(departmentsOf([...USERS, u('d')])).toEqual(['Phòng Công trình', 'Phòng Kế toán']);
  });

  it('parseUsersFilter chỉ nhận active|locked|no_access|deleted; parseRegFilter chỉ yes|no', () => {
    expect(['active', 'never', 'locked', 'no_access', 'deleted', 'x', null].map(parseUsersFilter)).toEqual(['active', null, 'locked', 'no_access', 'deleted', null, null]);
    expect(['yes', 'no', 'YES', '', null].map(parseRegFilter)).toEqual(['yes', 'no', null, null, null]);
  });

  it('lọc đăng ký: yes/no theo tập của kỳ; người ngoài cả hai tập không vào lọc nào; chưa có dữ liệu → chưa ra ai', () => {
    const sets = { registered: new Set(['an']), unregistered: new Set(['chi']) };
    const view = { filter: null, dept: '', q: '' };
    expect(applyUsersView(USERS, { ...view, reg: 'yes' }, true, sets).map((x) => x.sub)).toEqual(['an']);
    expect(applyUsersView(USERS, { ...view, reg: 'no' }, true, sets).map((x) => x.sub)).toEqual(['chi']);
    expect(applyUsersView(USERS, { ...view, reg: 'no' }, true, null)).toEqual([]);
    expect(USERS.map((x) => regOf(x, sets))).toEqual(['yes', null, 'no', null]);
  });
});
