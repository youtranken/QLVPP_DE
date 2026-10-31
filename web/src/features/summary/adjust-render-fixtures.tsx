import { expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { jsonResponse, renderWithI18n, screen, waitFor, within } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { ToastProvider } from '@/ui/toast-provider';
import type { AdminItem } from '@/features/catalog/catalog.api';
import { reviewResult } from '@/features/review/review-fixtures';
import { AdjustDrawer } from './adjust-drawer';
import { ADMIN_ITEMS, adminRequest } from './adjust-fixtures';
import type { AdminRequestView } from './summary.api';

type Put = (body: Record<string, unknown>) => Response | Promise<Response>;

export function stubAdjust({
  views = [adminRequest()],
  items = ADMIN_ITEMS,
  put = () => jsonResponse(200, { request: adminRequest() }),
  review = () => jsonResponse(200, reviewResult('accepted', { id: 'l-tape' })),
}: {
  views?: AdminRequestView[];
  items?: AdminItem[];
  put?: Put;
  review?: () => Response;
} = {}) {
  let loads = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/admin/requests/r-1') return jsonResponse(200, views[Math.min(loads++, views.length - 1)]);
    if (url === '/api/admin/requests/r-1/lines') return put(JSON.parse(String(init?.body)));
    if (url === '/api/admin/items') return jsonResponse(200, items);
    if (url === '/api/admin/lines/l-tape/review') return review();
    return jsonResponse(200, []);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export type AdjustFetch = ReturnType<typeof stubAdjust>;

export const putCalls = (f: AdjustFetch) => f.mock.calls.filter((c) => c[0] === '/api/admin/requests/r-1/lines');
export const loadCalls = (f: AdjustFetch) => f.mock.calls.filter((c) => c[0] === '/api/admin/requests/r-1');

export const putBody = (f: AdjustFetch) => {
  const call = putCalls(f)[0] as unknown as [string, RequestInit];
  return JSON.parse(String(call[1].body));
};

export async function renderDrawer({
  extra,
  onNext,
  onPrev,
  ready = 'Giấy note vàng',
}: { extra?: ReactNode; onNext?: () => void; onPrev?: () => void; ready?: string } = {}) {
  const onClose = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <MemoryRouter>
        <ToastProvider>
          <ConfirmProvider>
            <AdjustDrawer requestId="r-1" onClose={onClose} onNext={onNext} onPrev={onPrev} />
            {extra}
          </ConfirmProvider>
        </ToastProvider>
      </MemoryRouter>
    </MeContext.Provider>,
  );
  const drawer = await screen.findByRole('dialog', { name: 'Phiếu của Nguyễn Văn An' });
  // Trần số lượng lấy từ danh mục Hành chính: chờ tải xong mới bấm được +
  await waitFor(() => expect(within(drawer).getByRole('button', { name: `Thêm ${ready}` })).toBeEnabled());
  return { drawer, onClose };
}

export const row = (drawer: HTMLElement, name: string) => within(drawer).getByText(name).closest('li')!;
export const saveButton = (drawer: HTMLElement) => within(drawer).getByRole('button', { name: 'Lưu điều chỉnh' });
export const reasonBox = (drawer: HTMLElement) => within(drawer).getByLabelText(/^Lý do điều chỉnh/);
