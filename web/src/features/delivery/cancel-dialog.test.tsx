import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, jsonResponse, renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { ToastProvider } from '@/ui/toast-provider';
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
  const onStale = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <ToastProvider>
        <CancelDialog line={backlogLine()} onDone={onDone} onStale={onStale} onClose={() => {}} />
      </ToastProvider>
    </MeContext.Provider>,
  );
  return { onDone, onStale };
}

const reasonBox = () => screen.getByRole('textbox', { name: /^Lý do hủy nợ/ });
const submit = () => screen.getByRole('button', { name: 'Hủy nợ' });
const noteOf = (el: HTMLElement) => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent;
const setReason = (text: string) => fireEvent.change(reasonBox(), { target: { value: text } });

afterEach(() => vi.unstubAllGlobals());

describe('CancelDialog — hủy phần còn nợ của một dòng', () => {
  it('tiêu đề "Hủy 3 cây còn lại của Phạm Văn Đức?"; mô tả nêu món, tháng, tên ngắn "Đức" thấy lý do; ô lý do có gợi ý', () => {
    stub();
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Hủy 3 cây còn lại của Phạm Văn Đức?' })).toBeInTheDocument();
    expect(screen.getByText('Bút bi xanh · Tháng 10. Phần này sẽ không giao nữa; Đức thấy lý do trong Lịch sử.')).toBeInTheDocument();
    expect(noteOf(reasonBox())).toBe('Bắt buộc, ít nhất 3 ký tự. Ghi vào Nhật ký.');
  });

  it('biên lý do: "  ab  " (trim 2) → nút vô hiệu; "  abc  " (trim 3) → bật, gửi {reason: "abc", expected_delivered_qty: 2, expected_qty: 5}', async () => {
    const f = stub();
    const { onDone } = renderDialog();
    expect(submit()).toBeDisabled();
    setReason('  ab  ');
    expect(submit()).toBeDisabled();
    setReason('  abc  ');
    expect(submit()).toBeEnabled();
    await userEvent.click(submit());
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(JSON.parse(String(posts(f)[0][1].body))).toEqual({ reason: 'abc', expected_delivered_qty: 2, expected_qty: 5 });
    expect((posts(f)[0][1].headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-1');
  });

  it('biên độ dài: ô lý do có maxLength 500; 500 ký tự gửi được', async () => {
    const f = stub();
    renderDialog();
    expect(reasonBox()).toHaveAttribute('maxlength', '500');
    setReason('a'.repeat(500));
    expect(submit()).toBeEnabled();
    await userEvent.click(submit());
    await waitFor(() => expect(posts(f)).toHaveLength(1));
    expect(JSON.parse(String(posts(f)[0][1].body)).reason).toHaveLength(500);
  });

  it('REASON_REQUIRED → lỗi gắn ô lý do, hộp vẫn mở', async () => {
    stub(() => jsonResponse(400, { code: 'REASON_REQUIRED', message: 'x' }));
    const { onDone } = renderDialog();
    setReason('abc');
    await userEvent.click(submit());
    await waitFor(() => expect(reasonBox()).toHaveAttribute('aria-invalid', 'true'));
    expect(noteOf(reasonBox())).toBe('Nhập lý do hủy nợ (ít nhất 3 ký tự).');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('VALIDATION {fields: ["reason"]} → "Tối đa 500 ký tự" gắn ô lý do', async () => {
    stub(() => jsonResponse(400, { code: 'VALIDATION', message: 'x', fields: ['reason'] }));
    renderDialog();
    setReason('abc');
    await userEvent.click(submit());
    await waitFor(() => expect(noteOf(reasonBox())).toBe('Tối đa 500 ký tự'));
  });

  it('cancelled_now = 0 → toast info "Dòng này không còn nợ." và đóng (onDone)', async () => {
    stub(() => jsonResponse(200, { cancelled_now: 0 }));
    const { onDone } = renderDialog();
    setReason('abc');
    await userEvent.click(submit());
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(await screen.findByText('Dòng này không còn nợ.')).toBeInTheDocument();
    expect(screen.queryByText(/^Đã hủy nợ/)).toBeNull();
  });

  it('cancelled_now = 3 → toast "Đã hủy nợ 3 cây Bút bi xanh của Phạm Văn Đức"', async () => {
    stub();
    renderDialog();
    setReason('abc');
    await userEvent.click(submit());
    expect(await screen.findByText('Đã hủy nợ 3 cây Bút bi xanh của Phạm Văn Đức')).toBeInTheDocument();
  });

  it('STALE_UPDATE {qty: 4, delivered_qty: 3} → khối cảnh báo + tiêu đề "Hủy 1 cây"; gửi lại dùng expected 3/4; lý do giữ nguyên', async () => {
    let first = true;
    const f = stub(() => {
      if (!first) return jsonResponse(200, { cancelled_now: 1 });
      first = false;
      return jsonResponse(409, { code: 'STALE_UPDATE', qty: 4, delivered_qty: 3 });
    });
    const { onDone, onStale } = renderDialog();
    setReason('abc');
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent('Dòng vừa thay đổi (đăng ký 4, đã giao 3) — kiểm tra lại.');
    expect(screen.getByRole('dialog', { name: 'Hủy 1 cây còn lại của Phạm Văn Đức?' })).toBeInTheDocument();
    expect(reasonBox()).toHaveValue('abc');
    expect(onStale).toHaveBeenCalledOnce();
    expect(onDone).not.toHaveBeenCalled();
    await userEvent.click(submit());
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(JSON.parse(String(posts(f)[1][1].body))).toEqual({ reason: 'abc', expected_delivered_qty: 3, expected_qty: 4 });
  });

  it.each([
    ['PERIOD_NOT_LOCKED', 'Kỳ chưa khóa — chưa hủy nợ được.'],
    ['LINE_NOT_REVIEWED', 'Dòng chưa được duyệt — chưa hủy nợ được.'],
    ['LINE_REJECTED', 'Dòng vừa bị từ chối.'],
    ['LINE_NOT_FOUND', 'Dòng không còn trong phiếu.'],
  ])('%s → khối trong hộp "%s", không gắn ô lý do', async (code, text) => {
    stub(() => jsonResponse(409, { code }));
    renderDialog();
    setReason('abc');
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
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
