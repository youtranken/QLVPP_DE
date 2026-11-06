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

describe('AdjustDrawer — món ngoài danh mục', () => {
  it('dòng pending: "2 cái · ngoài danh mục", ghi chú, 3 nút review và liên kết "Xem ở Món ngoài danh mục"', async () => {
    stubAdjust();
    const { drawer } = await renderDrawer();
    const tape = row(drawer, 'Băng keo 2 mặt');
    expect(within(tape).getByText('2 cái · ngoài danh mục')).toBeInTheDocument();
    expect(within(tape).getByText('“Loại 2 cm”')).toBeInTheDocument();
    expect(within(within(tape).getByRole('group', { name: 'Xử lý Băng keo 2 mặt' })).getAllByRole('button')).toHaveLength(3);
    expect(within(tape).getByRole('link', { name: 'Xem ở Món ngoài danh mục' })).toHaveAttribute('href', '/admin/review?status=pending&ym=2026-10');
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

  it('Chấp nhận áp dụng ngay; lần Lưu sau dùng request_updated_at của review', async () => {
    const f = stubAdjust();
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Mua lần này — Băng keo 2 mặt' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: /Mua “Băng keo 2 mặt” lần này/ })).getByRole('button', { name: 'Mua lần này' }));
    expect(await within(drawer).findByText('Đã chấp nhận')).toBeInTheDocument();
    expect(saveButton(drawer)).toBeDisabled();
    await userEvent.click(less(drawer, 'Giấy note vàng'));
    await userEvent.click(pick(drawer, 'Giấy note vàng', 'Vượt định mức'));
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(f.mock.calls.some((c) => c[0] === '/api/admin/requests/r-1/lines')).toBe(true));
    const call = f.mock.calls.find((c) => c[0] === '/api/admin/requests/r-1/lines') as unknown as [string, RequestInit];
    expect(JSON.parse(String(call[1].body)).expected_updated_at).toBe('2026-11-05T08:00:00.000Z');
  });

  it('Thêm vào danh mục (món có sẵn) → dòng bỏ nhãn "ngoài danh mục" ngay, không tải lại phiếu', async () => {
    const clip = facts('Kẹp giấy 33 mm', 'hop');
    const f = stubAdjust({ review: () => jsonResponse(200, reviewResult('converted', { id: 'l-tape', item_id: 'i-clip', item: clip })) });
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Mua và thêm vào danh mục — Băng keo 2 mặt' }));
    const dialog = screen.getByRole('dialog', { name: 'Mua “Băng keo 2 mặt” và thêm vào danh mục' });
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Món có sẵn' }));
    await userEvent.click(await within(dialog).findByRole('button', { name: /Kẹp giấy 33 mm/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mua và thêm vào danh mục' }));
    expect(await within(drawer).findByText('Đã thêm vào danh mục')).toBeInTheDocument();
    expect(within(drawer).queryByText(/ngoài danh mục$/)).toBeNull();
    expect(loadCalls(f)).toHaveLength(1);
  });

  it('review thua đua, dòng khác cũng đổi → đã tải bản mới, bỏ số đã sửa, báo không chặn; lý do đã chọn vẫn giữ', async () => {
    const fresh = adminRequest({ updated_at: '2026-10-06T01:00:00.000Z' });
    fresh.lines[1] = { ...fresh.lines[1], qty: 2 };
    fresh.lines[2] = { ...fresh.lines[2], review_status: 'accepted' };
    const f = stubAdjust({ views: [adminRequest(), fresh], review: () => jsonResponse(409, { code: 'LINE_ALREADY_REVIEWED' }) });
    const { drawer } = await renderDrawer();
    await userEvent.click(less(drawer, 'Bút bi xanh'));
    await userEvent.click(pick(drawer, 'Bút bi xanh', 'Trùng với phiếu khác'));
    await userEvent.click(within(drawer).getByRole('button', { name: 'Mua lần này — Băng keo 2 mặt' }));
    const confirm = screen.getByRole('dialog', { name: /Mua “Băng keo 2 mặt” lần này/ });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Mua lần này' }));
    await userEvent.click(await within(confirm).findByRole('button', { name: 'Quay lại' }));
    expect(await within(drawer).findByText('Phiếu vừa được người khác sửa — đã tải bản mới nhất, sửa lại rồi lưu.')).toBeInTheDocument();
    await waitFor(() => expect(within(drawer).getByRole('spinbutton', { name: 'Giấy note vàng' })).toHaveValue(2));
    expect(within(drawer).getByRole('spinbutton', { name: 'Bút bi xanh' })).toHaveValue(10);
    expect(within(drawer).queryByRole('button', { name: 'Tải bản mới nhất' })).toBeNull();
    await userEvent.click(less(drawer, 'Bút bi xanh'));
    expect(pick(drawer, 'Bút bi xanh', 'Trùng với phiếu khác')).toBeChecked();
    expect(saveButton(drawer)).toBeEnabled();
    expect(loadCalls(f)).toHaveLength(2);
  });

  it('review thua đua nhưng chỉ dòng đó đổi → giữ nháp, không khối STALE', async () => {
    const fresh = adminRequest({ updated_at: '2026-10-06T01:00:00.000Z' });
    fresh.lines[2] = { ...fresh.lines[2], review_status: 'accepted' };
    const f = stubAdjust({ views: [adminRequest(), fresh], review: () => jsonResponse(409, { code: 'LINE_ALREADY_REVIEWED' }) });
    const { drawer } = await renderDrawer();
    await userEvent.click(less(drawer, 'Bút bi xanh'));
    await userEvent.click(within(drawer).getByRole('button', { name: 'Mua lần này — Băng keo 2 mặt' }));
    const confirm = screen.getByRole('dialog', { name: /Mua “Băng keo 2 mặt” lần này/ });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Mua lần này' }));
    await userEvent.click(await within(confirm).findByRole('button', { name: 'Quay lại' }));
    await waitFor(() => expect(loadCalls(f)).toHaveLength(2));
    await waitFor(() => expect(within(drawer).getByText('Đã chấp nhận')).toBeInTheDocument());
    expect(within(drawer).getByRole('spinbutton', { name: 'Bút bi xanh' })).toHaveValue(9);
    expect(within(drawer).queryByText(/^Phiếu vừa được người khác sửa/)).toBeNull();
  });
});
