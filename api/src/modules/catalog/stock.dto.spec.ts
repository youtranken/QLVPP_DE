import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IssueDto, StockChangeDto, StockCountDto } from './stock.dto';

const failing = (body: object) =>
  validateSync(plainToInstance(StockCountDto, body)).map((e) => e.property);
const base = { counted_qty: 5, expected_stock_qty: 3, note: 'đếm lại' };

describe('StockCountDto', () => {
  it.each([0, 1_000_000])('counted_qty %d hợp lệ', (counted_qty) => {
    expect(failing({ ...base, counted_qty })).toEqual([]);
  });

  it.each([-1, 1_000_001, 1.5, '5', null, undefined])(
    'counted_qty %p → lỗi counted_qty',
    (counted_qty) => {
      expect(failing({ ...base, counted_qty })).toEqual(['counted_qty']);
    },
  );

  it('expected_stock_qty 0 hợp lệ; -1, 1.5, thiếu → lỗi', () => {
    expect(failing({ ...base, expected_stock_qty: 0 })).toEqual([]);
    for (const expected of [-1, 1.5, undefined]) {
      expect(failing({ ...base, expected_stock_qty: expected })).toEqual([
        'expected_stock_qty',
      ]);
    }
  });

  it('note 500 ký tự hợp lệ, 501 → lỗi note; thiếu note để service báo REASON_REQUIRED', () => {
    expect(failing({ ...base, note: 'a'.repeat(500) })).toEqual([]);
    expect(failing({ ...base, note: 'a'.repeat(501) })).toEqual(['note']);
    expect(failing({ ...base, note: undefined })).toEqual([]);
  });
});

const errorsOf = (dto: new () => object, body: object) =>
  validateSync(plainToInstance(dto, body)).map((e) => e.property);

describe('Nhập mua và Xuất lẻ: biên số lượng (ô web chặn cùng biên)', () => {
  it('nhập mua delta 1 và 1.000.000 hợp lệ; 0, 1.000.001, 2.5 → lỗi delta', () => {
    for (const delta of [1, 1_000_000]) expect(errorsOf(StockChangeDto, { delta, reason: 'purchase' })).toEqual([]);
    for (const delta of [0, 1_000_001, 2.5]) expect(errorsOf(StockChangeDto, { delta, reason: 'purchase' })).toEqual(['delta']);
  });

  it('xuất lẻ qty 1 và 1.000.000 hợp lệ; 0, 1.000.001, 2.5 → lỗi qty (tồn kiểm ở service: STOCK_INSUFFICIENT)', () => {
    for (const qty of [1, 1_000_000]) expect(errorsOf(IssueDto, { qty, reason: 'x' })).toEqual([]);
    for (const qty of [0, 1_000_001, 2.5]) expect(errorsOf(IssueDto, { qty, reason: 'x' })).toEqual(['qty']);
  });
});
