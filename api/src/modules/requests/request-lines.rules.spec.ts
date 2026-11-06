import { isDeletable, isMemberReadonly } from './request-lines.rules';
import type { LineState, ReviewStatus } from './request-lines.rules';

const line = (over: Partial<LineState> = {}): LineState => ({
  added_by_admin: false,
  review_status: 'n/a',
  delivered_qty: 0,
  ...over,
});

describe('isMemberReadonly', () => {
  it.each<[ReviewStatus, boolean]>([
    ['n/a', false],
    ['pending', false],
    ['accepted', true],
    ['converted', true],
    ['rejected', true],
  ])('review_status %p → %p', (status, expected) => {
    expect(isMemberReadonly(line({ review_status: status }))).toBe(expected);
  });

  it('dòng Hành chính thêm → chỉ đọc', () => {
    expect(isMemberReadonly(line({ added_by_admin: true }))).toBe(true);
  });

  it('đã giao 1 → chỉ đọc; chưa giao → sửa được', () => {
    expect(isMemberReadonly(line({ delivered_qty: 1 }))).toBe(true);
    expect(isMemberReadonly(line({ delivered_qty: 0 }))).toBe(false);
  });
});

describe('isDeletable (nhân viên vắng dòng = bỏ)', () => {
  it.each<[ReviewStatus, boolean]>([
    ['n/a', true],
    ['pending', true],
    ['accepted', false],
    ['converted', false],
    ['rejected', false],
  ])('review_status %p, chưa giao → %p', (status, expected) => {
    expect(isDeletable(line({ review_status: status }))).toBe(expected);
  });

  it('đã giao 1 → không xóa được', () => {
    expect(isDeletable(line({ delivered_qty: 1 }))).toBe(false);
  });

  it('dòng Hành chính thêm → không xóa được', () => {
    expect(isDeletable(line({ added_by_admin: true }))).toBe(false);
  });
});
