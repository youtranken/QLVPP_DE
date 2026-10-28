import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { apiErrorCode, apiErrorFields, apiErrorNumber, apiErrorString } from '@/lib/api-error';

describe('apiErrorCode / apiErrorFields', () => {
  it('đọc code từ body ApiError {code, message}', () => {
    expect(apiErrorCode(new ApiError(400, { code: 'IMAGE_REQUIRED', message: 'x' }))).toBe('IMAGE_REQUIRED');
  });

  it('không phải ApiError hoặc body không có code → undefined', () => {
    expect(apiErrorCode(new Error('boom'))).toBeUndefined();
    expect(apiErrorCode(new ApiError(500, null))).toBeUndefined();
    expect(apiErrorCode(new ApiError(500, { code: 42 }))).toBeUndefined();
  });

  it('VALIDATION kèm fields → danh sách tên trường; thiếu fields → []', () => {
    expect(apiErrorFields(new ApiError(400, { code: 'VALIDATION', fields: ['max_qty', 'name'] }))).toEqual([
      'max_qty',
      'name',
    ]);
    expect(apiErrorFields(new ApiError(400, { code: 'VALIDATION' }))).toEqual([]);
    expect(apiErrorFields(new Error('x'))).toEqual([]);
  });

  it('apiErrorNumber đọc số kèm lỗi (STOCK_INSUFFICIENT {available: 2}); thiếu/không phải số → undefined', () => {
    const e = new ApiError(409, { code: 'STOCK_INSUFFICIENT', available: 2 });
    expect(apiErrorNumber(e, 'available')).toBe(2);
    expect(apiErrorNumber(new ApiError(409, { available: '2' }), 'available')).toBeUndefined();
    expect(apiErrorNumber(new Error('x'), 'available')).toBeUndefined();
  });

  it('apiErrorString đọc chuỗi kèm lỗi (QTY_BELOW_DELIVERED {line_id}); thiếu/không phải chuỗi → undefined', () => {
    expect(apiErrorString(new ApiError(400, { code: 'QTY_BELOW_DELIVERED', line_id: 'l-1' }), 'line_id')).toBe('l-1');
    expect(apiErrorString(new ApiError(400, { line_id: 3 }), 'line_id')).toBeUndefined();
    expect(apiErrorString(new Error('x'), 'line_id')).toBeUndefined();
  });
});
