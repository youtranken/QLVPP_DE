import { describe, expect, it } from 'vitest';
import cases from './report-qty.cases.json';
import { defaultOrder, diffOf, wantOf } from './report-qty';

// Cùng tệp ca với api (order-default.spec.ts): hai bên phải ra cùng số
describe('report-qty — bảng ca chung với api', () => {
  it.each(cases.defaultOrder)('defaultOrder: $name', ({ row, want, expected }) => {
    expect(wantOf(row)).toBe(want);
    expect(defaultOrder(row)).toBe(expected);
  });

  it.each(cases.diffOf)('diffOf: $name', ({ input, expected }) => {
    expect(diffOf(input)).toBe(expected);
  });

  it('bản chốt cũ thiếu trường mới → đọc như số gộp', () => {
    expect(defaultOrder({ requested: 8, backlog_prev: 2 })).toBe(10);
  });
});
