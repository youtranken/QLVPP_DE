import { constraintError } from './request-errors';

const pgError = (code: string, constraint: string) => ({
  cause: { code, constraint },
});

describe('constraintError', () => {
  it.each(['stock_movements_ref_line_id_fkey', 'line_deliveries_line_id_fkey'])(
    '23001 %s → LINE_READONLY 400',
    (constraint) => {
      const err = constraintError(pgError('23001', constraint));
      expect(err?.getStatus()).toBe(400);
      expect(err?.getResponse()).toMatchObject({ code: 'LINE_READONLY' });
    },
  );

  it('request_lines_item_uq (23505) → DUPLICATE_ITEM', () => {
    const err = constraintError(pgError('23505', 'request_lines_item_uq'));
    expect(err?.getResponse()).toMatchObject({ code: 'DUPLICATE_ITEM' });
  });

  it('23503 trên constraint RESTRICT không bị báo LINE_READONLY', () => {
    expect(
      constraintError(pgError('23503', 'stock_movements_ref_line_id_fkey')),
    ).toBeNull();
  });

  it('23503 request_lines_custom_unit_fkey (ĐVT bị xóa giữa lúc kiểm và lúc ghi) → 400 VALIDATION {fields:[custom_unit]}', () => {
    const err = constraintError(
      pgError('23503', 'request_lines_custom_unit_fkey'),
    );
    expect(err?.getStatus()).toBe(400);
    expect(err?.getResponse()).toMatchObject({
      code: 'VALIDATION',
      fields: ['custom_unit'],
    });
  });

  it('constraint lạ → null', () => {
    expect(constraintError(pgError('23505', 'khong_biet'))).toBeNull();
    expect(constraintError(new Error('x'))).toBeNull();
  });
});
