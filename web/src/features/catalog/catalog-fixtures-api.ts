import { vi } from 'vitest';
import { jsonResponse, screen, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import type { AdminItem, Category, ItemPayload } from './catalog.api';
import { CATEGORIES } from './catalog-fixtures';

interface Options {
  items: AdminItem[];
  categories?: Category[];
  patch?: (id: string, body: ItemPayload) => Response | Promise<Response>;
}

// Server giả giữ trạng thái: PATCH thành công đổi món, lần tải lại trả bản mới
export function stubCatalog({ items, categories = CATEGORIES, patch }: Options) {
  let list = items.map((i) => ({ ...i }));
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url, 'http://x').pathname;
    if (path === '/api/admin/items' && !init?.method) return jsonResponse(200, list);
    if (path === '/api/item-categories') return jsonResponse(200, categories);
    const id = path.startsWith('/api/admin/items/') ? path.slice('/api/admin/items/'.length) : null;
    if (id && init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body)) as ItemPayload;
      const res = patch ? await patch(id, body) : jsonResponse(200, {});
      if (res.ok) list = list.map((i) => (i.id === id ? { ...i, ...body } : i));
      return res;
    }
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const patchCalls = (f: ReturnType<typeof stubCatalog>) =>
  f.mock.calls
    .filter((c) => (c[1] as RequestInit | undefined)?.method === 'PATCH')
    .map((c) => ({ id: String(c[0]).split('/').pop(), body: JSON.parse(String((c[1] as RequestInit).body)) as ItemPayload }));

export const validationError = (field: string) =>
  jsonResponse(400, { code: 'VALIDATION', message: 'Dữ liệu không hợp lệ', fields: [field] });

export async function openCatalog(opts: Options, path = '/admin/catalog') {
  mockViewport(1280);
  const fetchMock = stubCatalog(opts);
  renderApp(makeMe('admin'), path);
  await screen.findByRole('group', { name: 'Lọc theo nhóm' });
  return fetchMock;
}

export const rowOf = (name: string) => screen.getByText(name, { exact: true }).closest('tr') as HTMLElement;
export const inRow = (name: string) => within(rowOf(name));
