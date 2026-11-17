import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';

// Giao diện A (L10–L12, H): tên app một cách gọi, câu đăng nhập lỗi nói đúng nút, số ít tiếng Anh, thông báo người đã nghỉ
const VI = i18n.getFixedT('vi');
const EN = i18n.getFixedT('en');

describe('Câu chữ còn lệch sau rà soát giao diện A', () => {
  it('tên app "QLVPP" ở thanh trên (app.title) và đầu menu quản lý (vi, en)', () => {
    expect(VI('app.title')).toBe('QLVPP');
    expect(EN('app.title')).toBe('QLVPP');
    expect(VI('nav.mobile.menuBrand')).toBe('QLVPP · Adm D&E');
    expect(EN('nav.mobile.menuBrand')).toBe('QLVPP · D&E Admin');
  });

  it('?login=failed nói đúng nút "Tiếp tục"', () => {
    expect(VI('auth.loginFailed')).toBe('Đăng nhập chưa thành công — bấm Tiếp tục để thử lại.');
    expect(EN('auth.loginFailed')).toMatch(/Continue/);
  });

  it('en: "1 person" / "2 people" ở cột Ai đăng ký', () => {
    expect(EN('reports.send.who', { count: 1 })).toBe('1 person');
    expect(EN('reports.send.who', { count: 2 })).toBe('2 people');
  });

  it('en: mục menu Báo cáo đủ ngắn để không bị cắt (≤ 18 ký tự)', () => {
    expect(EN('nav.reports').length).toBeLessThanOrEqual(18);
  });

  it('thông báo người rời đi còn việc dở: gọi "Người đã nghỉ", không "bị xóa"', () => {
    const text = VI('notifications.topics.user_left_with_work.deleted', { name: 'An', work: '2 phiếu' });
    expect(text).not.toMatch(/bị xóa/);
    expect(text).toMatch(/đã nghỉ/);
  });

  it('một chữ "Tủ" cho số đang có trong tủ (chủ dự án chốt 17/11): không còn "Tồn kho"/"Tồn hiện tại"/"Tồn sau"', () => {
    expect(VI('stock.issues.tabStock')).toBe('Trong tủ');
    expect(VI('catalog.list.colStock')).toBe('Tủ');
    expect(VI('arrivals.table.stock')).toBe('Tủ');
    expect(VI('stock.dialog.current', { qty: 20, unit: 'ram' })).toBe('Tủ: 20 ram');
    expect(VI('stock.dialog.after', { qty: 3 })).toBe('Tủ sau khi lưu 3');
    const vi = JSON.stringify(i18n.getResourceBundle('vi', 'translation'));
    expect(vi).not.toMatch(/Tồn kho|Tồn hiện tại|Tồn sau/);
  });
});
