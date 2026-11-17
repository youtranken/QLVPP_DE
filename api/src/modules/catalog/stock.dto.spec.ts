import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IssueDto, StockChangeDto } from './stock.dto';

const errorsOf = (dto: new () => object, body: object) =>
  validateSync(plainToInstance(dto, body)).map((e) => e.property);

describe('Nhập mua và Xuất lẻ: biên số lượng (ô web chặn cùng biên)', () => {
  it('nhập mua delta 1 và 1.000.000 hợp lệ; 0, 1.000.001, 2.5 → lỗi delta', () => {
    for (const delta of [1, 1_000_000])
      expect(errorsOf(StockChangeDto, { delta, reason: 'purchase' })).toEqual(
        [],
      );
    for (const delta of [0, 1_000_001, 2.5])
      expect(errorsOf(StockChangeDto, { delta, reason: 'purchase' })).toEqual([
        'delta',
      ]);
  });

  it('xuất lẻ qty 1 và 1.000.000 hợp lệ; 0, 1.000.001, 2.5 → lỗi qty (tồn kiểm ở service: STOCK_INSUFFICIENT)', () => {
    for (const qty of [1, 1_000_000])
      expect(errorsOf(IssueDto, { qty, reason: 'x' })).toEqual([]);
    for (const qty of [0, 1_000_001, 2.5])
      expect(errorsOf(IssueDto, { qty, reason: 'x' })).toEqual(['qty']);
  });
});
