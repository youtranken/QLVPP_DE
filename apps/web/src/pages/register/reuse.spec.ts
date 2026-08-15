import { describe, expect, it } from 'vitest';
import { dungLaiDon, type DongDonCu, type MonDanhMuc } from './reuse';

const BUT: MonDanhMuc = { id: 'but', name: 'Bút bi', maxQty: 20, active: true, adminOnly: false };
const A4: MonDanhMuc = { id: 'a4', name: 'Giấy A4', maxQty: 5, active: true, adminOnly: true };
const NGUNG: MonDanhMuc = { id: 'ng', name: 'Sổ cũ', maxQty: 20, active: false, adminOnly: false };
const CATALOG = [BUT, A4, NGUNG];

const dong = (over: Partial<DongDonCu>): DongDonCu => ({
  itemId: null,
  name: 'X',
  unit: 'cái',
  quantity: 1,
  attachmentPath: null,
  ...over,
});

describe('dungLaiDon', () => {
  it('chép lại món còn dùng được', () => {
    const kq = dungLaiDon({
      lines: [dong({ itemId: 'but', name: 'Bút bi', quantity: 3 })],
      catalog: CATALOG,
      isAdmin: false,
    });
    expect(kq.quantities).toEqual({ but: 3 });
    expect(kq.boQua).toEqual([]);
  });

  it('bỏ món đã ngừng cung cấp và nói rõ lý do', () => {
    const kq = dungLaiDon({
      lines: [dong({ itemId: 'ng', name: 'Sổ cũ', quantity: 2 })],
      catalog: CATALOG,
      isAdmin: false,
    });
    expect(kq.quantities).toEqual({});
    expect(kq.boQua[0]).toContain('ngừng cung cấp');
  });

  it('bỏ món không còn trong danh mục', () => {
    const kq = dungLaiDon({
      lines: [dong({ itemId: 'da-xoa', name: 'Món cũ', quantity: 1 })],
      catalog: CATALOG,
      isAdmin: false,
    });
    expect(kq.boQua[0]).toContain('không còn trong danh mục');
  });

  it('nhân viên: bỏ món chỉ-admin; admin: giữ lại', () => {
    const lines = [dong({ itemId: 'a4', name: 'Giấy A4', quantity: 2 })];
    expect(dungLaiDon({ lines, catalog: CATALOG, isAdmin: false }).boQua[0]).toContain(
      'chỉ quản trị viên',
    );
    expect(dungLaiDon({ lines, catalog: CATALOG, isAdmin: true }).quantities).toEqual({ a4: 2 });
  });

  it('hạ số lượng vượt giới hạn HIỆN TẠI thay vì bỏ cả dòng', () => {
    // Đơn cũ đặt 10 khi giới hạn còn cao; nay giới hạn là 5.
    const kq = dungLaiDon({
      lines: [dong({ itemId: 'a4', name: 'Giấy A4', quantity: 10 })],
      catalog: CATALOG,
      isAdmin: true,
    });
    expect(kq.quantities).toEqual({ a4: 5 });
    expect(kq.giamSoLuong[0]).toContain('giảm còn 5');
  });

  it('cộng dồn hai dòng cùng một món', () => {
    const kq = dungLaiDon({
      lines: [
        dong({ itemId: 'but', name: 'Bút bi', quantity: 3 }),
        dong({ itemId: 'but', name: 'Bút bi', quantity: 4 }),
      ],
      catalog: CATALOG,
      isAdmin: false,
    });
    expect(kq.quantities).toEqual({ but: 7 });
  });

  it('giữ nguyên dòng "Khác" kể cả ảnh đính kèm', () => {
    const kq = dungLaiDon({
      lines: [
        dong({ name: 'Bìa lạ', unit: 'cái', quantity: 2, attachmentPath: '/api/uploads/x.png' }),
      ],
      catalog: CATALOG,
      isAdmin: false,
    });
    expect(kq.otherLines).toHaveLength(1);
    expect(kq.otherLines[0]).toMatchObject({
      name: 'Bìa lạ',
      unit: 'cái',
      quantity: 2,
      attachmentPath: '/api/uploads/x.png',
    });
  });

  it('mỗi dòng "Khác" có key riêng để React không nhầm dòng', () => {
    const kq = dungLaiDon({
      lines: [dong({ name: 'A' }), dong({ name: 'B' })],
      catalog: CATALOG,
      isAdmin: false,
    });
    expect(new Set(kq.otherLines.map((l) => l.key)).size).toBe(2);
  });

  it('đơn toàn món hỏng ⇒ giỏ rỗng nhưng có đủ lý do', () => {
    const kq = dungLaiDon({
      lines: [dong({ itemId: 'ng', name: 'Sổ cũ' }), dong({ itemId: 'a4', name: 'Giấy A4' })],
      catalog: CATALOG,
      isAdmin: false,
    });
    expect(kq.quantities).toEqual({});
    expect(kq.otherLines).toEqual([]);
    expect(kq.boQua).toHaveLength(2);
  });
});
