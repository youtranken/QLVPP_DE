import { pgSqlState, pgViolation } from './sql';

const pgError = (code: string, extra: object = {}) =>
  Object.assign(new Error('pg'), {
    code,
    severity: 'ERROR',
    routine: 'exec_stmt_raise',
    ...extra,
  });
const wrapped = (cause: unknown) =>
  Object.assign(new Error('Failed query'), { cause });

describe('pgSqlState / pgViolation — đọc SQLSTATE qua chuỗi cause của drizzle', () => {
  it('lỗi pg P0001 (RAISE) bọc trong cause → "P0001"', () => {
    expect(pgSqlState(wrapped(pgError('P0001')))).toBe('P0001');
  });

  it('lỗi pg 23505 có constraint (không severity) → "23505"', () => {
    const e = Object.assign(new Error('dup'), {
      code: '23505',
      constraint: 'x_uq',
    });
    expect(pgSqlState(wrapped(e))).toBe('23505');
  });

  it('lỗi Node EPIPE/ECONNRESET (mã chữ, không dấu hiệu pg) → undefined', () => {
    for (const code of ['EPIPE', 'ECONNRESET', 'EADDR']) {
      const e = Object.assign(new Error(code), { code, syscall: 'write' });
      expect(pgSqlState(wrapped(e))).toBeUndefined();
    }
  });

  it('mã 4 hoặc 6 ký tự, chữ thường → undefined dù có severity', () => {
    for (const code of ['2350', '235050', 'p0001']) {
      expect(pgSqlState(pgError(code))).toBeUndefined();
    }
  });

  it('pgViolation: 23505 có constraint → trả lỗi; P0001 → null (không phải vi phạm ràng buộc)', () => {
    const dup = pgError('23505', { constraint: 'x_uq' });
    expect(pgViolation(wrapped(dup))).toBe(dup);
    expect(pgViolation(wrapped(pgError('P0001')))).toBeNull();
  });

  it('không có lỗi pg trong chuỗi → undefined / null', () => {
    expect(pgSqlState(new Error('x'))).toBeUndefined();
    expect(pgSqlState(undefined)).toBeUndefined();
    expect(pgViolation(new Error('x'))).toBeNull();
  });
});
