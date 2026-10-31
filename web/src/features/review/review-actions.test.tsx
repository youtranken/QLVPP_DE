import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { ReviewActions, type ReviewableLine } from './review-actions';
import { reviewResult } from './review-fixtures';

const LINE: ReviewableLine = {
  id: 'l-1',
  custom_name: 'Băng keo 2 mặt',
  custom_unit: 'cai',
  image_file_id: 'f-line',
  qty: 2,
  review_status: 'pending',
  review_note: null,
};

function stub(review: (body: Record<string, unknown>) => Response) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/admin/lines/l-1/review') return Promise.resolve(review(JSON.parse(String(init?.body))));
    return Promise.resolve(jsonResponse(200, []));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderActions(line: ReviewableLine = LINE) {
  const onDone = vi.fn();
  const onStale = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <ConfirmProvider>
        <ReviewActions line={line} onDone={onDone} onStale={onStale} />
      </ConfirmProvider>
    </MeContext.Provider>,
  );
  return { onDone, onStale };
}

const block = () => screen.getByRole('group', { name: 'Xử lý Băng keo 2 mặt' });

afterEach(() => vi.unstubAllGlobals());

describe('ReviewActions — 3 nút mở hộp riêng, áp dụng ngay', () => {
  it('ba nút: Chấp nhận, Thêm vào danh mục…, Từ chối…', () => {
    stub(() => jsonResponse(500, {}));
    renderActions();
    expect(within(block()).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Chấp nhận',
      'Thêm vào danh mục…',
      'Từ chối…',
    ]);
  });

  it('mỗi nút có tên kèm tên dòng — nhiều dòng ngoài DM trong một ngăn vẫn phân biệt được', () => {
    stub(() => jsonResponse(500, {}));
    renderActions();
    expect(within(block()).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Chấp nhận — Băng keo 2 mặt',
      'Thêm vào danh mục… — Băng keo 2 mặt',
      'Từ chối… — Băng keo 2 mặt',
    ]);
  });

  it('Chấp nhận: hộp xác nhận ngắn → POST {action: accept} → khối thành nhãn "Đã chấp nhận", onDone nhận request_updated_at', async () => {
    const result = reviewResult('accepted');
    const fetchMock = stub(() => jsonResponse(200, result));
    const { onDone } = renderActions();
    await userEvent.click(screen.getByRole('button', { name: 'Chấp nhận — Băng keo 2 mặt' }));
    const dialog = screen.getByRole('dialog', { name: 'Chấp nhận “Băng keo 2 mặt”?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Chấp nhận' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(result, expect.objectContaining({ action: expect.any(String) })));
    expect(onDone.mock.calls[0][0].request_updated_at).toBe('2026-11-05T08:00:00.000Z');
    const call = fetchMock.mock.calls.find((c) => c[0] === '/api/admin/lines/l-1/review')!;
    expect(call[1]?.method).toBe('POST');
    expect(JSON.parse(String(call[1]?.body))).toEqual({ action: 'accept' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Đã chấp nhận')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Từ chối…/ })).toBeNull();
  });

  it('Từ chối…: lý do trống (hoặc < 3 ký tự) → nút Từ chối vô hiệu; nhập lý do → gửi note, nhãn "Từ chối: <lý do>"', async () => {
    const result = reviewResult('rejected', { review_note: 'Đã có trong kho' });
    const fetchMock = stub(() => jsonResponse(200, result));
    const { onDone } = renderActions();
    await userEvent.click(screen.getByRole('button', { name: 'Từ chối… — Băng keo 2 mặt' }));
    const dialog = screen.getByRole('dialog', { name: 'Từ chối “Băng keo 2 mặt”' });
    const submit = within(dialog).getByRole('button', { name: 'Từ chối' });
    expect(submit).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/^Lý do từ chối/), '  ab ');
    expect(submit).toBeDisabled();
    await userEvent.clear(within(dialog).getByLabelText(/^Lý do từ chối/));
    await userEvent.type(within(dialog).getByLabelText(/^Lý do từ chối/), 'Đã có trong kho');
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(result, expect.objectContaining({ action: expect.any(String) })));
    const call = fetchMock.mock.calls.find((c) => c[0] === '/api/admin/lines/l-1/review')!;
    expect(JSON.parse(String(call[1]?.body))).toEqual({ action: 'reject', note: 'Đã có trong kho' });
    expect(screen.getByText('Từ chối: Đã có trong kho')).toBeInTheDocument();
  });

  it('REASON_REQUIRED từ server → lỗi gắn vào ô lý do, hộp vẫn mở', async () => {
    stub(() => jsonResponse(400, { code: 'REASON_REQUIRED' }));
    const { onDone } = renderActions();
    await userEvent.click(screen.getByRole('button', { name: 'Từ chối… — Băng keo 2 mặt' }));
    const dialog = screen.getByRole('dialog', { name: 'Từ chối “Băng keo 2 mặt”' });
    await userEvent.type(within(dialog).getByLabelText(/^Lý do từ chối/), 'abc');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Từ chối' }));
    expect(await within(dialog).findByText('Nhập lý do từ chối (ít nhất 3 ký tự).')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Lý do từ chối/)).toHaveAttribute('aria-invalid', 'true');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('409 LINE_ALREADY_REVIEWED → khối trong hộp (hộp mở); đóng hộp mới gọi onStale để làm mới', async () => {
    stub(() => jsonResponse(409, { code: 'LINE_ALREADY_REVIEWED' }));
    const { onDone, onStale } = renderActions();
    await userEvent.click(screen.getByRole('button', { name: 'Chấp nhận — Băng keo 2 mặt' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Chấp nhận' }));
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('Dòng này vừa được xử lý ở nơi khác.');
    expect(onStale).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Quay lại' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onStale).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('dòng đã xử lý (prop review_status khác pending) → chỉ hiện nhãn trạng thái, không nút', () => {
    stub(() => jsonResponse(500, {}));
    renderActions({ ...LINE, review_status: 'rejected', review_note: 'Không cần' });
    expect(screen.getByText('Từ chối: Không cần')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
