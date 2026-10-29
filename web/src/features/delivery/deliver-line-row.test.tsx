import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { MeContext } from '@/lib/me';
import type { LineView } from '@/features/request/request.api';
import { DeliverLineRow } from './deliver-line-row';
import { PEN_LINE, SCISSORS_LINE, TAPE_LINE } from './delivery-fixtures';

const DELIVER_URL = '/api/admin/lines/l-pen/deliver';

function stub(respond: () => Response | Promise<Response> = () => jsonResponse(200, { line: {} })) {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) =>
    url === DELIVER_URL ? Promise.resolve(respond()) : Promise.resolve(jsonResponse(200, {})),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const posts = (f: ReturnType<typeof stub>) => f.mock.calls.filter((c) => c[0] === DELIVER_URL) as unknown as [string, RequestInit][];

function renderRow(line: LineView = PEN_LINE) {
  const onNotice = vi.fn();
  const onReload = vi.fn(() => Promise.resolve());
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <ul>
        <DeliverLineRow line={line} onNotice={onNotice} onReload={onReload} />
      </ul>
    </MeContext.Provider>,
  );
  return { onNotice, onReload };
}

const qtyBox = () => screen.getByLabelText(/^Thực giao/);
const giao = () => screen.getByRole('button', { name: /^Giao/ });

async function typeQty(text: string) {
  await userEvent.clear(qtyBox());
  if (text) await userEvent.type(qtyBox(), text);
}

const noteOf = (el: HTMLElement) => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent;

afterEach(() => vi.unstubAllGlobals());

describe('DeliverLineRow — một dòng ở trang Giao hàng', () => {
  it('qty 5 đã giao 3 → ô "Thực giao" mặc định 2 (còn lại), chú thích "đã giao 3/5"', () => {
    stub();
    renderRow();
    expect(qtyBox()).toHaveValue(2);
    expect(screen.getByText('đã giao 3/5')).toBeInTheDocument();
    expect(giao()).toBeEnabled();
  });

  it('phần đã hủy nợ trừ vào còn lại: qty 5, đã giao 2, đã hủy 1 → mặc định 2', () => {
    stub();
    renderRow(lineView({ ...PEN_LINE, delivered_qty: 2, cancelled_qty: 1 }));
    expect(qtyBox()).toHaveValue(2);
  });

  it('biên trên: gõ 3 (còn lại + 1) → nút Giao vô hiệu + "Tối đa 2" gắn ô; gõ 2 → bật lại', async () => {
    const f = stub();
    renderRow();
    await typeQty('3');
    expect(giao()).toBeDisabled();
    expect(qtyBox()).toHaveAttribute('aria-invalid', 'true');
    expect(noteOf(qtyBox())).toBe('Tối đa 2');
    await typeQty('2');
    expect(giao()).toBeEnabled();
    expect(qtyBox()).not.toHaveAttribute('aria-invalid');
    expect(posts(f)).toHaveLength(0);
  });

  it('biên dưới: gõ 0 → vô hiệu + "Ít nhất 1"; ô trống cũng vô hiệu; gõ 1 → bật', async () => {
    stub();
    renderRow();
    await typeQty('0');
    expect(giao()).toBeDisabled();
    expect(noteOf(qtyBox())).toBe('Ít nhất 1');
    await typeQty('');
    expect(giao()).toBeDisabled();
    await typeQty('1');
    expect(giao()).toBeEnabled();
  });

  it('bấm Giao gửi {qty: 2, expected_delivered_qty: 3} kèm CSRF, xong báo phiếu tải lại', async () => {
    const f = stub();
    const { onReload } = renderRow();
    await userEvent.click(giao());
    await waitFor(() => expect(posts(f)).toHaveLength(1));
    const [, init] = posts(f)[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ qty: 2, expected_delivered_qty: 3 });
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-1');
    await waitFor(() => expect(onReload).toHaveBeenCalledTimes(1));
  });

  it('đang gửi → nút vô hiệu; hai cú bấm trước khi giao diện kịp vẽ lại → chỉ một POST', async () => {
    let release: (r: Response) => void = () => {};
    const f = stub(() => new Promise<Response>((res) => (release = res)));
    renderRow();
    const button = giao();
    act(() => {
      button.click();
      button.click();
    });
    expect(giao()).toBeDisabled();
    await userEvent.dblClick(giao());
    expect(posts(f)).toHaveLength(1);
    await act(async () => release(jsonResponse(200, { line: {} })));
  });

  it('409 STOCK_INSUFFICIENT {available: 1} → "Chỉ còn 1" gắn ô (aria-describedby), nút vô hiệu; gõ 1 → bật', async () => {
    stub(() => jsonResponse(409, { code: 'STOCK_INSUFFICIENT', message: 'x', available: 1 }));
    renderRow();
    await userEvent.click(giao());
    await waitFor(() => expect(noteOf(qtyBox())).toBe('Chỉ còn 1'));
    expect(qtyBox()).toHaveAttribute('aria-invalid', 'true');
    expect(giao()).toBeDisabled();
    await typeQty('1');
    expect(giao()).toBeEnabled();
  });

  it('400 DELIVER_EXCEEDS_QTY {remaining: 1} → "Chỉ còn 1 cần giao" gắn ô, báo phiếu tải lại', async () => {
    stub(() => jsonResponse(400, { code: 'DELIVER_EXCEEDS_QTY', message: 'x', remaining: 1 }));
    const { onReload } = renderRow();
    await userEvent.click(giao());
    await waitFor(() => expect(noteOf(qtyBox())).toBe('Chỉ còn 1 cần giao'));
    expect(giao()).toBeDisabled();
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it.each(['STALE_UPDATE', 'PERIOD_NOT_LOCKED', 'LINE_NOT_REVIEWED'])('409 %s → báo lên phiếu (onNotice), không gắn lỗi vào ô', async (code) => {
    stub(() => jsonResponse(409, { code, message: 'x' }));
    const { onNotice } = renderRow();
    await userEvent.click(giao());
    await waitFor(() => expect(onNotice).toHaveBeenCalledWith(code));
    expect(qtyBox()).not.toHaveAttribute('aria-invalid');
    expect(giao()).toBeEnabled();
  });

  it('dòng chờ xem → "Chờ xem — chưa giao được", không có ô giao và nút Giao', () => {
    stub();
    renderRow(TAPE_LINE);
    expect(screen.getByText('Chờ xem — chưa giao được')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Thực giao/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Giao/ })).toBeNull();
  });

  it('dòng bị từ chối → "Đã từ chối", không có ô giao', () => {
    stub();
    renderRow(SCISSORS_LINE);
    expect(screen.getByText('Đã từ chối')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Thực giao/)).toBeNull();
  });

  it('dòng đã giao đủ → "Đã giao đủ", không có ô giao', () => {
    stub();
    renderRow(lineView({ ...PEN_LINE, delivered_qty: 5 }));
    expect(screen.getByText('Đã giao đủ')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Giao/ })).toBeNull();
  });
});
