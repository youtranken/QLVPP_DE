import type { MonthReport } from './report.types';
import { resolveOrderQty } from './order-qty';

const A4 = '11111111-1111-4111-8111-111111111111';
const CUSTOM = 'custom:["bìa còng","cái"]';
// need (net) cố ý khác số gộp để chứng minh mặc định không trừ tủ
const report = {
  byItem: [
    {
      key: A4,
      requested: 3,
      backlog_prev: 1,
      stock: 2,
      need: 2,
      adm_owed: 0,
      left_excluded: 0,
      usable: true,
    },
  ],
  custom: [{ key: CUSTOM, requested: 3, backlog_prev: 0, need: 3 }],
} as unknown as MonthReport;

const fieldsOf = (input: Record<string, unknown>) => {
  try {
    resolveOrderQty(report, input);
  } catch (e) {
    return (
      e as { getResponse(): { code: string; fields: string[] } }
    ).getResponse();
  }
  throw new Error('không ném lỗi');
};

describe('resolveOrderQty', () => {
  it('ô thiếu → số mặc định gộp (đăng ký + nợ, không trừ tủ); hàng thiếu trường mới đọc như wantOf', () => {
    expect(resolveOrderQty(report)).toEqual({ [A4]: 4, [CUSTOM]: 3 });
    expect(resolveOrderQty(report, { [A4]: 7 })).toEqual({
      [A4]: 7,
      [CUSTOM]: 3,
    });
  });

  it('biên: 0 và 99999 nhận', () => {
    expect(resolveOrderQty(report, { [A4]: 0, [CUSTOM]: 99999 })).toEqual({
      [A4]: 0,
      [CUSTOM]: 99999,
    });
  });

  it.each([[-1], [100000], [1.5], ['7'], [null], [Number.NaN]])(
    'biên: %p → VALIDATION fields order_qty.<key>',
    (v) => {
      expect(fieldsOf({ [A4]: v })).toMatchObject({
        code: 'VALIDATION',
        fields: [`order_qty.${A4}`],
      });
    },
  );

  it('khóa không có trong báo cáo (kể cả __proto__) → VALIDATION; nhiều ô sai báo đủ', () => {
    const ghost = '00000000-0000-4000-8000-000000000000';
    expect(
      fieldsOf(JSON.parse(`{"__proto__": 1}`) as Record<string, unknown>),
    ).toMatchObject({ fields: ['order_qty.__proto__'] });
    expect(fieldsOf({ [ghost]: 1, [CUSTOM]: -1 }).fields).toEqual([
      `order_qty.${ghost}`,
      `order_qty.${CUSTOM}`,
    ]);
  });
});
