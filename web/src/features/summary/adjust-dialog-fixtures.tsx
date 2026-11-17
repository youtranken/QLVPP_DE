import { expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { jsonResponse, renderWithI18n, screen } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { ToastProvider } from '@/ui/toast-provider';
import type { AdminItem } from '@/features/catalog/catalog.api';
import { AdjustDialog } from './adjust-dialog';
import { ADMIN_ITEMS, adminRequest } from './adjust-fixtures';
import type { AdjustReason, AdminRequestView } from './summary.api';

type Put = (body: Record<string, unknown>) => Response | Promise<Response>;

export const ADJUST_CATEGORY = { id: 'c-1', name: 'Văn phòng', name_en: null, sort_order: 0, active: true };

export function stubAdjust({
  views = [adminRequest()],
  items = ADMIN_ITEMS,
  put = () => jsonResponse(200, { request: adminRequest() }),
  send,
}: { views?: AdminRequestView[]; items?: AdminItem[]; put?: Put; send?: object } = {}) {
  let loads = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/admin/requests/r-1') return jsonResponse(200, views[Math.min(loads++, views.length - 1)]);
    if (url === '/api/admin/requests/r-1/lines') return put(JSON.parse(String(init?.body)));
    if (url === '/api/admin/items') return jsonResponse(200, items);
    if (url.startsWith('/api/item-categories')) return jsonResponse(200, [ADJUST_CATEGORY]);
    if (send && url.endsWith('/send-state')) return jsonResponse(200, send);
    return jsonResponse(200, []);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export type AdjustFetch = ReturnType<typeof stubAdjust>;

export const putCalls = (f: AdjustFetch) => f.mock.calls.filter((c) => c[0] === '/api/admin/requests/r-1/lines');

export const putBody = (f: AdjustFetch) => {
  const call = putCalls(f)[0] as unknown as [string, RequestInit];
  return JSON.parse(String(call[1].body));
};

export async function renderAdjust({ preset }: { preset?: AdjustReason } = {}) {
  const onClose = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <MemoryRouter>
        <ToastProvider>
          <ConfirmProvider>
            <AdjustDialog requestId="r-1" onClose={onClose} presetReason={preset} />
          </ConfirmProvider>
        </ToastProvider>
      </MemoryRouter>
    </MeContext.Provider>,
  );
  const dialog = await screen.findByRole('dialog', { name: 'Điều chỉnh phiếu Nguyễn Văn An' });
  await screen.findAllByRole('checkbox');
  expect(dialog).toBeInTheDocument();
  return { dialog, onClose };
}
