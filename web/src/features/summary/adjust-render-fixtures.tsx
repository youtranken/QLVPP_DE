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
import type { AdjustReason, AdminRequestView } from './summary.api';

type Put = (body: Record<string, unknown>) => Response | Promise<Response>;

export const UNSENT = { state: 'unsent', no_order_at: null, no_order_by_name: null, sent: null, changed_after: false, changed_at: null };
// Bản có hàng gửi ADM lúc 22:12 05/11 giờ VN
export const SENT = {
  ...UNSENT,
  state: 'sent',
  sent: { id: 's-1', kind: 'print', created_at: '2026-11-05T15:12:00.000Z', items_count: 3, units_total: 15, replaces: null, data: {} },
};

export function stubAdjust({
  views = [adminRequest()],
  items = ADMIN_ITEMS,
  put = () => jsonResponse(200, { request: adminRequest() }),
  review = () => jsonResponse(200, reviewResult('accepted', { id: 'l-tape' })),
  send = UNSENT,
}: {
  views?: AdminRequestView[];
  items?: AdminItem[];
  put?: Put;
  review?: () => Response;
  send?: object;
} = {}) {
  let loads = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/admin/requests/r-1') return jsonResponse(200, views[Math.min(loads++, views.length - 1)]);
    if (url === '/api/admin/requests/r-1/lines') return put(JSON.parse(String(init?.body)));
    if (url === '/api/admin/items') return jsonResponse(200, items);
    if (url === '/api/admin/lines/l-tape/review') return review();
    if (url === '/api/admin/periods/2026-10/send-state') return jsonResponse(200, send);
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
  preset,
  waitItems = true,
}: { extra?: ReactNode; onNext?: () => void; onPrev?: () => void; preset?: AdjustReason; waitItems?: boolean } = {}) {
  const onClose = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <MemoryRouter>
        <ToastProvider>
          <ConfirmProvider>
            <AdjustDrawer requestId="r-1" onClose={onClose} onNext={onNext} onPrev={onPrev} presetReason={preset} />
            {extra}
          </ConfirmProvider>
        </ToastProvider>
      </MemoryRouter>
    </MeContext.Provider>,
  );
  const drawer = await screen.findByRole('dialog', { name: 'Phiếu của Nguyễn Văn An' });
  // Dòng "tối đa n/tháng" lấy từ danh mục Hành chính: chờ tải xong
  if (waitItems) await waitFor(() => expect(within(drawer).getAllByText(/tối đa \d+\/tháng/).length).toBeGreaterThan(0));
  return { drawer, onClose };
}

export const row = (drawer: HTMLElement, name: string) => within(drawer).getByText(name).closest('li')!;
export const saveButton = (drawer: HTMLElement) => within(drawer).getByRole('button', { name: 'Lưu điều chỉnh' });
export const less = (drawer: HTMLElement, name: string) => within(drawer).getByRole('button', { name: `Bớt ${name}` });
export const reasons = (drawer: HTMLElement, name: string) => within(row(drawer, name)).getByRole('radiogroup', { name: 'Vì sao giảm?' });
export const pick = (drawer: HTMLElement, name: string, reason: string) => within(reasons(drawer, name)).getByRole('radio', { name: reason });
export const noteBox = (drawer: HTMLElement, name: string) => within(row(drawer, name)).getByLabelText(/^Ghi thêm/);
