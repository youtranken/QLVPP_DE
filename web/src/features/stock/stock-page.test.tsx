import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import type { AdminItem } from '@/features/catalog/catalog.api';

function item(over: Partial<AdminItem>): AdminItem {
  return {
    id: 'i-x',
    code: null,
    name: 'Món',
    name_en: null,
    unit: 'cai',
    pack_note: null,
    category_id: null,
    image_file_id: 'f-1',
    admin_only: false,
    max_qty: 20,
    stock_qty: 10,
    min_stock: 2,
    active: true,
    sort_order: 0,
    missing_image: false,
    ...over,
  };
}

const LOW = item({ id: 'i-1', name: 'Giấy A4', unit: 'ram', stock_qty: 2, min_stock: 2 });
const ITEMS = [LOW, item({ id: 'i-2', name: 'Bút bi xanh' }), item({ id: 'i-3', name: 'Bút xóa cũ', active: false })];

function stubApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/api/admin/items') return Promise.resolve(jsonResponse(200, ITEMS));
      if (url === '/api/admin/stock/low') return Promise.resolve(jsonResponse(200, [LOW]));
      return Promise.resolve(jsonResponse(200, { items: [], next_cursor: null }));
    }),
  );
}

describe('StockPage', () => {
  it('nhãn đỏ "Sắp hết" khi tồn ≤ tối thiểu; ẩn món đã ngừng; bộ lọc "Sắp hết" chỉ còn món sắp hết', async () => {
    mockViewport(1280);
    stubApi();
    renderApp(makeMe('admin'), '/admin/stock');
    const lowRow = (await screen.findByText('Giấy A4')).closest('tr')!;
    expect(within(lowRow).getByText('Sắp hết')).toBeInTheDocument();
    const okRow = screen.getByText('Bút bi xanh').closest('tr')!;
    expect(within(okRow).queryByText('Sắp hết')).toBeNull();
    expect(screen.queryByText('Bút xóa cũ')).toBeNull();

    const filter = screen.getByRole('button', { name: /Sắp hết/ });
    expect(filter).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(filter);
    expect(filter).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
    expect(screen.getByText('Giấy A4')).toBeInTheDocument();
  });

  it('bấm "Xuất lẻ…" trên một dòng → mở hộp "Xuất lẻ · tên món"', async () => {
    mockViewport(1280);
    stubApi();
    renderApp(makeMe('admin'), '/admin/stock');
    const row = (await screen.findByText('Bút bi xanh')).closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Xuất lẻ…' }));
    expect(await screen.findByRole('dialog', { name: 'Xuất lẻ · Bút bi xanh' })).toBeInTheDocument();
  });
});
