import { stockStateOf } from './stock-state';

const of = (
  stock_qty: number,
  held: number,
  restock_level: number | null,
  incoming = 0,
) => stockStateOf({ stock_qty, held, restock_level, incoming });

describe('trạng thái Tủ/Kho theo người đang chờ', () => {
  it.each([
    [0, 0, 5, { stock_state: 'none', free: 0, short: 0 }],
    [0, 3, 5, { stock_state: 'short', free: 0, short: 3 }],
    [10, 10, 2, { stock_state: 'low', free: 0, short: 0 }],
    [10, 12, null, { stock_state: 'short', free: 0, short: 2 }],
    [20, 2, 5, { stock_state: 'ok', free: 18, short: 0 }],
    [4, 0, null, { stock_state: 'untracked', free: 4, short: 0 }],
  ])('tủ %i, giữ %i, mức %p → %o', (stock, held, level, expected) => {
    expect(of(stock, held, level)).toMatchObject(expected);
  });

  it('hàng đang về bù đủ phần thiếu → "incoming" với awaiting = held − tủ; không đỏ', () => {
    expect(of(0, 5, null, 5)).toMatchObject({
      stock_state: 'incoming',
      short: 0,
      awaiting: 5,
    });
    expect(of(3, 5, 30, 2)).toMatchObject({
      stock_state: 'incoming',
      short: 0,
      awaiting: 2,
    });
  });

  it('hàng về thiếu 1 so với phần thiếu → đỏ short 1; dư 1 → awaiting chỉ bằng phần thiếu', () => {
    expect(of(3, 5, null, 1)).toMatchObject({
      stock_state: 'short',
      short: 1,
    });
    expect(of(3, 5, null, 3)).toMatchObject({
      stock_state: 'incoming',
      awaiting: 2,
    });
  });

  it('giữ = tủ (không thiếu) dù có hàng về → không "incoming"', () => {
    expect(of(5, 5, null, 4).stock_state).toBe('untracked');
  });

  it('Sắp hết tính trên phần còn trống: mức 10 → ngưỡng 2; trống 2 → low, trống 3 → ok', () => {
    expect(of(12, 10, 10)).toMatchObject({ stock_state: 'low', free: 2 });
    expect(of(13, 10, 10)).toMatchObject({ stock_state: 'ok', free: 3 });
  });

  it('tủ 0, không ai chờ, có hàng đang về → "none" (xám), không "incoming"', () => {
    expect(of(0, 0, 5, 4).stock_state).toBe('none');
  });
});
