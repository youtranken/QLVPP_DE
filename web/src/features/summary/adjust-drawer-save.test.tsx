import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { useReviewLines } from '@/features/review/review.api';
import { adminRequest } from './adjust-fixtures';
import { less, loadCalls, noteBox, pick, putBody, putCalls, renderDrawer, row, saveButton, stubAdjust } from './adjust-render-fixtures';

afterEach(() => vi.unstubAllGlobals());

// Trang Món ngoài DM đang mở song song: danh sách của nó phải tải lại khi phiếu đổi
function ReviewListProbe() {
  useReviewLines('pending', '');
  return null;
}

const NOTE = 'Giấy note vàng';

// Hạ Giấy note vàng 3 → 2 với một lý do (và ghi chú nếu có)
async function reduceNote(drawer: HTMLElement, reason = 'Vượt định mức', note?: string) {
  await userEvent.click(less(drawer, NOTE));
  await userEvent.click(pick(drawer, NOTE, reason));
  if (note !== undefined) await userEvent.type(noteBox(drawer, NOTE), note);
}

describe('AdjustDrawer — lưu với lý do từng dòng', () => {
  it('giảm 3 → 2 "Vượt định mức" + ghi chú " ab " → dòng đó gửi reason_code/ghi chú đã trim; dòng khác không lý do; toast + đóng', async () => {
    const f = stubAdjust();
    const { drawer, onClose } = await renderDrawer();
    await reduceNote(drawer, 'Vượt định mức', ' ab ');
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await screen.findByText('Đã lưu điều chỉnh phiếu của Nguyễn Văn An')).toBeInTheDocument();
    expect(putBody(f)).toEqual({
      lines: [
        { id: 'l-pen', qty: 10, expected_qty: 10 },
        { id: 'l-note', qty: 2, expected_qty: 3, reason_code: 'over_quota', reason_note: 'ab' },
        { id: 'l-tape', qty: 2, expected_qty: 2 },
      ],
      expected_updated_at: '2026-10-05T07:20:00.000Z',
    });
  });

  it.each([
    ['ADM không còn hàng', 'adm_out_of_stock'],
    ['Trùng với phiếu khác', 'duplicate'],
    ['Người đã nghỉ', 'user_left'],
  ])('"%s" không ghi chú → reason_code %s, không reason_note', async (label, code) => {
    const f = stubAdjust();
    const { drawer } = await renderDrawer();
    await reduceNote(drawer, label);
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(putCalls(f)).toHaveLength(1));
    expect(putBody(f).lines[1]).toEqual({ id: 'l-note', qty: 2, expected_qty: 3, reason_code: code });
  });

  it('"Khác" + "abc" → reason_code other + reason_note', async () => {
    const f = stubAdjust();
    const { drawer } = await renderDrawer();
    await reduceNote(drawer, 'Khác', 'abc');
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(putCalls(f)).toHaveLength(1));
    expect(putBody(f).lines[1]).toEqual({ id: 'l-note', qty: 2, expected_qty: 3, reason_code: 'other', reason_note: 'abc' });
  });

  it('ghi chú dán 150 emoji + 100 chữ → lưu đúng 200 mã điểm', async () => {
    const f = stubAdjust();
    const { drawer, onClose } = await renderDrawer();
    await reduceNote(drawer);
    await userEvent.click(noteBox(drawer, NOTE));
    await userEvent.paste('😀'.repeat(150) + 'x'.repeat(100));
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const note = putBody(f).lines[1].reason_note as string;
    expect([...note]).toHaveLength(200);
    expect(note).toBe('😀'.repeat(150) + 'x'.repeat(50));
  });

  it('dòng giảm rồi về lại số cũ (nháp lý do còn) → không gửi lý do dòng đó', async () => {
    const f = stubAdjust();
    const { drawer } = await renderDrawer();
    await reduceNote(drawer, 'Khác', 'abc');
    const box = within(drawer).getByRole('spinbutton', { name: NOTE });
    await userEvent.clear(box);
    await userEvent.type(box, '3');
    await userEvent.click(less(drawer, 'Bút bi xanh'));
    await userEvent.click(pick(drawer, 'Bút bi xanh', 'Trùng với phiếu khác'));
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(putCalls(f)).toHaveLength(1));
    expect(putBody(f).lines).toEqual([
      { id: 'l-pen', qty: 9, expected_qty: 10, reason_code: 'duplicate' },
      { id: 'l-note', qty: 3, expected_qty: 3 },
      { id: 'l-tape', qty: 2, expected_qty: 2 },
    ]);
  });

  it('bỏ dòng → qty 0 + lý do của dòng (mọi dòng có mặt)', async () => {
    const f = stubAdjust();
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Bỏ Giấy note vàng khỏi phiếu' }));
    await userEvent.click(pick(drawer, NOTE, 'Trùng với phiếu khác'));
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(putCalls(f)).toHaveLength(1));
    expect(putBody(f)).toEqual({
      lines: [
        { id: 'l-pen', qty: 10, expected_qty: 10 },
        { id: 'l-note', qty: 0, expected_qty: 3, reason_code: 'duplicate' },
        { id: 'l-tape', qty: 2, expected_qty: 2 },
      ],
      expected_updated_at: '2026-10-05T07:20:00.000Z',
    });
  });

  it('chưa sửa gì → Lưu vô hiệu; còn dòng giảm thiếu lý do → Lưu vô hiệu, không PUT', async () => {
    const f = stubAdjust();
    const { drawer } = await renderDrawer();
    expect(saveButton(drawer)).toBeDisabled();
    await userEvent.click(less(drawer, NOTE));
    await userEvent.click(less(drawer, 'Bút bi xanh'));
    await userEvent.click(pick(drawer, 'Bút bi xanh', 'Vượt định mức'));
    expect(saveButton(drawer)).toBeDisabled();
    await userEvent.click(saveButton(drawer));
    expect(putCalls(f)).toHaveLength(0);
  });

  it('bấm đúp "Lưu điều chỉnh" → PUT đúng 1 lần, nút "Đang lưu…" vô hiệu', async () => {
    let release: (r: Response) => void = () => {};
    const f = stubAdjust({ put: () => new Promise<Response>((r) => (release = r)) });
    const { drawer } = await renderDrawer();
    await reduceNote(drawer);
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
    await reduceNote(drawer);
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(reviewCalls()).toBe(2));
  });
});

describe('AdjustDrawer — lỗi server đúng chỗ', () => {
  it('REASON_REQUIRED {line_id} → câu lỗi dưới đúng dòng, ngăn vẫn mở', async () => {
    stubAdjust({ put: () => jsonResponse(400, { code: 'REASON_REQUIRED', line_id: 'l-note' }) });
    const { drawer, onClose } = await renderDrawer();
    await reduceNote(drawer);
    await userEvent.click(saveButton(drawer));
    expect(await within(row(drawer, NOTE)).findByText('Chọn lý do giảm (Khác cần ghi ít nhất 3 chữ).')).toBeInTheDocument();
    expect(within(row(drawer, 'Bút bi xanh')).queryByText(/Chọn lý do giảm/)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('VALIDATION lines.reason_note {line_index: 1} → lỗi dưới dòng thứ 2', async () => {
    stubAdjust({ put: () => jsonResponse(400, { code: 'VALIDATION', fields: ['lines.reason_note'], line_index: 1 }) });
    const { drawer } = await renderDrawer();
    await reduceNote(drawer);
    await userEvent.click(saveButton(drawer));
    expect(await within(row(drawer, NOTE)).findByText('Ghi thêm tối đa 200 ký tự.')).toBeInTheDocument();
  });

  it('QTY_BELOW_DELIVERED {line_id} → câu lỗi ở đúng dòng, ô số aria-invalid', async () => {
    stubAdjust({ put: () => jsonResponse(400, { code: 'QTY_BELOW_DELIVERED', line_id: 'l-pen', delivered: 3 }) });
    const { drawer, onClose } = await renderDrawer();
    await userEvent.click(less(drawer, 'Bút bi xanh'));
    await userEvent.click(pick(drawer, 'Bút bi xanh', 'Vượt định mức'));
    await userEvent.click(saveButton(drawer));
    const pen = row(drawer, 'Bút bi xanh');
    expect(await within(pen).findByText('Không ít hơn số đã giao (3).')).toBeInTheDocument();
    expect(within(pen).getByRole('spinbutton')).toHaveAttribute('aria-invalid', 'true');
    expect(within(row(drawer, NOTE)).queryByText(/Không ít hơn/)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('QTY_INCREASE_FORBIDDEN {line_id} → "Không tăng được sau khóa sổ." ở dòng đó', async () => {
    stubAdjust({ put: () => jsonResponse(400, { code: 'QTY_INCREASE_FORBIDDEN', line_id: 'l-note' }) });
    const { drawer } = await renderDrawer();
    await reduceNote(drawer);
    await userEvent.click(saveButton(drawer));
    expect(await within(row(drawer, NOTE)).findByText('Không tăng được sau khóa sổ.')).toBeInTheDocument();
  });

  it('STALE_UPDATE → khối "Phiếu vừa được người khác sửa…" + "Tải bản mới nhất"; bấm → tải lại, bỏ số đã sửa, khối ẩn', async () => {
    const fresh = adminRequest({ updated_at: '2026-10-06T01:00:00.000Z' });
    fresh.lines[1] = { ...fresh.lines[1], qty: 4 };
    const f = stubAdjust({ views: [adminRequest(), fresh], put: () => jsonResponse(409, { code: 'STALE_UPDATE', line_id: 'l-note', qty: 4 }) });
    const { drawer } = await renderDrawer();
    await reduceNote(drawer);
    await userEvent.click(saveButton(drawer));
    expect(await within(drawer).findByRole('alert')).toHaveTextContent('Phiếu vừa được người khác sửa — tải lại.');
    expect(loadCalls(f)).toHaveLength(1);
    await userEvent.click(within(drawer).getByRole('button', { name: 'Tải bản mới nhất' }));
    await waitFor(() => expect(within(drawer).getByRole('spinbutton', { name: NOTE })).toHaveValue(4));
    expect(loadCalls(f)).toHaveLength(2);
    expect(within(drawer).queryByText(/^Phiếu vừa được người khác sửa/)).toBeNull();
    expect(within(drawer).queryByText(/^Trước khi sửa/)).toBeNull();
    expect(within(drawer).queryByRole('radiogroup')).toBeNull();
  });

  it.each([
    ['REQUEST_NOT_FOUND', 404, 'Phiếu không còn.'],
    ['PERIOD_NOT_LOCKED', 409, 'Kỳ chưa khóa sổ — chưa điều chỉnh được.'],
  ])('%s → khối đầu thân ngăn', async (code, status, text) => {
    stubAdjust({ put: () => jsonResponse(status, { code }) });
    const { drawer } = await renderDrawer();
    await reduceNote(drawer);
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
    await userEvent.click(less(drawer, NOTE));
    within(drawer).getByRole('button', { name: 'Hủy' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(await screen.findByText('Bỏ thay đổi chưa lưu?')).toBeInTheDocument();
    expect(onNext).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ thay đổi' }));
    expect(onNext).toHaveBeenCalledTimes(2);
  });
});
