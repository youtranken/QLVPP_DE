import { describe, expect, it } from 'vitest';
import { ErrorCode } from './errors';
import {
  canCancelRequest,
  canDeliverRequest,
  checkRegistrationWindow,
  checkRequestLines,
  formatRequestCode,
  type CatalogItemRule,
} from './request-rules';

/** Khung mặc định: mở ngày 20, đóng khi hết tháng. */
const CUA_SO = { startDay: 20, endDay: 31 };
const TRONG_CUA_SO = new Date('2026-08-25T10:00:00+07:00'); // ngày 25
const NGOAI_CUA_SO = new Date('2026-08-15T10:00:00+07:00'); // ngày 15

const BUT: CatalogItemRule = { id: 'but', adminOnly: false, maxQty: 20, active: true };
const A4: CatalogItemRule = { id: 'a4', adminOnly: true, maxQty: 20, active: true };
const NGUNG: CatalogItemRule = { id: 'ngung', adminOnly: false, maxQty: 20, active: false };
const CATALOG = new Map([BUT, A4, NGUNG].map((item) => [item.id, item]));

const codes = (violations: { code: ErrorCode }[]) => violations.map((v) => v.code);

describe('checkRegistrationWindow', () => {
  it('nhân viên gửi trong cửa sổ → hợp lệ', () => {
    expect(checkRegistrationWindow('member', CUA_SO, TRONG_CUA_SO)).toBeNull();
  });

  it('nhân viên gửi ngoài cửa sổ → REGISTRATION_CLOSED', () => {
    expect(checkRegistrationWindow('member', CUA_SO, NGOAI_CUA_SO)?.code).toBe(
      ErrorCode.REGISTRATION_CLOSED,
    );
  });

  it('thông báo nêu đúng khung ngày admin đang đặt', () => {
    expect(
      checkRegistrationWindow('member', { startDay: 5, endDay: 9 }, NGOAI_CUA_SO)?.message,
    ).toContain('từ ngày 5 đến ngày 9');
  });

  it('admin bỏ qua cửa sổ ngày', () => {
    expect(checkRegistrationWindow('admin', CUA_SO, NGOAI_CUA_SO)).toBeNull();
  });
});

describe('checkRequestLines', () => {
  it('đơn hợp lệ → không lỗi', () => {
    const lines = [{ itemId: 'but', name: 'Bút bi', quantity: 5 }];
    expect(checkRequestLines(lines, 'member', CATALOG)).toEqual([]);
  });

  it('đơn rỗng → EMPTY_REQUEST', () => {
    expect(codes(checkRequestLines([], 'member', CATALOG))).toEqual([ErrorCode.EMPTY_REQUEST]);
  });

  it('nhân viên chọn món admin_only → ITEM_ADMIN_ONLY', () => {
    const lines = [{ itemId: 'a4', name: 'Giấy A4', quantity: 1 }];
    expect(codes(checkRequestLines(lines, 'member', CATALOG))).toEqual([ErrorCode.ITEM_ADMIN_ONLY]);
  });

  it('admin được chọn món admin_only', () => {
    const lines = [{ itemId: 'a4', name: 'Giấy A4', quantity: 1 }];
    expect(checkRequestLines(lines, 'admin', CATALOG)).toEqual([]);
  });

  it('món đã ngừng → ITEM_INACTIVE', () => {
    const lines = [{ itemId: 'ngung', name: 'Món cũ', quantity: 1 }];
    expect(codes(checkRequestLines(lines, 'member', CATALOG))).toEqual([ErrorCode.ITEM_INACTIVE]);
  });

  it.each([
    ['vượt max_qty', 21],
    ['bằng 0', 0],
    ['số âm', -3],
    ['số thập phân', 2.5],
  ])('số lượng %s → QTY_INVALID', (_label, quantity) => {
    const lines = [{ itemId: 'but', name: 'Bút bi', quantity }];
    expect(codes(checkRequestLines(lines, 'member', CATALOG))).toEqual([ErrorCode.QTY_INVALID]);
  });

  it('đúng ngưỡng max_qty → hợp lệ', () => {
    const lines = [{ itemId: 'but', name: 'Bút bi', quantity: 20 }];
    expect(checkRequestLines(lines, 'member', CATALOG)).toEqual([]);
  });

  it('itemId không có trong danh mục → NOT_FOUND', () => {
    const lines = [{ itemId: 'khong-ton-tai', name: 'X', quantity: 1 }];
    expect(codes(checkRequestLines(lines, 'member', CATALOG))).toEqual([ErrorCode.NOT_FOUND]);
  });

  it('dòng "Khác" (itemId null) áp giới hạn mặc định 20', () => {
    expect(
      checkRequestLines([{ itemId: null, name: 'Bìa lạ', quantity: 20 }], 'member', CATALOG),
    ).toEqual([]);
    expect(
      codes(checkRequestLines([{ itemId: null, name: 'Bìa lạ', quantity: 21 }], 'member', CATALOG)),
    ).toEqual([ErrorCode.QTY_INVALID]);
  });

  it('dòng "Khác" tên rỗng → VALIDATION', () => {
    const lines = [{ itemId: null, name: '   ', quantity: 1 }];
    expect(codes(checkRequestLines(lines, 'member', CATALOG))).toContain(ErrorCode.VALIDATION);
  });

  it('gom nhiều lỗi của nhiều dòng, có kèm lineIndex', () => {
    const lines = [
      { itemId: 'but', name: 'Bút bi', quantity: 5 },
      { itemId: 'a4', name: 'Giấy A4', quantity: 99 },
    ];
    const violations = checkRequestLines(lines, 'member', CATALOG);
    expect(codes(violations)).toEqual([ErrorCode.ITEM_ADMIN_ONLY, ErrorCode.QTY_INVALID]);
    expect(violations.every((v) => v.lineIndex === 1)).toBe(true);
  });
});

describe('điều kiện huỷ và giao', () => {
  it('huỷ được khi đơn submitted và còn trong cửa sổ', () => {
    expect(canCancelRequest('submitted', CUA_SO, TRONG_CUA_SO)).toBe(true);
  });

  it('không huỷ được khi cửa sổ đã đóng, dù đơn vẫn submitted', () => {
    expect(canCancelRequest('submitted', CUA_SO, NGOAI_CUA_SO)).toBe(false);
  });

  it('không huỷ được đơn đã duyệt', () => {
    expect(canCancelRequest('approved', CUA_SO, TRONG_CUA_SO)).toBe(false);
  });

  it('chỉ giao đơn đã duyệt hoặc đang giao dở (BR-09)', () => {
    expect(canDeliverRequest('approved')).toBe(true);
    expect(canDeliverRequest('delivered')).toBe(true);
    expect(canDeliverRequest('submitted')).toBe(false);
    expect(canDeliverRequest('rejected')).toBe(false);
  });
});

describe('formatRequestCode', () => {
  it('đệm số thứ tự thành 4 chữ số', () => {
    expect(formatRequestCode('2026-08', 7)).toBe('VPP-2026-08-0007');
    expect(formatRequestCode('2026-12', 1234)).toBe('VPP-2026-12-1234');
  });
});
