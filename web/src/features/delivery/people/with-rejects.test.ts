import { describe, expect, it } from 'vitest';
import { pLine } from './people-fixtures';
import { withRejects } from './with-rejects';

type E = { request_id: string; lines: string[]; reject_line_ids?: string[] };
const make = (id: string): E => ({ request_id: id, lines: [] });
const owners: Record<string, string> = { 'r-a0': 'a', 'r-a1': 'a', 'r-a2': 'a', 'r-b': 'b' };
const rv = (line_id: string, request_id: string) => pLine({ line_id, request_id, item_id: null, review_status: 'pending', stock_qty: null });

describe('withRejects', () => {
  it('gắn tại chỗ vào mục cùng phiếu, không đổi thứ tự; không có món chờ → giữ nguyên', () => {
    const entries: E[] = [
      { request_id: 'r-a0', lines: ['debt'] },
      { request_id: 'r-a1', lines: ['cur'] },
      { request_id: 'r-b', lines: ['b'] },
    ];
    expect(withRejects(entries, [rv('x', 'r-a1'), rv('y', 'r-a1')], make, (id) => owners[id])).toEqual([
      { request_id: 'r-a0', lines: ['debt'] },
      { request_id: 'r-a1', lines: ['cur'], reject_line_ids: ['x', 'y'] },
      { request_id: 'r-b', lines: ['b'] },
    ]);
    expect(withRejects(entries, [], make, (id) => owners[id])).toEqual(entries);
  });

  it('phiếu chỉ có món chờ → mục lines rỗng ngay sau mục cuối của cùng người (không cuối danh sách)', () => {
    const entries: E[] = [
      { request_id: 'r-a0', lines: ['debt'] },
      { request_id: 'r-b', lines: ['b'] },
    ];
    expect(withRejects(entries, [rv('x', 'r-a2')], make, (id) => owners[id]).map((e) => e.request_id)).toEqual(['r-a0', 'r-a2', 'r-b']);
  });

  it('không rõ người → cuối danh sách; không sửa mảng gốc', () => {
    const entries: E[] = [{ request_id: 'r-b', lines: ['b'] }];
    const out = withRejects(entries, [rv('z', 'r-zz')], make, (id) => owners[id] ?? `?${id}`);
    expect(out.map((e) => e.request_id)).toEqual(['r-b', 'r-zz']);
    expect(entries).toEqual([{ request_id: 'r-b', lines: ['b'] }]);
  });
});
