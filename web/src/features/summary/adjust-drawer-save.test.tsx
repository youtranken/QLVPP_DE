import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { useReviewLines } from '@/features/review/review.api';
import { adminRequest } from './adjust-fixtures';
import { loadCalls, putBody, putCalls, reasonBox, renderDrawer, row, saveButton, stubAdjust } from './adjust-render-fixtures';

afterEach(() => vi.unstubAllGlobals());

// Trang Món ngoài DM đang mở song song: danh sách của nó phải tải lại khi phiếu đổi
function ReviewListProbe() {
  useReviewLines('pending', '');
  return null;
}

describe('AdjustDrawer — lưu và lý do', () => {
  it('kỳ khóa, lý do ngắn: FE không chặn; dòng giảm gửi reason_code other + ghi chú đã trim, không reason cấp phiếu; server REASON_REQUIRED → lỗi gắn ô lý do', async () => {
    const f = stubAdjust({ put: () => jsonResponse(400, { code: 'REASON_REQUIRED', line_id: 'l-note' }) });
    const { drawer, onClose } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Bớt Giấy note vàng' }));
    await userEvent.type(reasonBox(drawer), ' ab ');
    expect(saveButton(drawer)).toBeEnabled();
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(reasonBox(drawer)).toHaveAttribute('aria-invalid', 'true'));
    expect(reasonBox(drawer)).toHaveAccessibleDescription('Kỳ đã khóa — nhập lý do điều chỉnh (ít nhất 3 ký tự).');
    expect(putBody(f)).toEqual({
      lines: [
        { id: 'l-pen', qty: 10, expected_qty: 10 },
        { id: 'l-note', qty: 2, expected_qty: 3, reason_code: 'other', reason_note: 'ab' },
        { id: 'l-tape', qty: 2, expected_qty: 2 },
      ],
      expected_updated_at: '2026-10-05T07:20:00.000Z',
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('lý do dài hơn 200 mã điểm → ghi chú cắt còn đúng 200 mã điểm', async () => {
    const f = stubAdjust();
    const { drawer, onClose } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Bớt Giấy note vàng' }));
    await userEvent.click(reasonBox(drawer));
    await userEvent.paste('😀'.repeat(150) + 'x'.repeat(100));
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const note = putBody(f).lines[1].reason_note as string;
    expect([...note]).toHaveLength(200);
    expect(note).toBe('😀'.repeat(150) + 'x'.repeat(50));
  });

  it('dòng giảm không lý do → reason_code other, không có reason_note', async () => {
    const f = stubAdjust();
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Bớt Giấy note vàng' }));
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(putCalls(f)).toHaveLength(1));
    expect(putBody(f).lines[1]).toEqual({ id: 'l-note', qty: 2, expected_qty: 3, reason_code: 'other' });
  });

  it('chưa sửa gì → Lưu vô hiệu (không có gì để gửi)', async () => {
    stubAdjust();
    const { drawer } = await renderDrawer();
    expect(saveButton(drawer)).toBeDisabled();
  });

  it('thêm món chỉ Hành chính → body đủ dòng cũ + {item_id, qty}, lý do, expected_updated_at; xong: toast "Đã lưu điều chỉnh phiếu của …", đóng', async () => {
    const f = stubAdjust();
    const { drawer, onClose } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: '+ Thêm món vào phiếu' }));
    await userEvent.type(within(drawer).getByRole('searchbox', { name: 'Tìm món trong danh mục' }), 'a4');
    await userEvent.click(within(drawer).getByRole('button', { name: /Giấy A4 Double A/ }));
    await userEvent.type(reasonBox(drawer), 'Bổ sung giấy in bản vẽ');
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await screen.findByText('Đã lưu điều chỉnh phiếu của Nguyễn Văn An')).toBeInTheDocument();
    expect(putBody(f)).toEqual({
      lines: [
        { id: 'l-pen', qty: 10, expected_qty: 10 },
        { id: 'l-note', qty: 3, expected_qty: 3 },
        { id: 'l-tape', qty: 2, expected_qty: 2 },
        { item_id: 'i-a4', qty: 1 },
      ],
      expected_updated_at: '2026-10-05T07:20:00.000Z',
    });
  });

  it('server trả request: null (bỏ hết dòng) → toast "Đã bỏ phiếu của …"', async () => {
    stubAdjust({ views: [adminRequest({ is_open: true })], put: () => jsonResponse(200, { request: null }) });
    const { drawer, onClose } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Bỏ Giấy note vàng khỏi phiếu' }));
    await userEvent.click(saveButton(drawer));
    expect(await screen.findByText('Đã bỏ phiếu của Nguyễn Văn An')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('bỏ dòng → gửi qty 0 (mọi dòng có mặt), reason_code other, không có reason cấp phiếu', async () => {
    const f = stubAdjust({ views: [adminRequest({ is_open: true, period_ym: '2026-11' })] });
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Bỏ Giấy note vàng khỏi phiếu' }));
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(putCalls(f)).toHaveLength(1));
    expect(putBody(f)).toEqual({
      lines: [
        { id: 'l-pen', qty: 10, expected_qty: 10 },
        { id: 'l-note', qty: 0, expected_qty: 3, reason_code: 'other' },
        { id: 'l-tape', qty: 2, expected_qty: 2 },
      ],
      expected_updated_at: '2026-10-05T07:20:00.000Z',
    });
  });

  it('bấm đúp "Lưu điều chỉnh" → PUT đúng 1 lần, nút "Đang lưu…" vô hiệu', async () => {
    let release: (r: Response) => void = () => {};
    const f = stubAdjust({ put: () => new Promise<Response>((r) => (release = r)) });
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Giấy note vàng' }));
    await userEvent.type(reasonBox(drawer), 'Sửa số');
    await userEvent.dblClick(saveButton(drawer));
    expect(await within(drawer).findByRole('button', { name: 'Đang lưu…' })).toBeDisabled();
    release(jsonResponse(200, { request: adminRequest() }));
    await waitFor(() => expect(screen.queryByText('Đang lưu…')).toBeNull());
    expect(putCalls(f)).toHaveLength(1);
  });

  it('lưu xong → danh sách món ngoài danh mục chờ xem tải lại', async () => {
    const f = stubAdjust();
    const { drawer } = await renderDrawer({ extra: <ReviewListProbe /> });
    const reviewCalls = () => f.mock.calls.filter((c) => String(c[0]).startsWith('/api/admin/review?')).length;
    await waitFor(() => expect(reviewCalls()).toBe(1));
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Giấy note vàng' }));
    await userEvent.type(reasonBox(drawer), 'Bổ sung');
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(reviewCalls()).toBe(2));
  });
});

describe('AdjustDrawer — lỗi server đúng chỗ', () => {
  it('QTY_BELOW_DELIVERED {line_id} → câu lỗi ở đúng dòng, ngăn vẫn mở', async () => {
    stubAdjust({ put: () => jsonResponse(400, { code: 'QTY_BELOW_DELIVERED', line_id: 'l-pen', delivered: 3 }) });
    const { drawer, onClose } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await userEvent.type(reasonBox(drawer), 'Sửa số');
    await userEvent.click(saveButton(drawer));
    const pen = row(drawer, 'Bút bi xanh');
    expect(await within(pen).findByText('Không ít hơn số đã giao (3).')).toBeInTheDocument();
    expect(within(pen).getByRole('spinbutton')).toHaveAttribute('aria-invalid', 'true');
    expect(within(row(drawer, 'Giấy note vàng')).queryByText(/Không ít hơn/)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('QTY_EXCEEDS_MAX {line_index} trỏ dòng mới thêm → lỗi ở dòng mới', async () => {
    stubAdjust({ put: () => jsonResponse(400, { code: 'QTY_EXCEEDS_MAX', line_index: 3, max: 20 }) });
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: '+ Thêm món vào phiếu' }));
    await userEvent.type(within(drawer).getByRole('searchbox', { name: 'Tìm món trong danh mục' }), 'kẹp');
    await userEvent.click(within(drawer).getByRole('button', { name: /Kẹp giấy 33 mm/ }));
    await userEvent.type(reasonBox(drawer), 'Thêm kẹp');
    await userEvent.click(saveButton(drawer));
    expect(await within(row(drawer, 'Kẹp giấy 33 mm')).findByText('Tối đa 20/tháng.')).toBeInTheDocument();
  });

  it('STALE_UPDATE → khối "Nhân viên vừa sửa…" + "Tải bản mới nhất"; bấm → tải lại, nháp bỏ, giữ lý do, khối ẩn', async () => {
    const fresh = adminRequest({ updated_at: '2026-10-06T01:00:00.000Z' });
    fresh.lines[1] = { ...fresh.lines[1], qty: 4 };
    const f = stubAdjust({ views: [adminRequest(), fresh], put: () => jsonResponse(409, { code: 'STALE_UPDATE' }) });
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Giấy note vàng' }));
    await userEvent.type(reasonBox(drawer), 'An báo nhầm');
    await userEvent.click(saveButton(drawer));
    expect(await within(drawer).findByRole('alert')).toHaveTextContent('Phiếu vừa được người khác sửa — tải lại.');
    expect(loadCalls(f)).toHaveLength(1);
    await userEvent.click(within(drawer).getByRole('button', { name: 'Tải bản mới nhất' }));
    await waitFor(() => expect(within(drawer).getByRole('spinbutton', { name: 'Giấy note vàng' })).toHaveValue(4));
    expect(loadCalls(f)).toHaveLength(2);
    expect(within(drawer).queryByText(/^Phiếu vừa được người khác sửa/)).toBeNull();
    expect(within(drawer).queryByText(/^Trước khi sửa/)).toBeNull();
    expect(reasonBox(drawer)).toHaveValue('An báo nhầm');
  });

  it.each([
    ['REQUEST_NOT_FOUND', 404, 'Phiếu không còn.'],
    ['PERIOD_LOCKED', 409, 'Kỳ đã khóa — không lưu được thay đổi này.'],
  ])('%s → khối đầu thân ngăn', async (code, status, text) => {
    stubAdjust({ put: () => jsonResponse(status, { code }) });
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Giấy note vàng' }));
    await userEvent.type(reasonBox(drawer), 'Sửa số');
    await userEvent.click(saveButton(drawer));
    expect(await within(drawer).findByRole('alert')).toHaveTextContent(text);
  });
});

describe('AdjustDrawer — ↑/↓ chuyển người', () => {
  it('chưa sửa: ↓ gọi onNext ngay; đã sửa: ↓ hỏi bỏ thay đổi, Bỏ thay đổi mới chuyển', async () => {
    stubAdjust();
    const onNext = vi.fn();
    const { drawer } = await renderDrawer({ onNext });
    within(drawer).getByRole('button', { name: 'Hủy' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onNext).toHaveBeenCalledTimes(1);
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Giấy note vàng' }));
    await userEvent.keyboard('{ArrowDown}');
    expect(await screen.findByText('Bỏ thay đổi chưa lưu?')).toBeInTheDocument();
    expect(onNext).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ thay đổi' }));
    expect(onNext).toHaveBeenCalledTimes(2);
  });
});
