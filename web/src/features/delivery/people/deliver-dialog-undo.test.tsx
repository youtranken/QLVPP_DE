import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { MeContext } from '@/lib/me';
import { makeMe } from '@/test/fixtures-me';
import { ToastProvider } from '@/ui/toast-provider';
import type { DeliveryPerson } from './delivery-people.api';
import { DeliverDialog } from './deliver-dialog';
import { person, pLine } from './people-fixtures';

const UNDO = '/api/admin/undo/delivery';

function stub() {
  const f = vi.fn((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u === UNDO) return Promise.resolve(jsonResponse(200, { undone: 2 }));
    if (u.endsWith('/deliver')) return Promise.resolve(jsonResponse(200, { request_complete: false, undo_id: `u-${u.split('/')[4]}` }));
    if (init?.method === 'POST') return Promise.resolve(jsonResponse(200, { cancelled_now: 1, undo_id: null }));
    return Promise.resolve(jsonResponse(200, {}));
  });
  vi.stubGlobal('fetch', f);
  return f;
}

function open(p: DeliveryPerson) {
  const onDone = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <MemoryRouter>
        <ToastProvider>
          <DeliverDialog person={p} people={[p]} onDone={onDone} onClose={vi.fn()} onOpenPerson={vi.fn()} />
        </ToastProvider>
      </MemoryRouter>
    </MeContext.Provider>,
  );
  return onDone;
}
const confirm = () => within(screen.getByRole('dialog')).getByRole('button', { name: 'Xác nhận giao' });
// Hộp vẫn mở trong test (onDone giả) nên vùng toast bị che khỏi cây a11y
const undoButton = () => screen.queryByRole('button', { name: 'Hoàn tác', hidden: true });

afterEach(() => vi.unstubAllGlobals());

describe('Giao cho một người — Hoàn tác 5 giây (TC-18)', () => {
  it('giao hai dòng → toast có Hoàn tác; bấm thì POST undo/delivery với cả hai id', async () => {
    const f = stub();
    const two = person({ lines: [pLine({ line_id: 'la' }), pLine({ line_id: 'lb', item_id: 'i-clip', name: 'Kẹp giấy' })] });
    const onDone = open(two);
    await userEvent.click(confirm());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(await screen.findByText('Đã giao cho Nguyễn Văn An')).toBeInTheDocument();
    fireEvent.click(undoButton()!);
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u) === UNDO)).toBe(true));
    const call = f.mock.calls.find(([u]) => String(u) === UNDO)!;
    expect(JSON.parse(String(call[1]?.body))).toEqual({ ids: ['u-la', 'u-lb'] });
  });

  it('có bước hủy phần NCC hết hàng (không hoàn tác được) → toast không có Hoàn tác', async () => {
    stub();
    const mixed = person({ lines: [pLine({ line_id: 'la' }), pLine({ line_id: 'm', item_id: 'i-clip', stock_qty: 0, adm_out: true })] });
    const onDone = open(mixed);
    await userEvent.click(confirm());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(await screen.findByText('Đã giao cho Nguyễn Văn An')).toBeInTheDocument();
    expect(undoButton()).not.toBeInTheDocument();
  });
});
