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
    restock_level: 30,
    stock_state: 'ok',
    active: true,
    sort_order: 0,
    missing_image: false,
    ...over,
  };
}

const LOW = item({ id: 'i-1', name: 'Giấy A4', unit: 'ram', stock_qty: 6, restock_level: 30, stock_state: 'low' });
const OUT = item({ id: 'i-4', name: 'Kẹp giấy', stock_qty: 0, restock_level: 30, stock_state: 'out' });
const NEVER = item({ id: 'i-5', name: 'Ghim bấm', stock_qty: 0, restock_level: null, stock_state: 'untracked' });
const ITEMS = [
  LOW,
  item({ id: 'i-2', name: 'Bút bi xanh' }),
  item({ id: 'i-3', name: 'Bút xóa cũ', active: false }),
  OUT,
  NEVER,
];

// Chuông có sẵn một thông báo low_stock đã đọc (bấm chỉ điều hướng, không POST)
const LOW_BELL = {
  id: 'n-low',
  topic: 'low_stock',
  params: { name: 'Giấy A4', name_en: null, stock_qty: 6 },
  link: '/admin/stock?filter=low',
  created_at: '2026-11-12T03:00:00.000Z',
  read_at: '2026-11-12T04:00:00.000Z',
};

function stubApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/api/admin/items') return Promise.resolve(jsonResponse(200, ITEMS));
      if (url === '/api/admin/stock/low') return Promise.resolve(jsonResponse(200, [LOW]));
      if (url.startsWith('/api/me/notifications')) return Promise.resolve(jsonResponse(200, { items: [LOW_BELL], next_cursor: null, unread_count: 0 }));
      return Promise.resolve(jsonResponse(200, { items: [], next_cursor: null }));
    }),
  );
}

describe('StockPage', () => {
  it('"Sắp hết" khi tồn 6/30, "Hết hàng" khi 0 sau nhập, không nhãn khi chưa nhập; ẩn món đã ngừng; lọc "Sắp hết"', async () => {
    mockViewport(1280);
    stubApi();
    renderApp(makeMe('admin'), '/admin/stock');
    const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr')!;
    expect(within(await rowOf('Giấy A4')).getByText('Sắp hết')).toBeInTheDocument();
    const outRow = await rowOf('Kẹp giấy');
    expect(within(outRow).getByText('Hết hàng')).toBeInTheDocument();
    expect(within(outRow).queryByText('Sắp hết')).toBeNull();
    const neverRow = await rowOf('Ghim bấm');
    expect(within(neverRow).queryByText('Sắp hết')).toBeNull();
    expect(within(neverRow).queryByText('Hết hàng')).toBeNull();
    expect(within(await rowOf('Bút bi xanh')).queryByText('Sắp hết')).toBeNull();
    expect(screen.queryByText('Bút xóa cũ')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Tối thiểu' })).toBeNull();

    const filter = screen.getByRole('button', { name: /Sắp hết/ });
    expect(filter).toHaveTextContent('1');
    expect(filter).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(filter);
    expect(filter).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
    expect(screen.queryByText('Kẹp giấy')).toBeNull();
    expect(screen.getByText('Giấy A4')).toBeInTheDocument();
  });

  it('mở từ KPI Tổng hợp (/admin/stock?filter=low) → bộ lọc "Sắp hết" bật sẵn', async () => {
    mockViewport(1280);
    stubApi();
    renderApp(makeMe('admin'), '/admin/stock?filter=low');
    expect(await screen.findByText('Giấy A4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sắp hết/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
  });

  it('đang ở /admin/stock (lọc tắt), bấm thông báo sắp hết trên chuông → URL ?filter=low và bộ lọc "Sắp hết" bật', async () => {
    mockViewport(1280);
    stubApi();
    renderApp(makeMe('admin'), '/admin/stock');
    expect(await screen.findByText('Bút bi xanh')).toBeInTheDocument();
    const filter = screen.getByRole('button', { name: /Sắp hết/ });
    expect(filter).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: /^Thông báo/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Giấy A4 sắp hết kho/ }));
    expect(screen.getByRole('button', { name: /Sắp hết/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
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
