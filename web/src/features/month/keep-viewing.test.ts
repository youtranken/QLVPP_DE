import { describe, expect, it } from 'vitest';
import { keepViewing } from './keep-viewing';

const r = (id: string) => ({ request_id: id });

describe('keepViewing — Xem phiếu không đóng khi người đang xem vừa ra khỏi bộ lọc (G8: duyệt xong ở chip "Có món chờ duyệt")', () => {
  it('người đang xem còn trong danh sách lọc → giữ nguyên danh sách', () => {
    const visible = [r('a'), r('b')];
    expect(keepViewing(visible, [r('a'), r('b'), r('c')], 'b')).toBe(visible);
  });
  it('vừa ra khỏi bộ lọc nhưng còn trong kỳ → giữ người đó ở đúng vị trí theo thứ tự cả kỳ', () => {
    expect(keepViewing([r('a'), r('c')], [r('a'), r('b'), r('c')], 'b').map((x) => x.request_id)).toEqual(['a', 'b', 'c']);
  });
  it('không còn trong kỳ hoặc không xem ai → danh sách lọc', () => {
    expect(keepViewing([r('a')], [r('a')], 'zz').map((x) => x.request_id)).toEqual(['a']);
    expect(keepViewing([r('a')], [r('a'), r('b')], null).map((x) => x.request_id)).toEqual(['a']);
  });
});
