import { MemoryRouter } from 'react-router-dom';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { MeContext } from '@/lib/me';
import { makeMe } from '@/test/fixtures-me';
import { ToastProvider } from '@/ui/toast-provider';
import type { DeliveryPerson } from './delivery-people.api';
import { DeliverDialog } from './deliver-dialog';
import { person, pLine } from './people-fixtures';

const UNDO = '/api/admin/undo/delivery';

function stub(cancelUndoId: string | null = null) {
  const f = vi.fn((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u === UNDO) return Promise.resolve(jsonResponse(200, { undone: 2 }));
    if (u.endsWith('/deliver')) return Promise.resolve(jsonResponse(200, { request_complete: false, undo_id: `u-${u.split('/')[4]}` }));
    if (init?.method === 'POST') return Promise.resolve(jsonResponse(200, { cancelled_now: 1, undo_id: cancelUndoId }));
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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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

  it('bước hủy NCC hết hàng trả undo_id kiểu hủy → không gộp vào lô undo/delivery: toast không có Hoàn tác', async () => {
    const f = stub('u-cancel-m');
    const mixed = person({ lines: [pLine({ line_id: 'la' }), pLine({ line_id: 'm', item_id: 'i-clip', stock_qty: 0, adm_out: true })] });
    const onDone = open(mixed);
    await userEvent.click(confirm());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(await screen.findByText('Đã giao cho Nguyễn Văn An')).toBeInTheDocument();
    expect(f.mock.calls.some(([u]) => String(u).endsWith('/m/cancel-remaining'))).toBe(true);
    expect(undoButton()).not.toBeInTheDocument();
  });

  it('3 dòng, mỗi dòng server trả sau 1 s → nút Hoàn tác tính từ lúc gửi dòng đầu: còn ở +4 999 ms, mất ở +5 000 ms', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const u = String(url);
        const body = u.endsWith('/deliver') ? { request_complete: false, undo_id: `u-${u.split('/')[4]}` } : {};
        return new Promise((r) => setTimeout(() => r(jsonResponse(200, body)), u.endsWith('/deliver') ? 1000 : 0));
      }),
    );
    const three = person({
      lines: [pLine({ line_id: 'la' }), pLine({ line_id: 'lb', item_id: 'i-clip', name: 'Kẹp giấy' }), pLine({ line_id: 'lc', item_id: 'i-tape', name: 'Băng keo' })],
    });
    open(three);
    const t0 = Date.now();
    fireEvent.click(confirm());
    const at = (ms: number) => act(() => vi.advanceTimersByTimeAsync(t0 + ms - Date.now()));
    await at(3000);
    expect(undoButton()).toHaveTextContent('Hoàn tác (2)');
    await at(4999);
    expect(undoButton()).toBeInTheDocument();
    await at(5000);
    expect(undoButton()).not.toBeInTheDocument();
  });
});
