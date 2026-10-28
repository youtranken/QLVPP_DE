import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import type { AdminItem, Category } from '@/features/catalog/catalog.api';

const CATEGORIES: Category[] = [
  { id: 'c-1', name: 'Giấy & sổ', name_en: 'Paper', sort_order: 0, active: true },
  { id: 'c-2', name: 'Bút & viết', name_en: 'Pens', sort_order: 1, active: true },
];

function item(over: Partial<AdminItem>): AdminItem {
  return {
    id: 'i-x',
    code: null,
    name: 'Món',
    name_en: null,
    unit: 'cai',
    pack_note: null,
    category_id: 'c-1',
    image_file_id: 'f-1',
    admin_only: false,
    max_qty: 20,
    stock_qty: 0,
    min_stock: 0,
    active: true,
    sort_order: 0,
    missing_image: false,
    ...over,
  };
}

const ITEMS: AdminItem[] = [
  item({ id: 'i-1', name: 'Giấy A4', unit: 'ram', admin_only: true, image_file_id: null, missing_image: true }),
  item({ id: 'i-2', name: 'Bút bi xanh', unit: 'cay', pack_note: 'hộp 20 cây', category_id: 'c-2', image_file_id: 'f-2' }),
  item({ id: 'i-3', name: 'Bút xóa cũ', category_id: 'c-2', active: false }),
];

function stubApi() {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/admin/items') return Promise.resolve(jsonResponse(200, ITEMS));
    if (url === '/api/item-categories?all=1') return Promise.resolve(jsonResponse(200, CATEGORIES));
    if (url.startsWith('/api/admin/items/') && init?.method === 'PATCH') {
      return Promise.resolve(jsonResponse(200, { ...ITEMS[1], active: false }));
    }
    return Promise.resolve(jsonResponse(404, { code: 'NOT_FOUND' }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function openCatalog() {
  mockViewport(1280);
  const fetchMock = stubApi();
  renderApp(makeMe('admin'), '/admin/catalog');
  await screen.findByText('Bút bi xanh');
  return fetchMock;
}

const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

describe('Trang Danh mục', () => {
  it('món missing_image hiện nhãn "thiếu ảnh"; món có ảnh hiện thumbnail /api/files/:id', async () => {
    await openCatalog();
    expect(within(rowOf('Giấy A4')).getByText('thiếu ảnh')).toBeInTheDocument();
    expect(within(rowOf('Bút bi xanh')).getByRole('img', { name: 'Bút bi xanh' })).toHaveAttribute(
      'src',
      '/api/files/f-2',
    );
  });

  it('dòng hiện quy cách cạnh tên, ĐVT, nhóm và cờ Hành chính', async () => {
    await openCatalog();
    const row = within(rowOf('Bút bi xanh'));
    expect(row.getByText('hộp 20 cây')).toBeInTheDocument();
    expect(row.getByText('cây')).toBeInTheDocument();
    expect(row.getByText('Bút & viết')).toBeInTheDocument();
    expect(within(rowOf('Giấy A4')).getByText('Chỉ Hành chính')).toBeInTheDocument();
  });

  it('nhóm lấy cả nhóm đã ngừng (?all=1); mặc định ẩn món đã ngừng, bật "Hiện món đã ngừng" thì hiện kèm nhãn', async () => {
    const fetchMock = await openCatalog();
    expect(fetchMock.mock.calls.map((c) => c[0])).toContain('/api/item-categories?all=1');
    expect(screen.queryByText('Bút xóa cũ')).toBeNull();
    await userEvent.click(screen.getByLabelText('Hiện món đã ngừng'));
    expect(within(rowOf('Bút xóa cũ')).getByText('đã ngừng')).toBeInTheDocument();
  });

  it('lọc theo nhóm chỉ còn món của nhóm đó', async () => {
    await openCatalog();
    await userEvent.selectOptions(screen.getByLabelText('Lọc theo nhóm'), 'c-1');
    expect(screen.getByText('Giấy A4')).toBeInTheDocument();
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
  });

  it('"Ngừng món" hỏi xác nhận rồi PATCH {active:false}', async () => {
    const fetchMock = await openCatalog();
    await userEvent.click(within(rowOf('Bút bi xanh')).getByRole('button', { name: 'Ngừng món' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ngừng món' }));
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => c[0] === '/api/admin/items/i-2')).toBe(true),
    );
    const [, init] = fetchMock.mock.calls.find((c) => c[0] === '/api/admin/items/i-2') as [string, RequestInit];
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ active: false });
  });

  it('nút "Thêm món" mở form; liên kết "Nhóm món" tới /admin/categories', async () => {
    await openCatalog();
    expect(screen.getByRole('link', { name: 'Nhóm món' })).toHaveAttribute('href', '/admin/categories');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm món' }));
    expect(await screen.findByRole('dialog', { name: 'Thêm món' })).toBeInTheDocument();
  });
});
