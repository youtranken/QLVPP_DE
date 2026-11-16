import { describe, expect, it } from 'vitest';
import { issueQtyError, purchaseQtyError, STOCK_QTY_MAX } from './stock-input';

describe('issueQtyError — ô số Xuất lẻ, tồn 20', () => {
  it('1 và 20 hợp lệ; 21 → vượt tủ (max 20); 0 → dưới 1; 2.5 → số lẻ; rỗng → chưa nhập', () => {
    expect(issueQtyError('1', 20)).toBeNull();
    expect(issueQtyError('20', 20)).toBeNull();
    expect(issueQtyError('21', 20)).toEqual({ code: 'overStock', max: 20 });
    expect(issueQtyError('0', 20)).toEqual({ code: 'min', max: 20 });
    expect(issueQtyError('2.5', 20)).toEqual({ code: 'decimal', max: 20 });
    expect(issueQtyError('', 20)).toEqual({ code: 'empty', max: 20 });
  });
});

describe('purchaseQtyError — ô số Nhập mua (DTO 1..1.000.000)', () => {
  it('1 và 1.000.000 hợp lệ; 1.000.001 → tối đa; 0 → dưới 1; 2,5 → số lẻ; -3 → dưới 1', () => {
    expect(STOCK_QTY_MAX).toBe(1_000_000);
    expect(purchaseQtyError('1')).toBeNull();
    expect(purchaseQtyError('1000000')).toBeNull();
    expect(purchaseQtyError('1000001')).toEqual({ code: 'max', max: 1_000_000 });
    expect(purchaseQtyError('0')).toEqual({ code: 'min', max: 1_000_000 });
    expect(purchaseQtyError('2,5')).toEqual({ code: 'decimal', max: 1_000_000 });
    expect(purchaseQtyError('-3')).toEqual({ code: 'min', max: 1_000_000 });
  });
});
