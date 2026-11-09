import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { reviewResult } from '@/features/review/review-fixtures';
import { adminRequest } from './adjust-fixtures';
import { less, loadCalls, pick, renderDrawer, row, saveButton, stubAdjust } from './adjust-render-fixtures';

afterEach(() => vi.unstubAllGlobals());

const facts = (name: string, unit: string, over: { active?: boolean; admin_only?: boolean } = {}) => ({
  name,
  name_en: null,
  unit,
  pack_note: null,
  image_file_id: null,
  active: over.active ?? true,
  admin_only: over.admin_only ?? false,
});

const REVIEW = '/api/admin/lines/l-tape/review';
const PUT = '/api/admin/requests/r-1/lines';
// Thứ tự gọi review/PUT trong stub
const order = (f: ReturnType<typeof stubAdjust>) => f.mock.calls.map((c) => c[0]).filter((u) => u === REVIEW || u === PUT);
const reviewBodies = (f: ReturnType<typeof stubAdjust>) =>
  (f.mock.calls as unknown as [string, RequestInit][]).filter((c) => c[0] === REVIEW).map((c) => JSON.parse(String(c[1].body)));

describe('AdjustDrawer — món ngoài danh mục', () => {
  it('dòng pending: "2 cái · ngoài danh mục", ghi chú, câu mặc định mua, đúng 2 nút "Thêm vào danh mục" / "Không mua" trong 1 group; không "Mua lần này", không liên kết', async () => {
    stubAdjust();
    const { drawer } = await renderDrawer();
    const tape = row(drawer, 'Băng keo 2 mặt');
    expect(within(tape).getByText('2 cái · ngoài danh mục')).toBeInTheDocument();
    expect(within(tape).getByText('“Loại 2 cm”')).toBeInTheDocument();
    expect(within(tape).getByText('Mặc định: mua lần này. Chỉ bấm khi muốn khác:')).toBeInTheDocument();
    const buttons = within(within(tape).getByRole('group', { name: 'Xử lý Băng keo 2 mặt' })).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Thêm vào danh mục', 'Không mua']);
    expect(buttons[0]!.parentElement).toBe(buttons[1]!.parentElement);
    expect(within(tape).queryByRole('button', { name: /Mua lần này/ })).toBeNull();
    expect(within(tape).queryByRole('link')).toBeNull();
  });

  it('dòng đã bị từ chối → số lượng chỉ đọc, không stepper, không liên kết review', async () => {
    const view = adminRequest();
    view.lines[2] = { ...view.lines[2], review_status: 'rejected', review_note: 'Kho còn' };
    stubAdjust({ views: [view] });
    const { drawer } = await renderDrawer();
    const tape = row(drawer, 'Băng keo 2 mặt');
    expect(within(tape).getByText('Từ chối: Kho còn')).toBeInTheDocument();
    expect(within(tape).queryByRole('spinbutton')).toBeNull();
    expect(within(tape).queryByRole('link')).toBeNull();
  });

  it('Lưu khi chỉ có dòng pending (chưa đổi số) → POST review accept rồi PUT theo request_updated_at của review', async () => {
    const f = stubAdjust();
    const { drawer, onClose } = await renderDrawer();
    expect(saveButton(drawer)).toBeEnabled();
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(order(f)).toEqual([REVIEW, PUT]);
    expect(reviewBodies(f)).toEqual([{ action: 'accept' }]);
    const call = f.mock.calls.find((c) => c[0] === PUT) as unknown as [string, RequestInit];
    expect(JSON.parse(String(call[1].body)).expected_updated_at).toBe('2026-11-05T08:00:00.000Z');
  });

  it('bấm X ở dòng pending → chỉ "Sẽ bỏ khỏi phiếu" + "Giữ lại"; Lưu gửi review reject (ghi chú cố định) rồi PUT, dòng đó không đổi số', async () => {
    const f = stubAdjust({ review: () => jsonResponse(200, reviewResult('rejected', { id: 'l-tape', review_note: 'Hành chính bỏ khỏi phiếu' })) });
    const { drawer, onClose } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Bỏ Băng keo 2 mặt khỏi phiếu' }));
    const tape = row(drawer, 'Băng keo 2 mặt');
    expect(within(tape).getByText('Sẽ bỏ khỏi phiếu')).toBeInTheDocument();
    expect(within(tape).getByRole('button', { name: 'Giữ lại Băng keo 2 mặt' })).toBeInTheDocument();
    expect(within(tape).queryByRole('group', { name: 'Xử lý Băng keo 2 mặt' })).toBeNull();
    expect(within(tape).queryByRole('radiogroup')).toBeNull();
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(order(f)).toEqual([REVIEW, PUT]);
    expect(reviewBodies(f)).toEqual([{ action: 'reject', note: 'Hành chính bỏ khỏi phiếu' }]);
    const call = f.mock.calls.find((c) => c[0] === PUT) as unknown as [string, RequestInit];
    expect(JSON.parse(String(call[1].body)).lines[2]).toEqual({ id: 'l-tape', qty: 2, expected_qty: 2 });
  });

  it('Thêm vào danh mục (món có sẵn) → dòng bỏ nhãn "ngoài danh mục" ngay, không tải lại phiếu', async () => {
    const clip = facts('Kẹp giấy 33 mm', 'hop');
    const f = stubAdjust({ review: () => jsonResponse(200, reviewResult('converted', { id: 'l-tape', item_id: 'i-clip', item: clip })) });
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm vào danh mục — Băng keo 2 mặt' }));
    const dialog = screen.getByRole('dialog', { name: 'Mua “Băng keo 2 mặt” và thêm vào danh mục' });
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Món có sẵn' }));
    await userEvent.click(await within(dialog).findByRole('button', { name: /Kẹp giấy 33 mm/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mua và thêm vào danh mục' }));
    expect(await within(drawer).findByText('Đã thêm vào danh mục')).toBeInTheDocument();
    expect(within(drawer).queryByText(/ngoài danh mục$/)).toBeNull();
    expect(loadCalls(f)).toHaveLength(1);
    // Không còn dòng chờ duyệt, chưa đổi số → Lưu vô hiệu
    expect(saveButton(drawer)).toBeDisabled();
  });

  it('Lưu: duyệt mua thua đua, dòng khác cũng đổi → không PUT, đã tải bản mới, bỏ số đã sửa, báo không chặn; lý do đã chọn vẫn giữ', async () => {
    const fresh = adminRequest({ updated_at: '2026-10-06T01:00:00.000Z' });
    fresh.lines[1] = { ...fresh.lines[1], qty: 2 };
    fresh.lines[2] = { ...fresh.lines[2], review_status: 'accepted' };
    const f = stubAdjust({ views: [adminRequest(), fresh], review: () => jsonResponse(409, { code: 'LINE_ALREADY_REVIEWED' }) });
    const { drawer } = await renderDrawer();
    await userEvent.click(less(drawer, 'Bút bi xanh'));
    await userEvent.click(pick(drawer, 'Bút bi xanh', 'Không có hàng'));
    await userEvent.click(saveButton(drawer));
    expect(await within(drawer).findByText('Phiếu vừa được người khác sửa — đã tải bản mới nhất, sửa lại rồi lưu.')).toBeInTheDocument();
    expect(order(f)).toEqual([REVIEW]);
    await waitFor(() => expect(within(drawer).getByRole('spinbutton', { name: 'Giấy note vàng' })).toHaveValue(2));
    expect(within(drawer).getByRole('spinbutton', { name: 'Bút bi xanh' })).toHaveValue(10);
    await userEvent.click(less(drawer, 'Bút bi xanh'));
    expect(pick(drawer, 'Bút bi xanh', 'Không có hàng')).toBeChecked();
    expect(saveButton(drawer)).toBeEnabled();
    expect(loadCalls(f)).toHaveLength(2);
  });

  it('Lưu: duyệt mua thua đua nhưng chỉ dòng đó đổi → báo lỗi ở dòng, giữ nháp; Lưu lại thì PUT', async () => {
    const fresh = adminRequest({ updated_at: '2026-10-06T01:00:00.000Z' });
    fresh.lines[2] = { ...fresh.lines[2], review_status: 'accepted' };
    const f = stubAdjust({ views: [adminRequest(), fresh], review: () => jsonResponse(409, { code: 'LINE_ALREADY_REVIEWED' }) });
    const { drawer, onClose } = await renderDrawer();
    await userEvent.click(less(drawer, 'Bút bi xanh'));
    await userEvent.click(pick(drawer, 'Bút bi xanh', 'Không có hàng'));
    await userEvent.click(saveButton(drawer));
    expect(await within(row(drawer, 'Băng keo 2 mặt')).findByText('Dòng này vừa được xử lý ở nơi khác.')).toBeInTheDocument();
    await waitFor(() => expect(loadCalls(f)).toHaveLength(2));
    await waitFor(() => expect(within(drawer).getByText('Đã chấp nhận')).toBeInTheDocument());
    expect(within(drawer).getByRole('spinbutton', { name: 'Bút bi xanh' })).toHaveValue(9);
    expect(within(drawer).queryByText(/^Phiếu vừa được người khác sửa/)).toBeNull();
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(order(f)).toEqual([REVIEW, PUT]);
    const call = f.mock.calls.find((c) => c[0] === PUT) as unknown as [string, RequestInit];
    expect(JSON.parse(String(call[1].body)).expected_updated_at).toBe('2026-10-06T01:00:00.000Z');
  });
});
