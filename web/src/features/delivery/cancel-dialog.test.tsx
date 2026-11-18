import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { ToastProvider } from '@/ui/toast-provider';
import { CancelDialog } from './cancel-dialog';
import type { BacklogLine, CancelReason } from './backlog.api';
import { backlogLine } from './backlog-fixtures';

const CANCEL_URL = '/api/admin/lines/l-pen/cancel-remaining';
const TITLE = 'Hủy nợ 3 cây Bút bi xanh của Phạm Văn Đức?';
const W23 = 'Phiếu gửi NCC tháng 10 đã tính 2 cây này — hủy thì hàng về dư vào kho.';

function stub(respond: () => Response | Promise<Response> = () => jsonResponse(200, { cancelled_now: 3 })) {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) =>
    url === CANCEL_URL ? Promise.resolve(respond()) : Promise.resolve(jsonResponse(200, {})),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const posts = (f: ReturnType<typeof stub>) => f.mock.calls.filter((c) => c[0] === CANCEL_URL) as unknown as [string, RequestInit][];
const sent = (f: ReturnType<typeof stub>, i = 0) => JSON.parse(String(posts(f)[i][1].body)) as Record<string, unknown>;

function renderDialog(opts: { line?: Partial<BacklogLine>; initialReason?: CancelReason } = {}) {
  const onDone = vi.fn(() => Promise.resolve());
  const onStale = vi.fn();
  const onClose = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <ToastProvider>
        <CancelDialog line={backlogLine(opts.line)} sentYm="2026-10" initialReason={opts.initialReason} onDone={onDone} onStale={onStale} onClose={onClose} />
      </ToastProvider>
    </MeContext.Provider>,
  );
  return { onDone, onStale, onClose };
}

const reasons = () => screen.getByRole('radiogroup', { name: 'Lý do hủy nợ' });
const pick = (name: string) => userEvent.click(within(reasons()).getByRole('radio', { name }));
const noteBox = () => screen.getByRole('textbox', { name: /^Ghi chú/ });
const submit = () => screen.getByRole('button', { name: 'Hủy nợ' });
const noteOf = (el: HTMLElement) => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent;
const setNote = (text: string) => fireEvent.change(noteBox(), { target: { value: text } });

afterEach(() => vi.unstubAllGlobals());

describe('CancelDialog — Hủy nợ với lý do có sẵn', () => {
  it('tiêu đề "Hủy nợ 3 cây Bút bi xanh của Phạm Văn Đức?"; 4 lựa chọn, chưa chọn sẵn; dòng "Nhân viên sẽ thấy lý do trong Lịch sử."; nút [Quay lại] [Hủy nợ], Hủy nợ vô hiệu', () => {
    stub();
    renderDialog();
    expect(screen.getByRole('dialog', { name: TITLE })).toBeInTheDocument();
    const radios = within(reasons()).getAllByRole('radio');
    expect(radios.map((r) => r.closest('label')?.textContent)).toEqual(['NCC hết hàng', 'Người nhận không cần nữa', 'Người đã nghỉ', 'Khác']);
    expect(radios.every((r) => !(r as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText('Nhân viên sẽ thấy lý do trong Lịch sử.')).toBeInTheDocument();
    const footer = screen.getByRole('button', { name: 'Quay lại' }).parentElement!;
    expect(within(footer).getAllByRole('button').map((b) => b.textContent)).toEqual(['Quay lại', 'Hủy nợ']);
    expect(submit()).toBeDisabled();
    expect(submit()).toHaveClass('btn--danger', 'btn--solid');
  });

  it('chọn "Người nhận không cần nữa" → Hủy nợ bật; gửi {reason_code: not_needed, expected_delivered_qty: 2, expected_qty: 5}, không có reason; kèm CSRF', async () => {
    const f = stub();
    const { onDone } = renderDialog();
    await pick('Người nhận không cần nữa');
    expect(submit()).toBeEnabled();
    await userEvent.click(submit());
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(sent(f)).toEqual({ reason_code: 'not_needed', expected_delivered_qty: 2, expected_qty: 5 });
    expect((posts(f)[0][1].headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-1');
  });

  it('lý do khác "Khác" (NCC hết hàng): ghi chú không bắt buộc, gửi kèm ghi chú đã trim', async () => {
    const f = stub();
    renderDialog();
    await pick('NCC hết hàng');
    expect(noteBox()).not.toBeRequired();
    setNote('  Đổi mẫu ');
    await userEvent.click(submit());
    await waitFor(() => expect(posts(f)).toHaveLength(1));
    expect(sent(f)).toEqual({ reason_code: 'adm_out_of_stock', reason: 'Đổi mẫu', expected_delivered_qty: 2, expected_qty: 5 });
  });

  it('biên "Khác": ghi chú bắt buộc; "  ab  " (trim 2) → vô hiệu; "  abc  " (3) → bật, gửi {reason_code: other, reason: "abc"}', async () => {
    const f = stub();
    renderDialog();
    await pick('Khác');
    expect(noteBox()).toBeRequired();
    expect(submit()).toBeDisabled();
    setNote('  ab  ');
    expect(submit()).toBeDisabled();
    setNote('  abc  ');
    expect(submit()).toBeEnabled();
    await userEvent.click(submit());
    await waitFor(() => expect(posts(f)).toHaveLength(1));
    expect(sent(f)).toEqual({ reason_code: 'other', reason: 'abc', expected_delivered_qty: 2, expected_qty: 5 });
  });

  it('biên độ dài đếm như server (NFC + trim): 200 chữ "ế" NFD + khoảng trắng → "200/200", gửi được 200 chữ NFC; chữ thứ 201 bị cắt', async () => {
    const f = stub();
    renderDialog();
    await pick('Khác');
    setNote(`${'ế'.normalize('NFD').repeat(200)} `);
    expect(screen.getByText('200/200')).toBeInTheDocument();
    setNote('ế'.normalize('NFD').repeat(201));
    expect(screen.getByText('200/200')).toBeInTheDocument();
    await userEvent.click(submit());
    await waitFor(() => expect(posts(f)).toHaveLength(1));
    expect(sent(f).reason).toBe('ế'.repeat(200));
  });

  it('initialReason user_left (?left=1) → "Người đã nghỉ" chọn sẵn, Hủy nợ bật ngay', () => {
    stub();
    renderDialog({ initialReason: 'user_left' });
    expect(within(reasons()).getByRole('radio', { name: 'Người đã nghỉ' })).toBeChecked();
    expect(submit()).toBeEnabled();
  });

  it('W23: counted_in_snapshot_qty 2 → khối cam "Phiếu gửi NCC tháng 10 đã tính 2 cây này — …", không chặn Hủy nợ', async () => {
    stub();
    renderDialog({ line: { counted_in_snapshot_qty: 2 } });
    expect(screen.getByText(W23)).toHaveClass('alert--warn');
    await pick('Người đã nghỉ');
    expect(submit()).toBeEnabled();
  });

  it.each([0, null])('W23: counted_in_snapshot_qty %p → không có khối', (n) => {
    stub();
    renderDialog({ line: { counted_in_snapshot_qty: n } });
    expect(screen.queryByText(/^Phiếu gửi NCC tháng/)).toBeNull();
  });

  it('"Quay lại" đóng hộp, không gửi', async () => {
    const f = stub();
    const { onClose } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(onClose).toHaveBeenCalled();
    expect(posts(f)).toHaveLength(0);
  });

  it('REASON_REQUIRED → lỗi gắn ô ghi chú, hộp vẫn mở', async () => {
    stub(() => jsonResponse(400, { code: 'REASON_REQUIRED', message: 'x' }));
    const { onDone } = renderDialog();
    await pick('Khác');
    setNote('abc');
    await userEvent.click(submit());
    await waitFor(() => expect(noteBox()).toHaveAttribute('aria-invalid', 'true'));
    expect(noteOf(noteBox())).toBe('Lý do "Khác" cần ghi chú ít nhất 3 ký tự.');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('VALIDATION {fields: ["reason"]} → "Tối đa 200 ký tự" gắn ô ghi chú', async () => {
    stub(() => jsonResponse(400, { code: 'VALIDATION', message: 'x', fields: ['reason'] }));
    renderDialog();
    await pick('Khác');
    setNote('abc');
    await userEvent.click(submit());
    await waitFor(() => expect(noteOf(noteBox())).toBe('Tối đa 200 ký tự'));
  });

  it('cancelled_now = 0 → toast info "Dòng này không còn nợ." và đóng (onDone)', async () => {
    stub(() => jsonResponse(200, { cancelled_now: 0 }));
    const { onDone } = renderDialog();
    await pick('Người đã nghỉ');
    await userEvent.click(submit());
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(await screen.findByText('Dòng này không còn nợ.')).toBeInTheDocument();
    expect(screen.queryByText(/^Đã hủy nợ/)).toBeNull();
  });

  it('cancelled_now = 3 → toast "Đã hủy nợ 3 cây Bút bi xanh của Phạm Văn Đức"', async () => {
    stub();
    renderDialog();
    await pick('Người đã nghỉ');
    await userEvent.click(submit());
    expect(await screen.findByText('Đã hủy nợ 3 cây Bút bi xanh của Phạm Văn Đức')).toBeInTheDocument();
  });

  it('STALE_UPDATE {qty: 4, delivered_qty: 3} → khối cảnh báo + tiêu đề "Hủy nợ 1 cây"; gửi lại dùng expected 3/4; lý do giữ nguyên', async () => {
    let first = true;
    const f = stub(() => {
      if (!first) return jsonResponse(200, { cancelled_now: 1 });
      first = false;
      return jsonResponse(409, { code: 'STALE_UPDATE', qty: 4, delivered_qty: 3 });
    });
    const { onDone, onStale } = renderDialog();
    await pick('Khác');
    setNote('abc');
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent('Dòng vừa thay đổi (đăng ký 4, đã giao 3) — kiểm tra lại.');
    expect(screen.getByRole('dialog', { name: 'Hủy nợ 1 cây Bút bi xanh của Phạm Văn Đức?' })).toBeInTheDocument();
    expect(noteBox()).toHaveValue('abc');
    expect(within(reasons()).getByRole('radio', { name: 'Khác' })).toBeChecked();
    expect(onStale).toHaveBeenCalledOnce();
    expect(onDone).not.toHaveBeenCalled();
    await userEvent.click(submit());
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(sent(f, 1)).toEqual({ reason_code: 'other', reason: 'abc', expected_delivered_qty: 3, expected_qty: 4 });
  });

  it.each([
    ['NOT_DEBT_YET', 'Đây là phần chưa nhận của tháng đang giao — giảm ở Tổng hợp nếu không giao nữa.'],
    ['PERIOD_NOT_LOCKED', 'Kỳ chưa khóa — chưa hủy nợ được.'],
    ['LINE_NOT_REVIEWED', 'Dòng chưa được duyệt — chưa hủy nợ được.'],
    ['LINE_REJECTED', 'Dòng vừa bị từ chối.'],
    ['LINE_NOT_FOUND', 'Dòng không còn trong phiếu.'],
  ])('%s → khối trong hộp "%s", không gắn ô ghi chú', async (code, text) => {
    stub(() => jsonResponse(409, { code }));
    renderDialog();
    await pick('Người đã nghỉ');
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(noteBox()).not.toHaveAttribute('aria-invalid');
  });

  it('bấm "Hủy nợ" hai lần sát nhau → chỉ một POST', async () => {
    let release!: (r: Response) => void;
    const f = stub(() => new Promise<Response>((r) => (release = r)));
    renderDialog();
    await pick('Người đã nghỉ');
    act(() => {
      submit().click();
      submit().click();
    });
    expect(posts(f)).toHaveLength(1);
    expect(submit()).toBeDisabled();
    await act(async () => release(jsonResponse(200, { cancelled_now: 3 })));
  });

  it('hủy xong có undo_id → toast kèm Hoàn tác; bấm thì POST undo/cancel với id đó (TC-18)', async () => {
    const f = stub(() => jsonResponse(200, { cancelled_now: 3, undo_id: 'u-c1' }));
    const { onDone } = renderDialog();
    await pick('Người nhận không cần nữa');
    await userEvent.click(submit());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác', hidden: true }));
    await waitFor(() => expect(f.mock.calls.some((c) => c[0] === '/api/admin/undo/cancel')).toBe(true));
    const call = f.mock.calls.find((c) => c[0] === '/api/admin/undo/cancel')!;
    expect(JSON.parse(String(call[1]?.body))).toEqual({ ids: ['u-c1'] });
  });
});
