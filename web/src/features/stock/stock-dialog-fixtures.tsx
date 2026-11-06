import { vi } from 'vitest';
import { jsonResponse, renderWithI18n } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { ToastProvider } from '@/ui/toast-provider';
import { toStockRows } from './stock-rows';
import { facts, item, USERS } from './stock-fixtures';

// held/waiting: phần đang giữ cho người chờ của món (mặc định không ai chờ)
export const makeRow = (stock_qty: number, held = 0, waiting = 0) =>
  toStockRows(
    [{ ...item({ id: 'i-1', name: 'Giấy A4', unit: 'ram', stock_qty }), group: 'c-1', tone: 'g1' }],
    new Map([['i-1', facts('i-1', { stock_qty, held, waiting, free: Math.max(0, stock_qty - held), short: Math.max(0, held - stock_qty) })]]),
  )[0];

export function stubMutation(mutationResponse: Response) {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) => Promise.resolve(url.startsWith('/api/admin/users') ? jsonResponse(200, USERS) : mutationResponse));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function mutationCall(fetchMock: ReturnType<typeof stubMutation>, url: string) {
  const call = fetchMock.mock.calls.find((c) => c[0] === url) as [string, RequestInit] | undefined;
  if (!call) throw new Error(`không có request tới ${url}`);
  return { init: call[1], body: JSON.parse(String(call[1].body)) as Record<string, unknown> };
}

export const mutationCount = (fetchMock: ReturnType<typeof stubMutation>, url: string) => fetchMock.mock.calls.filter((c) => c[0] === url).length;

export function wrap(ui: React.ReactElement) {
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <ConfirmProvider>
        <ToastProvider>{ui}</ToastProvider>
      </ConfirmProvider>
    </MeContext.Provider>,
  );
}
