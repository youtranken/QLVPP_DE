import { describe, expect, it } from 'vitest';
import { backlogMonths, leftPeople, monthsOf } from './backlog-months';
import { backlogLine, personGroup } from './backlog-fixtures';

const none = { ym: null, q: '', left: false };
const duc9 = backlogLine({ line_id: 'd9', period_ym: '2026-09', qty: 4, delivered_qty: 1, remaining_qty: 3 });
const duc10 = backlogLine({ line_id: 'd10', period_ym: '2026-10', name: 'Kẹp giấy', item_id: 'i-clip', qty: 2, delivered_qty: 0, remaining_qty: 2 });
const lan10 = backlogLine({ line_id: 'l10', period_ym: '2026-10', user_sub: 'u-lan', full_name: 'Võ Thị Lan', department: 'Kế toán', user_status: 'locked', name: 'Bút bi xanh', qty: 1, delivered_qty: 0, remaining_qty: 1 });
const groups = [personGroup([duc9, duc10]), personGroup([lan10], 'Kế toán')];

describe('backlogMonths', () => {
  it('dòng kỳ 9 và 10 của hai người → hai nhóm tháng, Tháng 9 trước', () => {
    const months = backlogMonths(groups, none);
    expect(months.map((m) => m.ym)).toEqual(['2026-09', '2026-10']);
    expect(months[0].people.map((p) => p.user_sub)).toEqual(['u-duc']);
    expect(months[1].people.map((p) => p.user_sub)).toEqual(['u-lan', 'u-duc']);
  });

  it('trong tháng: phòng ban rồi tên (Kế toán trước Tổ Giám sát)', () => {
    expect(backlogMonths(groups, none)[1].people.map((p) => p.department)).toEqual(['Kế toán', 'Tổ Giám sát']);
  });

  it('owed_units = Σ remaining của người, của tháng; dòng giữ thứ tự server', () => {
    const [m9, m10] = backlogMonths(groups, none);
    expect(m9.owed_units).toBe(3);
    expect(m10.owed_units).toBe(3);
    expect(m10.people.find((p) => p.user_sub === 'u-duc')).toMatchObject({ owed_units: 2 });
    const same = backlogMonths([personGroup([backlogLine({ line_id: 'a', remaining_qty: 1 }), backlogLine({ line_id: 'b', remaining_qty: 2 })])], none);
    expect(same[0].people[0].lines.map((l) => l.line_id)).toEqual(['a', 'b']);
    expect(same[0].people[0].owed_units).toBe(3);
  });

  it('lọc ym chỉ còn tháng đó', () => {
    expect(backlogMonths(groups, { ...none, ym: '2026-10' }).map((m) => m.ym)).toEqual(['2026-10']);
  });

  it('q khớp tên món (không dấu) hoặc tên người; người khớp tên giữ mọi dòng', () => {
    expect(backlogMonths(groups, { ...none, q: 'kep' }).flatMap((m) => m.people.flatMap((p) => p.lines.map((l) => l.line_id)))).toEqual(['d10']);
    const byPerson = backlogMonths(groups, { ...none, q: 'duc' }).flatMap((m) => m.people.flatMap((p) => p.lines.map((l) => l.line_id)));
    expect(byPerson).toEqual(['d9', 'd10']);
    expect(backlogMonths(groups, { ...none, q: 'zzz' })).toEqual([]);
  });

  it('left chỉ người đã nghỉ', () => {
    const months = backlogMonths(groups, { ...none, left: true });
    expect(months.map((m) => m.ym)).toEqual(['2026-10']);
    expect(months[0].people.map((p) => p.user_sub)).toEqual(['u-lan']);
  });

  it('không có dòng → không tạo nhóm rỗng; phòng ban lấy từ nhãn nhóm (hiện tại), không từ phiếu', () => {
    expect(backlogMonths([], none)).toEqual([]);
    expect(backlogMonths([personGroup([lan10], null)], none)[0].people[0].department).toBeNull();
  });

  it('monthsOf, leftPeople', () => {
    expect(monthsOf(groups)).toEqual(['2026-09', '2026-10']);
    expect(leftPeople(groups)).toBe(1);
  });
});
