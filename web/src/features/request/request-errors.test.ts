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
});
