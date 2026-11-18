import { describe, expect, it } from 'vitest';
import { A, B, C, D, PEOPLE, person, pLine } from './people-fixtures';
import { listPeople, parsePeopleTab, peopleTabs } from './people-tabs';

const subs = (list: { user_sub: string }[]) => list.map((p) => p.user_sub);

describe('peopleTabs — 5 thẻ số Giao hàng (TC-04)', () => {
  it('kịch bản chuẩn (bút tủ 7: A 3 trước, B 10; giấy tủ 5): Chưa nhận A B C · Giao được ngay A C · Giao một phần B · Đã nhận đủ D · Người đã nghỉ 0', () => {
    const tabs = peopleTabs(PEOPLE);
    expect(subs(tabs.pending)).toEqual(['u-a', 'u-b', 'u-c']);
    expect(subs(tabs.ready)).toEqual(['u-a', 'u-c']);
    expect(subs(tabs.partial)).toEqual(['u-b']);
    expect(subs(tabs.done)).toEqual(['u-d']);
    expect(tabs.left).toEqual([]);
  });

  it('biên tủ: cần 3, tủ 3 → Giao được ngay; tủ 2 → Giao một phần; tủ 0 → không ở cả hai, vẫn Chưa nhận', () => {
    const at = (stock: number) => peopleTabs([person({ lines: [pLine({ qty: 3, remaining_qty: 3, stock_qty: stock })] })]);
    expect(subs(at(3).ready)).toEqual(['u-a']);
    expect(at(3).partial).toEqual([]);
    expect(at(2).ready).toEqual([]);
    expect(subs(at(2).partial)).toEqual(['u-a']);
    expect(at(0).ready).toEqual([]);
    expect(at(0).partial).toEqual([]);
    expect(subs(at(0).pending)).toEqual(['u-a']);
  });

  it('người đã nghỉ còn phần → thẻ Người đã nghỉ, không vào Giao được ngay; đã nghỉ mà nhận đủ → không', () => {
    const gone = person({ user_sub: 'u-x', user_status: 'locked' });
    const goneDone = { ...D, user_sub: 'u-y', user_status: 'no_access' };
    const tabs = peopleTabs([gone, goneDone]);
    expect(subs(tabs.left)).toEqual(['u-x']);
    expect(tabs.ready).toEqual([]);
    expect(subs(tabs.done)).toEqual(['u-y']);
  });

  it('số trên thẻ = số dòng khi lọc thẻ đó', () => {
    const tabs = peopleTabs(PEOPLE);
    for (const tab of ['pending', 'ready', 'partial', 'done', 'left'] as const) expect(listPeople(PEOPLE, tabs, tab, '')).toHaveLength(tabs[tab].length);
  });
});

describe('listPeople', () => {
  const find = (q: string, people = PEOPLE) => subs(listPeople(people, peopleTabs(people), 'pending', q));
  it('có từ khóa thì tìm trên mọi trạng thái: "linh" ra D dù đang ở thẻ Chưa nhận', () => {
    expect(find('linh')).toEqual(['u-d']);
  });
  it('bỏ dấu, không phân biệt hoa thường: "binh" khớp "Lê Thị Bình", " KIEN TRUC " khớp phòng', () => {
    expect(find('binh')).toEqual(['u-b']);
    expect(find(' KIEN TRUC ')).toEqual(['u-c']);
  });
  it('không khớp → rỗng; tên null không làm vỡ', () => {
    expect(find('zzz')).toEqual([]);
    expect(find('x', [person({ user_sub: 'u-x', full_name: null, department: null })])).toEqual([]);
  });
});

describe('parsePeopleTab', () => {
  it('?tab= lạ hay tab cũ (debt, all) → Chưa nhận; tab mới giữ nguyên', () => {
    expect(parsePeopleTab(null)).toBe('pending');
    expect(parsePeopleTab('debt')).toBe('pending');
    expect(parsePeopleTab('all')).toBe('pending');
    expect(parsePeopleTab('left')).toBe('left');
    expect(parsePeopleTab('ready')).toBe('ready');
  });
});

describe('fixtures', () => {
  it('A, B, C, D như kịch bản', () => {
    expect([A, B, C, D].map((p) => p.status)).toEqual(['pending', 'pending', 'debt', 'done']);
  });
});
