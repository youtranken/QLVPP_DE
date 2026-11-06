import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { jsonResponse, renderWithI18n, screen } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { ToastProvider } from '@/ui/toast-provider';
import type { AdminItem } from './catalog.api';
import { CATEGORIES, PEN } from './catalog-fixtures';
import { ItemDrawer } from './item-drawer';

export const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'but.png', { type: 'image/png' });

type Reply = (url: string, init: RequestInit) => Response | undefined;

export function stubDrawerApi(reply: Reply = () => undefined) {
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const custom = reply(url, init);
    if (custom) return custom;
    if (url === '/api/files') return jsonResponse(201, { id: 'f-new', mime: 'image/png', size_bytes: 4 });
    if (url === '/api/periods/current') return jsonResponse(200, { ym: '2026-11', deadline: '2026-11-10T17:00:00.000Z', is_open: true, days_left: 9, previous: null, owed: [] });
    if (url.startsWith('/api/admin/periods/2026-10/requests')) return jsonResponse(200, { items: [{ key: PEN.id, item_id: PEN.id, name: PEN.name, unit: 'cay', requested_qty: 12, people: 7 }] });
    return jsonResponse(200, {});
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const callsTo = (f: ReturnType<typeof stubDrawerApi>, url: string, method?: string) =>
  f.mock.calls.filter((c) => c[0] === url && (method === undefined || (c[1] as RequestInit | undefined)?.method === method));

export const bodyOf = (f: ReturnType<typeof stubDrawerApi>, url: string, method: string) => {
  const call = callsTo(f, url, method)[0] as unknown as [string, RequestInit] | undefined;
  if (!call) throw new Error(`không có ${method} ${url}`);
  return JSON.parse(String(call[1].body)) as Record<string, unknown>;
};

export function renderDrawer({
  item = null,
  categoryId,
  nav,
}: { item?: AdminItem | null; categoryId?: string; nav?: { index: number; total: number; onStep: (dir: 1 | -1) => void } } = {}) {
  const onClose = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <MemoryRouter>
        <ToastProvider>
          <ConfirmProvider>
            <ItemDrawer
              item={item}
              categories={CATEGORIES}
              defaultCategoryId={categoryId}
              onClose={onClose}
              nav={nav}
            />
          </ConfirmProvider>
        </ToastProvider>
      </MemoryRouter>
    </MeContext.Provider>,
  );
  return { onClose, drawer: () => screen.getByRole('dialog') };
}
