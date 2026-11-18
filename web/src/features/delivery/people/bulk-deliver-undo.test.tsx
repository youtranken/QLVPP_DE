import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
import { MeContext } from '@/lib/me';
import { makeMe } from '@/test/fixtures-me';
import { ToastProvider } from '@/ui/toast-provider';
import { BulkDeliverDialog } from './bulk-deliver-dialog';
import { bulkPlan } from './bulk-plan';
import { A, B, PEOPLE } from './people-fixtures';

const BULK = '/api/admin/deliveries/bulk';
const UNDO = '/api/admin/undo/delivery';
const plan = bulkPlan([A, B], PEOPLE);

function stub(undoId: string | null) {
  const f = vi.fn((url: string, init?: RequestInit) => {
    if (String(url) === BULK) {
      const body = JSON.parse(String(init?.body)) as { requests: { request_id: string }[] };
      const results = body.requests.map((r) => ({ request_id: r.request_id, ok: true, delivered_units: 1, request_complete: false }));
      return Promise.resolve(jsonResponse(200, { results, undo_id: undoId }));
    }
    if (String(url) === UNDO) return Promise.resolve(jsonResponse(200, { undone: 2 }));
    return Promise.resolve(jsonResponse(200, {}));
  });
  vi.stubGlobal('fetch', f);
  return f;
}

// Trang thật đóng hộp khi giao xong: toast mới ra khỏi vùng bị hộp làm aria-hidden
function Host() {
  const [shown, setShown] = useState(true);
  return shown ? <BulkDeliverDialog plan={plan} people={PEOPLE} onClose={vi.fn()} onDone={() => setShown(false)} /> : null;
}

function open() {
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <MemoryRouter>
        <ToastProvider>
          <Host />
        </ToastProvider>
      </MemoryRouter>
    </MeContext.Provider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('Giao n phiếu — Hoàn tác 5 giây (TC-18)', () => {
  it('giao xong có undo_id → toast "Đã giao 2 phiếu" kèm Hoàn tác (5); bấm thì POST undo/delivery đúng id rồi báo đã hoàn tác', async () => {
    const f = stub('u-1');
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Xác nhận giao' }));
    const undo = await screen.findByRole('button', { name: 'Hoàn tác' });
    expect(screen.getByRole('status')).toHaveTextContent('Đã giao 2 phiếu');
    expect(undo).toHaveTextContent('Hoàn tác (5)');
    await userEvent.click(undo);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Đã hoàn tác.'));
    const call = f.mock.calls.find(([u]) => String(u) === UNDO)!;
    expect(JSON.parse(String(call[1]?.body))).toEqual({ ids: ['u-1'] });
  });

  it('server không mở hoàn tác (undo_id null) → toast không có nút Hoàn tác', async () => {
    stub(null);
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Xác nhận giao' }));
    expect(await screen.findByText('Đã giao 2 phiếu')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hoàn tác' })).not.toBeInTheDocument();
  });
});
