import { describe, expect, it } from 'vitest';
import { indexCategories, toRows } from '@/features/catalog/catalog-rows';
import { applyStockView, balancesAfter, shortCount, stockStats, toStockRows } from './stock-rows';
import { CATEGORIES, facts, ITEMS, STOCK } from './stock-fixtures';

const byId = (list = STOCK) => new Map(list.map((f) => [f.item_id, f]));
const rows = (list = STOCK) => toStockRows(toRows(ITEMS, indexCategories(CATEGORIES)), byId(list));

describe('stock-rows', () => {
  it('ghép số Tủ/Kho của server theo món: Giấy A4 tủ 6, giữ 4, trống 2', () => {
    expect(rows().find((r) => r.id === 'i-1')).toMatchObject({ stock_qty: 6, held: 4, free: 2, stock_state: 'low' });
  });

  it('món ngừng ẩn khi tủ 0 và không ai chờ; hiện khi còn tủ hoặc còn người chờ', () => {
    expect(rows().map((r) => r.id)).not.toContain('i-3');
    const withStock = STOCK.map((f) => (f.item_id === 'i-3' ? facts('i-3', { stock_qty: 2, free: 2 }) : f));
    expect(rows(withStock).map((r) => r.id)).toContain('i-3');
    const waiting = STOCK.map((f) => (f.item_id === 'i-3' ? facts('i-3', { stock_qty: 0, held: 1, short: 1, stock_state: 'short' }) : f));
    expect(rows(waiting).map((r) => r.id)).toContain('i-3');
  });

  it('món chưa có số Tủ/Kho (vừa thêm) không hiện', () => {
    expect(rows(STOCK.filter((f) => f.item_id !== 'i-2')).map((r) => r.id)).not.toContain('i-2');
  });

  it('ô thống kê: tất cả 6, Thiếu cho người chờ 1, Chờ hàng về 1, Sắp hết 1, Không có 1', () => {
    expect(stockStats(rows())).toEqual({ all: 6, short: 1, incoming: 1, low: 1, none: 1 });
  });

  it('lọc theo trạng thái mới; tìm không dấu', () => {
    expect(applyStockView(rows(), { filter: 'short', q: '' }).map((r) => r.name)).toEqual(['Bìa còng']);
    expect(applyStockView(rows(), { filter: 'incoming', q: '' }).map((r) => r.name)).toEqual(['Bút chì']);
    expect(applyStockView(rows(), { filter: 'none', q: '' }).map((r) => r.name)).toEqual(['Kẹp giấy']);
    expect(applyStockView(rows(), { filter: null, q: 'but bi' }).map((r) => r.name)).toEqual(['Bút bi xanh']);
  });

  it('badge = số món short > 0: 2 thiếu, 3 không có, 1 sắp hết, 1 chờ hàng về → 2; short 0 → 0', () => {
    const list = [
      facts('a', { short: 3, stock_state: 'short' }),
      facts('b', { short: 1, stock_state: 'short' }),
      facts('c', { stock_state: 'none' }),
      facts('d', { stock_state: 'none' }),
      facts('e', { stock_state: 'none' }),
      facts('f', { stock_state: 'low' }),
      facts('g', { awaiting: 5, stock_state: 'incoming' }),
    ];
    expect(shortCount(list)).toBe(2);
    expect(shortCount(list.slice(2))).toBe(0);
  });

  it('tồn sau từng dòng sổ cái: [+10, −3] với tồn 7 → dòng mới 7, dòng cũ 10; trang rỗng → []', () => {
    expect(balancesAfter([{ delta: -3 }, { delta: 10 }], 7)).toEqual([7, 10]);
    expect(balancesAfter([], 7)).toEqual([]);
  });
});
