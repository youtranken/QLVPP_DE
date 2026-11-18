import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, jsonResponse, renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { ToastProvider } from '@/ui/toast-provider';
import type { BacklogLine } from './backlog.api';
import { DeliverMoreDialog } from './deliver-more-dialog';
import { backlogLine } from './backlog-fixtures';

const DELIVER_URL = '/api/admin/lines/l-pen/deliver';

function stub(respond: () => Response | Promise<Response> = () => jsonResponse(200, {})) {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) =>
    url === DELIVER_URL ? Promise.resolve(respond()) : Promise.resolve(jsonResponse(200, {})),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const posts = (f: ReturnType<typeof stub>) => f.mock.calls.filter((c) => c[0] === DELIVER_URL) as unknown as [string, RequestInit][];
const MORE = backlogLine({ qty: 4, delivered_qty: 0, remaining_qty: 4, stock_qty: 2 });

function renderDialog(line: BacklogLine = MORE) {
  const onDone = vi.fn(() => Promise.resolve());
  const onStale = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <ToastProvider>
        <DeliverMoreDialog line={line} onDone={onDone} onStale={onStale} onClose={() => {}} />
      </ToastProvider>
    </MeContext.Provider>,
  );
  return { onDone, onStale };
}

const qtyBox = () => screen.getByLabelText('Số lượng giao');
const giao = () => screen.getByRole('button', { name: 'Giao' });
const plus = () => screen.getByRole('button', { name: /^Thêm/ });
const minus = () => screen.getByRole('button', { name: /^Bớt/ });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('DeliverMoreDialog — giao bổ sung một dòng còn nợ', () => {
  it('còn 4, tủ 2 → mặc định 2, "+" vô hiệu ở 2; mô tả "Tủ 2 cây", không còn chữ "tồn kho"', () => {
    stub();
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Giao bổ sung Bút bi xanh cho Phạm Văn Đức' })).toBeInTheDocument();
    expect(screen.getByText('Tháng 10 · Còn nợ 4 cây · Tủ 2 cây')).toBeInTheDocument();
    expect(screen.queryByText(/tồn kho|Tồn/)).toBeNull();
    expect(qtyBox()).toHaveValue(2);
    expect(plus()).toBeDisabled();
  });

  it.each([
    ['nợ 6 < tủ 7 → tối đa 6 (số còn nợ)', 6, 7, 6],
    ['nợ 6 = tủ 6 → tối đa 6', 6, 6, 6],
    ['tủ 5 < nợ 6 → tối đa 5 (số trong tủ)', 6, 5, 5],
  ])('câu tối đa = min(nợ, tủ): %s', (_n, owed, stock, max) => {
    stub();
    renderDialog(backlogLine({ qty: owed, delivered_qty: 0, remaining_qty: owed, stock_qty: stock }));
    expect(screen.getByText(`Giao được tối đa ${max} cây — bằng số còn nợ hoặc số trong tủ, lấy số nhỏ hơn`)).toBeInTheDocument();
    expect(qtyBox()).toHaveValue(max);
  });

  it('biên số lượng: 1 và 2 gửi được; gõ 3 (max+1) vẫn kẹp ở 2; "−" vô hiệu ở 1; "Tủ sau khi giao" = tồn − số giao', async () => {
    const f = stub();
    const { onDone } = renderDialog();
    expect(screen.getByText('Tủ sau khi giao 0')).toBeInTheDocument();
    fireEvent.change(qtyBox(), { target: { value: '3' } });
    expect(qtyBox()).toHaveValue(2);
    await userEvent.click(minus());
    expect(qtyBox()).toHaveValue(1);
    expect(minus()).toBeDisabled();
    expect(screen.getByText('Tủ sau khi giao 1')).toBeInTheDocument();
    await userEvent.click(giao());
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(JSON.parse(String(posts(f)[0][1].body))).toEqual({ qty: 1, expected_delivered_qty: 0 });
  });

  it('gửi 2 (max) → {qty: 2, expected_delivered_qty: 0}, có CSRF', async () => {
    const f = stub();
    renderDialog();
    await userEvent.click(giao());
    await waitFor(() => expect(posts(f)).toHaveLength(1));
    expect(JSON.parse(String(posts(f)[0][1].body))).toEqual({ qty: 2, expected_delivered_qty: 0 });
    expect((posts(f)[0][1].headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-1');
  });

  it('còn nợ 3 < tồn 10 → max 3 (còn nợ chặn), "Tủ sau khi giao 7"', () => {
    stub();
    renderDialog(backlogLine());
    expect(qtyBox()).toHaveValue(3);
    expect(plus()).toBeDisabled();
    expect(screen.getByText('Tủ sau khi giao 7')).toBeInTheDocument();
  });

  it('dòng ngoài danh mục: không tồn → "Tháng 10/2026 · Còn nợ 3 cây", không "Tủ sau khi giao"', () => {
    stub();
    renderDialog(backlogLine({ item_id: null, stock_qty: null }));
    expect(screen.getByText('Tháng 10 · Còn nợ 3 cây')).toBeInTheDocument();
    expect(screen.getByText('Giao được tối đa 3 cây — bằng số còn nợ')).toBeInTheDocument();
    expect(screen.queryByText(/^Tủ sau khi giao/)).toBeNull();
    expect(qtyBox()).toHaveValue(3);
  });

  it('server STOCK_INSUFFICIENT {available: 1} → "Chỉ còn 1 cây." dưới ô, max thành 1, gửi lại 1 được', async () => {
    let first = true;
    const f = stub(() => {
      if (!first) return jsonResponse(200, {});
      first = false;
      return jsonResponse(409, { code: 'STOCK_INSUFFICIENT', available: 1 });
    });
    renderDialog();
    await userEvent.click(giao());
    const note = await screen.findByText('Chỉ còn 1 cây.');
    expect(qtyBox()).toHaveAttribute('aria-describedby', note.id);
    expect(qtyBox()).toHaveValue(1);
    expect(plus()).toBeDisabled();
    await userEvent.click(giao());
    await waitFor(() => expect(posts(f)).toHaveLength(2));
    expect(JSON.parse(String(posts(f)[1][1].body)).qty).toBe(1);
  });

  it('server DELIVER_EXCEEDS_QTY {remaining: 1} → "Chỉ còn 1 chưa giao." dưới ô, onStale gọi một lần, không đóng hộp', async () => {
    const { onDone, onStale } = renderDialog();
    stub(() => jsonResponse(400, { code: 'DELIVER_EXCEEDS_QTY', remaining: 1 }));
    await userEvent.click(giao());
    expect(await screen.findByText('Chỉ còn 1 chưa giao.')).toBeInTheDocument();
    expect(onStale).toHaveBeenCalledOnce();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('server PERIOD_NOT_LOCKED → khối dưới ô số lượng bằng câu khóa sổ theo hạn server trả (kỳ mở tháng 11 → 11/11)', async () => {
    renderDialog();
    stub(() => jsonResponse(409, { code: 'PERIOD_NOT_LOCKED', deadline: '2026-11-10T17:00:00.000Z' }));
    await userEvent.click(giao());
    expect(await screen.findByText('Kỳ chưa khóa — giao sau 00:00 ngày 11/11.')).toBeInTheDocument();
  });

  it('PERIOD_NOT_LOCKED không kèm hạn → không bịa ngày', async () => {
    renderDialog();
    stub(() => jsonResponse(409, { code: 'PERIOD_NOT_LOCKED' }));
    await userEvent.click(giao());
    expect(await screen.findByText('Kỳ chưa khóa — chưa giao được.')).toBeInTheDocument();
  });

  it('bấm "Giao" hai lần sát nhau → chỉ một POST', async () => {
    let release!: (r: Response) => void;
    const f = stub(() => new Promise<Response>((r) => (release = r)));
    renderDialog();
    act(() => {
      giao().click();
      giao().click();
    });
    expect(posts(f)).toHaveLength(1);
    expect(giao()).toBeDisabled();
    await act(async () => release(jsonResponse(200, {})));
  });

  it('giao xong có undo_id → toast kèm Hoàn tác; bấm thì POST undo/delivery với id đó (TC-18)', async () => {
    const f = stub(() => jsonResponse(200, { request_complete: false, undo_id: 'u-pen' }));
    const { onDone } = renderDialog();
    await userEvent.click(giao());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác', hidden: true }));
    await waitFor(() => expect(f.mock.calls.some((c) => c[0] === '/api/admin/undo/delivery')).toBe(true));
    const call = f.mock.calls.find((c) => c[0] === '/api/admin/undo/delivery')!;
    expect(JSON.parse(String(call[1]?.body))).toEqual({ ids: ['u-pen'] });
  });

  it('server trả sau 1 500 ms → Hoàn tác đếm từ lúc gửi: "(4)" khi toast hiện, còn ở +4 999 ms, mất ở +5 000 ms', async () => {
    vi.useFakeTimers();
    stub(() => new Promise<Response>((r) => setTimeout(() => r(jsonResponse(200, { request_complete: false, undo_id: 'u-pen' })), 1500)));
    renderDialog();
    const t0 = Date.now();
    fireEvent.click(giao());
    const at = (ms: number) => act(() => vi.advanceTimersByTimeAsync(t0 + ms - Date.now()));
    await at(1500);
    expect(screen.getByRole('button', { name: 'Hoàn tác', hidden: true })).toHaveTextContent('Hoàn tác (4)');
    await at(4999);
    expect(screen.getByRole('button', { name: 'Hoàn tác', hidden: true })).toBeInTheDocument();
    await at(5000);
    expect(screen.queryByRole('button', { name: 'Hoàn tác', hidden: true })).not.toBeInTheDocument();
  });
});
