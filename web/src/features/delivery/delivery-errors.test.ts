import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { lineErrorText } from './delivery-errors';

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);

describe('lineErrorText — chữ lỗi từng dòng khi giao', () => {
  it('CUSTOM_NOT_RECEIVED {available: 2} → nói rõ hàng ngoài danh mục chỉ còn giao được 2', () => {
    expect(lineErrorText({ code: 'CUSTOM_NOT_RECEIVED', available: 2 }, 'cái', t)).toBe('Hàng ngoài danh mục chưa về đủ — chỉ giao được 2 cái.');
  });

  it('ITEM_NOT_ADM_OUT → món chưa được đánh NCC hết hàng nên không hủy được phần thiếu', () => {
    expect(lineErrorText({ code: 'ITEM_NOT_ADM_OUT' }, 'cái', t)).toBe('Món chưa được đánh dấu NCC hết hàng — chưa hủy được phần thiếu.');
  });

  it('mã lạ → chữ chung', () => {
    expect(lineErrorText({ code: 'WHATEVER' }, 'cái', t)).toBe('Không giao được — thử lại.');
  });
});
