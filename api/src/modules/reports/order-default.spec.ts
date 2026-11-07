import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultOrder } from './order-default';
import { diffOf, wantOf } from './report-need';

interface Cases {
  defaultOrder: {
    name: string;
    row: {
      requested: number;
      backlog_prev: number;
      stock: number | null;
      adm_owed: number;
      left_excluded: number;
      usable: boolean;
    };
    want: number;
    expected: number;
  }[];
  diffOf: {
    name: string;
    input: { stock: number; order: number; adm_owed: number; need: number };
    expected: number;
  }[];
}

// Cùng tệp ca với web/src/lib/report-qty.ts để server và web ra cùng số
const cases = JSON.parse(
  readFileSync(
    join(process.cwd(), '../web/src/lib/report-qty.cases.json'),
    'utf8',
  ),
) as Cases;

describe('số đề nghị mặc định gộp (bảng ca chung api/web)', () => {
  it('bảng có 12 ca', () => {
    expect(cases.defaultOrder.length + cases.diffOf.length).toBe(13);
  });

  it.each(cases.defaultOrder.map((c) => [c.name, c] as const))(
    'defaultOrder: %s',
    (_name, c) => {
      expect(wantOf(c.row)).toBe(c.want);
      expect(defaultOrder(c.row)).toBe(c.expected);
    },
  );

  it.each(cases.diffOf.map((c) => [c.name, c] as const))(
    'diffOf: %s',
    (_name, c) => {
      expect(diffOf(c.input)).toBe(c.expected);
    },
  );
});
