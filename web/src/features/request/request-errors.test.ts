import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { ApiError } from '@/lib/api-client';
import { saveFailure } from './request-errors';
import type { CartLine } from './use-cart';

const t = i18n.getFixedT('vi');
const line = (key: string) => ({ key }) as CartLine;
const lines = [line('a'), line('b'), line('c')];
const validation = (extra: object) =>
  new ApiError(400, { code: 'VALIDATION', message: 'custom_note too long', fields: ['custom_note'], ...extra });

describe('saveFailure', () => {
  it('VALIDATION có line_index 1 → lỗi gắn vào dòng thứ 2 của giỏ, không báo ở form', () => {
    expect(saveFailure(validation({ line_index: 1 }), lines, t, '2026-11')).toEqual({
      kind: 'lines',
      byKey: { b: 'Dòng này chưa hợp lệ — kiểm tra lại.' },
    });
  });

  it('VALIDATION không có line_index → lỗi chung ở form', () => {
    expect(saveFailure(validation({}), lines, t, '2026-11')).toEqual({
      kind: 'form',
      message: 'Chưa lưu được — kiểm tra mạng rồi thử lại.',
    });
  });

  it('UNIT_INACTIVE có line_index 0 → câu ĐVT đã ngừng gắn vào dòng đầu (vi và en)', () => {
    const e = new ApiError(400, { code: 'UNIT_INACTIVE', message: 'x', line_index: 0 });
    expect(saveFailure(e, lines, t, '2026-11')).toEqual({
      kind: 'lines',
      byKey: { a: 'Đơn vị tính này đã ngừng — chọn đơn vị khác.' },
    });
    expect(saveFailure(e, lines, i18n.getFixedT('en'), '2026-11')).toEqual({
      kind: 'lines',
      byKey: { a: 'This unit is no longer used — choose another unit.' },
    });
  });
});
