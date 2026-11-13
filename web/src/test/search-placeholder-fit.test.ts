import { describe, expect, it } from 'vitest';
import vi from '@/locales/vi';
import en from '@/locales/en';

// Rà soát 13/11 Gu #12: placeholder bị cắt ("Tìm người hoặc món (không cần dấ…" ở Còn nợ 360/390; Danh bạ ở 768).
// Đo trên trình duyệt (14px, Be Vietnam Pro): ô Còn nợ còn 250px ở 360, ô Danh bạ còn 176px ở 768.
// Mức chữ an toàn ≈ 7,5 px/ký tự với chữ thường → giới hạn 23 ký tự cho Danh bạ, 30 cho Còn nợ.
describe('placeholder ô tìm vừa ô ở bề rộng hẹp nhất', () => {
  it.each([
    ['vi', vi],
    ['en', en],
  ])('%s: Còn nợ ≤ 30 ký tự, Danh bạ ≤ 23 ký tự', (_lang, m) => {
    expect(m.delivery.backlog.searchPlaceholder.length).toBeLessThanOrEqual(30);
    expect(m.users.page.search.length).toBeLessThanOrEqual(23);
  });
});
