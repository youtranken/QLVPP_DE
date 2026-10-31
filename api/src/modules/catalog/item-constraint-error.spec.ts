import { itemConstraintError } from './catalog.service';

const pgError = (code: string, constraint: string) => ({
  cause: { code, constraint },
});

describe('itemConstraintError', () => {
  it('23503 items_unit_fkey (ĐVT bị xóa giữa lúc kiểm active và lúc ghi món) → 400 VALIDATION {fields:[unit]}', () => {
    const err = itemConstraintError(pgError('23503', 'items_unit_fkey'));
    expect(err).toMatchObject({ status: 400 });
    expect((err as { getResponse(): unknown }).getResponse()).toMatchObject({
      code: 'VALIDATION',
      fields: ['unit'],
    });
  });

  it('constraint lạ → trả nguyên lỗi', () => {
    const raw = pgError('23505', 'khong_biet');
    expect(itemConstraintError(raw)).toBe(raw);
  });
});
