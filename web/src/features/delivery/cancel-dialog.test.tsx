import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, jsonResponse, renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { CancelDialog } from './cancel-dialog';
import { backlogLine } from './backlog-fixtures';

const CANCEL_URL = '/api/admin/lines/l-pen/cancel-remaining';

function stub(respond: () => Response | Promise<Response> = () => jsonResponse(200, { cancelled_now: 3 })) {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) =>
    url === CANCEL_URL ? Promise.resolve(respond()) : Promise.resolve(jsonResponse(200, {})),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const posts = (f: ReturnType<typeof stub>) => f.mock.calls.filter((c) => c[0] === CANCEL_URL) as unknown as [string, RequestInit][];

function renderDialog() {
  const onDone = vi.fn(() => Promise.resolve());
  const onNotice = vi.fn();
  const onClose = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <CancelDialog line={backlogLine()} onDone={onDone} onNotice={onNotice} onClose={onClose} />
    </MeContext.Provider>,
  );
  return { onDone, onNotice, onClose };
}

const reasonBox = () => screen.getByLabelText('Lý do hủy nợ');
const submit = () => screen.getByRole('button', { name: 'Hủy nợ' });
const noteOf = (el: HTMLElement) => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent;
const setReason = (text: string) => fireEvent.change(reasonBox(), { target: { value: text } });

afterEach(() => vi.unstubAllGlobals());

describe('CancelDialog — hủy phần còn nợ của một dòng', () => {
  it('tiêu đề "Hủy 3 cây còn lại của Phạm Văn Đức?", nêu món và kỳ', () => {
    stub();
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Hủy 3 cây còn lại của Phạm Văn Đức?' })).toBeInTheDocument();
    expect(screen.getByText('Bút bi xanh · Tháng 10/2026')).toBeInTheDocument();
  });

  it('biên lý do: "  ab  " (trim 2) → nút "Hủy nợ" vô hiệu; "  abc  " (trim 3) → bật, gửi {reason: "abc", expected_delivered_qty: 2, expected_qty: 5}', async () => {
    const f = stub();
    const { onDone } = renderDialog();
    expect(submit()).toBeDisabled();
    await userEvent.type(reasonBox(), '  ab  ');
    expect(submit()).toBeDisabled();
    setReason('  abc  ');
    expect(submit()).toBeEnabled();
    await userEvent.click(submit());
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(posts(f)).toHaveLength(1);
    expect(JSON.parse(String(posts(f)[0][1].body))).toEqual({ reason: 'abc', expected_delivered_qty: 2, expected_qty: 5 });
    expect((posts(f)[0][1].headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-1');
  });

  it('biên độ dài: 500 ký tự → bật; 501 → vô hiệu + "Tối đa 500 ký tự" gắn ô lý do', () => {
    stub();
    renderDialog();
    setReason('a'.repeat(500));
    expect(submit()).toBeEnabled();
    expect(reasonBox()).not.toHaveAttribute('aria-invalid');
    setReason('a'.repeat(501));
    expect(submit()).toBeDisabled();
    expect(reasonBox()).toHaveAttribute('aria-invalid', 'true');
    expect(noteOf(reasonBox())).toBe('Tối đa 500 ký tự');
  });

  it('server trả REASON_REQUIRED → lỗi gắn ô lý do, hộp vẫn mở', async () => {
    stub(() => jsonResponse(400, { code: 'REASON_REQUIRED', message: 'x' }));
    const { onDone, onNotice } = renderDialog();
    setReason('abc');
    await userEvent.click(submit());
    await waitFor(() => expect(reasonBox()).toHaveAttribute('aria-invalid', 'true'));
    expect(noteOf(reasonBox())).toBe('Nhập lý do hủy nợ (ít nhất 3 ký tự).');
    expect(onDone).not.toHaveBeenCalled();
    expect(onNotice).not.toHaveBeenCalled();
  });

  it('server trả VALIDATION {fields: ["reason"]} → "Tối đa 500 ký tự" gắn ô lý do', async () => {
    stub(() => jsonResponse(400, { code: 'VALIDATION', message: 'x', fields: ['reason'] }));
    renderDialog();
    setReason('abc');
    await userEvent.click(submit());
    await waitFor(() => expect(noteOf(reasonBox())).toBe('Tối đa 500 ký tự'));
  });

  it('server trả STALE_UPDATE / PERIOD_NOT_LOCKED → báo ở trang (onNotice), không gắn ô', async () => {
    stub(() => jsonResponse(409, { code: 'STALE_UPDATE', message: 'x', delivered_qty: 3 }));
    const { onNotice, onDone } = renderDialog();
    setReason('abc');
    await userEvent.click(submit());
    await waitFor(() => expect(onNotice).toHaveBeenCalledWith('STALE_UPDATE'));
    expect(onDone).not.toHaveBeenCalled();
    expect(reasonBox()).not.toHaveAttribute('aria-invalid');
  });

  it('bấm "Hủy nợ" hai lần sát nhau → chỉ một POST', async () => {
    let release!: (r: Response) => void;
    const f = stub(() => new Promise<Response>((r) => (release = r)));
    renderDialog();
    setReason('abc');
    act(() => {
      submit().click();
      submit().click();
    });
    expect(posts(f)).toHaveLength(1);
    expect(submit()).toBeDisabled();
    await act(async () => release(jsonResponse(200, { cancelled_now: 3 })));
  });
});
