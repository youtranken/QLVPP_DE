import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, jsonResponse, renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import type { BacklogLine } from './backlog.api';
import { DeliverMoreDialog } from './deliver-more-dialog';
import { backlogLine } from './backlog-fixtures';

const DELIVER_URL = '/api/admin/lines/l-pen/deliver';

function stub(respond: () => Response | Promise<Response> = () => jsonResponse(200, { line: {} })) {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) =>
    url === DELIVER_URL ? Promise.resolve(respond()) : Promise.resolve(jsonResponse(200, {})),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const posts = (f: ReturnType<typeof stub>) => f.mock.calls.filter((c) => c[0] === DELIVER_URL) as unknown as [string, RequestInit][];

function renderDialog(line: BacklogLine = backlogLine()) {
  const onDone = vi.fn(() => Promise.resolve());
  const onNotice = vi.fn();
  const onStale = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <DeliverMoreDialog line={line} onDone={onDone} onNotice={onNotice} onStale={onStale} onClose={() => {}} />
    </MeContext.Provider>,
  );
  return { onDone, onNotice, onStale };
}

const qtyBox = () => screen.getByLabelText('Số lượng giao');
const giao = () => screen.getByRole('button', { name: 'Giao' });
const setQty = (text: string) => fireEvent.change(qtyBox(), { target: { value: text } });
const noteOf = (el: HTMLElement) => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent;

afterEach(() => vi.unstubAllGlobals());

describe('DeliverMoreDialog — giao bổ sung một dòng còn nợ', () => {
  it('mặc định min(còn lại 3, tồn 10) = 3; tồn 2 < còn lại 3 → mặc định 2', () => {
    stub();
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Giao bổ sung Bút bi xanh cho Phạm Văn Đức' })).toBeInTheDocument();
    expect(screen.getByText('Tháng 10/2026 · còn 3 · tồn 10')).toBeInTheDocument();
    expect(qtyBox()).toHaveValue(3);
  });

  it('tồn 2 < còn lại 3 → mặc định 2; gõ 3 → vô hiệu + "Chỉ còn 2" gắn ô', () => {
    stub();
    renderDialog(backlogLine({ stock_qty: 2 }));
    expect(qtyBox()).toHaveValue(2);
    setQty('3');
    expect(giao()).toBeDisabled();
    expect(noteOf(qtyBox())).toBe('Chỉ còn 2');
  });

  it('biên dưới: 0 → vô hiệu + "Ít nhất 1"; 1 → bật', () => {
    stub();
    renderDialog();
    setQty('0');
    expect(giao()).toBeDisabled();
    expect(qtyBox()).toHaveAttribute('aria-invalid', 'true');
    expect(noteOf(qtyBox())).toBe('Ít nhất 1');
    setQty('1');
    expect(giao()).toBeEnabled();
    expect(qtyBox()).not.toHaveAttribute('aria-invalid');
  });

  it('biên trên: còn lại + 1 = 4 → vô hiệu + "Tối đa 3"; 3 → bật, gửi {qty: 3, expected_delivered_qty: 2}', async () => {
    const f = stub();
    const { onDone } = renderDialog();
    setQty('4');
    expect(giao()).toBeDisabled();
    expect(noteOf(qtyBox())).toBe('Tối đa 3');
    setQty('3');
    await userEvent.click(giao());
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(JSON.parse(String(posts(f)[0][1].body))).toEqual({ qty: 3, expected_delivered_qty: 2 });
  });

  it('dòng ngoài danh mục (tồn null) → chỉ giới hạn bởi còn lại', () => {
    stub();
    renderDialog(backlogLine({ item_id: null, stock_qty: null, name: 'Băng keo 2 mặt' }));
    expect(screen.getByText('Tháng 10/2026 · còn 3')).toBeInTheDocument();
    setQty('4');
    expect(noteOf(qtyBox())).toBe('Tối đa 3');
  });

  it('server DELIVER_EXCEEDS_QTY {remaining: 1} → "Chỉ còn 1 cần giao" gắn ô, nút vô hiệu tới khi sửa về 1', async () => {
    const { onDone, onNotice, onStale } = renderDialog();
    stub(() => jsonResponse(400, { code: 'DELIVER_EXCEEDS_QTY', remaining: 1 }));
    await userEvent.click(giao());
    await waitFor(() => expect(noteOf(qtyBox())).toBe('Chỉ còn 1 cần giao'));
    expect(giao()).toBeDisabled();
    setQty('1');
    expect(giao()).toBeEnabled();
    expect(onDone).not.toHaveBeenCalled();
    expect(onNotice).not.toHaveBeenCalled();
    expect(onStale).toHaveBeenCalledOnce();
  });

  it('server STOCK_INSUFFICIENT {available: 1} → "Chỉ còn 1" gắn ô', async () => {
    renderDialog();
    stub(() => jsonResponse(409, { code: 'STOCK_INSUFFICIENT', available: 1 }));
    await userEvent.click(giao());
    await waitFor(() => expect(noteOf(qtyBox())).toBe('Chỉ còn 1'));
  });

  it('server PERIOD_NOT_LOCKED → báo ở trang (onNotice)', async () => {
    const { onNotice } = renderDialog();
    stub(() => jsonResponse(409, { code: 'PERIOD_NOT_LOCKED' }));
    await userEvent.click(giao());
    await waitFor(() => expect(onNotice).toHaveBeenCalledWith('PERIOD_NOT_LOCKED'));
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
    await act(async () => release(jsonResponse(200, { line: {} })));
  });
});
