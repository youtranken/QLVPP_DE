import { describe, expect, it } from 'vitest';
import { indexCategories, toRows } from '@/features/catalog/catalog-rows';
import { applyStockView, balancesAfter, owedByItem, stockStats, toStockRows } from './stock-rows';
import { BACKLOG, CATEGORIES, ITEMS } from './stock-fixtures';

const rows = () => toStockRows(toRows(ITEMS, indexCategories(CATEGORIES)), owedByItem(BACKLOG.groups as never));

describe('stock-rows', () => {
  it('Còn nợ cộng theo món, bỏ nhóm ngoài danh mục (item_id null) và nhóm 0', () => {
    const owed = owedByItem([...(BACKLOG.groups as never[]), { key: 'z', label: { item_id: 'i-9' }, remaining_qty: 0, lines: [] }] as never);
    expect([...owed]).toEqual([['i-1', 4], ['i-2', 3]]);
  });

  it('số liệu: chỉ món đang dùng; Còn nợ 7 đơn vị · 2 món', () => {
    expect(stockStats(rows())).toEqual({ tracked: 4, low: 1, out: 1, owedQty: 7, owedItems: 2 });
  });

  it('lọc low/out theo stock_state của server; tìm không dấu', () => {
    expect(applyStockView(rows(), { filter: 'low', q: '' }).map((r) => r.name)).toEqual(['Giấy A4']);
    expect(applyStockView(rows(), { filter: 'out', q: '' }).map((r) => r.name)).toEqual(['Kẹp giấy']);
    expect(applyStockView(rows(), { filter: null, q: 'but bi' }).map((r) => r.name)).toEqual(['Bút bi xanh']);
  });

  it('tồn sau từng dòng sổ cái: [+10, −3] với tồn 7 → dòng mới 7, dòng cũ 10; trang rỗng → []', () => {
    expect(balancesAfter([{ delta: -3 }, { delta: 10 }], 7)).toEqual([7, 10]);
    expect(balancesAfter([], 7)).toEqual([]);
  });
});
