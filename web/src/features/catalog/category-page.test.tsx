import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import type { Category } from '@/features/catalog/catalog.api';

const CATEGORIES: Category[] = [
  { id: 'c-1', name: 'Giấy & sổ', name_en: 'Paper', sort_order: 0, active: true },
  { id: 'c-2', name: 'Bút & viết', name_en: null, sort_order: 1, active: true },
  { id: 'c-3', name: 'Cũ', name_en: null, sort_order: 2, active: false },
];

function stubApi(mutation: Response = jsonResponse(200, CATEGORIES[0])) {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (!init?.method) return Promise.resolve(jsonResponse(200, CATEGORIES));
    return Promise.resolve(mutation);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function mutations(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls
    .filter((c) => (c[1] as RequestInit | undefined)?.method)
    .map(([url, init]) => [url, (init as RequestInit).method, JSON.parse(String((init as RequestInit).body))]);
}

async function openCategories(mutation?: Response) {
  mockViewport(1280);
  const fetchMock = stubApi(mutation);
  renderApp(makeMe('admin'), '/admin/categories');
  await screen.findByText('Bút & viết');
  return fetchMock;
}

const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

describe('Trang Nhóm món', () => {
  it('liệt kê cả nhóm đã ngừng (?all=1) kèm nhãn "đã ngừng"', async () => {
    const fetchMock = await openCategories();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/item-categories?all=1');
    expect(within(rowOf('Cũ')).getByText('đã ngừng')).toBeInTheDocument();
  });

  it('"Đưa lên" đổi thứ tự: PATCH sort_order của hai nhóm đổi chỗ', async () => {
    const fetchMock = await openCategories();
    await userEvent.click(screen.getByRole('button', { name: 'Đưa Bút & viết lên' }));
    await vi.waitFor(() => expect(mutations(fetchMock)).toHaveLength(2));
    expect(mutations(fetchMock)).toEqual(
      expect.arrayContaining([
        ['/api/admin/item-categories/c-2', 'PATCH', { sort_order: 0 }],
        ['/api/admin/item-categories/c-1', 'PATCH', { sort_order: 1 }],
      ]),
    );
  });

  it('nhóm đầu không đưa lên được, nhóm cuối không đưa xuống được', async () => {
    await openCategories();
    expect(screen.getByRole('button', { name: 'Đưa Giấy & sổ lên' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đưa Cũ xuống' })).toBeDisabled();
  });

  it('thêm nhóm: POST tên + thứ tự cuối danh sách', async () => {
    const fetchMock = await openCategories(jsonResponse(201, CATEGORIES[0]));
    await userEvent.click(screen.getByRole('button', { name: 'Thêm nhóm' }));
    const dialog = await screen.findByRole('dialog', { name: 'Thêm nhóm' });
    await userEvent.type(within(dialog).getByLabelText('Tên nhóm'), 'Mực in');
    await userEvent.type(within(dialog).getByLabelText('Tên tiếng Anh'), 'Ink');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm nhóm' }));
    await vi.waitFor(() => expect(mutations(fetchMock)).toHaveLength(1));
    expect(mutations(fetchMock)[0]).toEqual([
      '/api/admin/item-categories',
      'POST',
      { name: 'Mực in', name_en: 'Ink', sort_order: 3 },
    ]);
  });

  it('tên trùng → CATEGORY_EXISTS gắn vào ô Tên nhóm', async () => {
    await openCategories(jsonResponse(409, { code: 'CATEGORY_EXISTS', message: 'x' }));
    await userEvent.click(screen.getByRole('button', { name: 'Thêm nhóm' }));
    const dialog = await screen.findByRole('dialog', { name: 'Thêm nhóm' });
    await userEvent.type(within(dialog).getByLabelText('Tên nhóm'), 'giấy & sổ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm nhóm' }));
    await vi.waitFor(() =>
      expect(within(dialog).getByLabelText('Tên nhóm')).toHaveAccessibleDescription('Đã có nhóm cùng tên.'),
    );
  });

  it('"Ngừng nhóm" hỏi xác nhận rồi PATCH {active:false}; nhóm đã ngừng có "Mở lại"', async () => {
    const fetchMock = await openCategories();
    expect(within(rowOf('Cũ')).getByRole('button', { name: 'Mở lại' })).toBeInTheDocument();
    await userEvent.click(within(rowOf('Bút & viết')).getByRole('button', { name: 'Ngừng nhóm' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ngừng nhóm' }));
    await vi.waitFor(() => expect(mutations(fetchMock)).toHaveLength(1));
    expect(mutations(fetchMock)[0]).toEqual(['/api/admin/item-categories/c-2', 'PATCH', { active: false }]);
  });
});
