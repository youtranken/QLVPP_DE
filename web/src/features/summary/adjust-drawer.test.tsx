import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { lineView } from '@/test/fixtures-request';
import { reviewResult } from '@/features/review/review-fixtures';
import { ADMIN_ITEMS, adminItem, adminRequest } from './adjust-fixtures';
import { loadCalls, reasonBox, renderDrawer, row, saveButton, stubAdjust } from './adjust-render-fixtures';

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

describe('AdjustDrawer — đầu ngăn và kỳ', () => {
  it('kỳ khóa: eyebrow tháng · phòng ban, badge "Đã khóa", cảnh báo warn, ô lý do có "*", "Món trong phiếu · 3 dòng" + "15 đơn vị"', async () => {
    stubAdjust();
    const { drawer } = await renderDrawer();
    expect(within(drawer).getByText('Tháng 10/2026 · Tổ Giám sát')).toBeInTheDocument();
    expect(within(drawer).getByText('Đã khóa')).toBeInTheDocument();
    expect(within(drawer).getByText('Kỳ đã khóa. Chỉ Hành chính sửa được, phải ghi lý do; không giảm dưới số đã giao.')).toBeInTheDocument();
    expect(reasonBox(drawer)).toHaveAttribute('aria-required', 'true');
    expect(within(drawer).getByText('*')).toBeInTheDocument();
    expect(within(drawer).getByText('Món trong phiếu · 3 dòng')).toBeInTheDocument();
    expect(within(drawer).getByText('15 đơn vị')).toBeInTheDocument();
    expect(within(drawer).getByText(/^Lưu lần cuối /)).toBeInTheDocument();
  });

  it('kỳ mở: không cảnh báo, lý do không "*", gợi ý "Không bắt buộc…"; maxLength 500 và đếm ký tự', async () => {
    stubAdjust({ views: [adminRequest({ is_open: true, period_ym: '2026-11' })] });
    const { drawer } = await renderDrawer();
    expect(within(drawer).getByText('Đang mở')).toBeInTheDocument();
    expect(within(drawer).queryByText(/^Kỳ đã khóa\./)).toBeNull();
    expect(reasonBox(drawer)).not.toHaveAttribute('aria-required');
    expect(reasonBox(drawer)).toHaveAccessibleDescription('Không bắt buộc khi kỳ đang mở — nhân viên thấy lý do trong Lịch sử.');
    expect(reasonBox(drawer)).toHaveAttribute('maxLength', '500');
    expect(within(drawer).getByText('0/500')).toBeInTheDocument();
    await userEvent.type(reasonBox(drawer), 'abc');
    expect(within(drawer).getByText('3/500')).toBeInTheDocument();
  });
});

describe('AdjustDrawer — biên lý do 500/501', () => {
  it('dán 499 ký tự rồi gõ thêm 2 → ô giữ 500 ký tự (ký tự 501 không vào), đếm "500/500"', async () => {
    stubAdjust();
    const { drawer } = await renderDrawer();
    await userEvent.click(reasonBox(drawer));
    await userEvent.paste('a'.repeat(499));
    expect(within(drawer).getByText('499/500')).toBeInTheDocument();
    await userEvent.type(reasonBox(drawer), 'bc');
    expect((reasonBox(drawer) as HTMLTextAreaElement).value).toHaveLength(500);
    expect(within(drawer).getByText('500/500')).toBeInTheDocument();
  });
});

describe('AdjustDrawer — dòng và stepper', () => {
  it('dòng max_qty=5: ở 4 nút Thêm bấm được, lên 5 thì vô hiệu', async () => {
    const items = [...ADMIN_ITEMS.filter((i) => i.id !== 'i-note'), adminItem({ id: 'i-note', name: 'Giấy note vàng', unit: 'bich', max_qty: 5 })];
    const view = adminRequest();
    view.lines[1] = { ...view.lines[1], qty: 4 };
    stubAdjust({ views: [view], items });
    const { drawer } = await renderDrawer();
    const more = within(drawer).getByRole('button', { name: 'Thêm Giấy note vàng' });
    expect(more).toBeEnabled();
    await userEvent.click(more);
    expect(within(drawer).getByRole('spinbutton', { name: 'Giấy note vàng' })).toHaveValue(5);
    expect(more).toBeDisabled();
    expect(within(row(drawer, 'Giấy note vàng')).getByText('bịch · tối đa 5/tháng')).toBeInTheDocument();
  });

  it('dòng đã giao 3: ở 4 nút Bớt bấm được, xuống 3 thì vô hiệu; badge "đã giao 3", không có nút bỏ', async () => {
    const view = adminRequest();
    view.lines[0] = { ...view.lines[0], qty: 4 };
    stubAdjust({ views: [view] });
    const { drawer } = await renderDrawer();
    const pen = row(drawer, 'Bút bi xanh');
    const less = within(pen).getByRole('button', { name: 'Bớt Bút bi xanh' });
    expect(less).toBeEnabled();
    await userEvent.click(less);
    expect(within(pen).getByRole('spinbutton')).toHaveValue(3);
    expect(less).toBeDisabled();
    expect(within(pen).getByText('đã giao 3')).toBeInTheDocument();
    expect(within(pen).getByText('Trước khi sửa: 4')).toBeInTheDocument();
    expect(within(pen).queryByRole('button', { name: /^Bỏ / })).toBeNull();
  });

  it('bỏ dòng → "Sẽ bỏ khỏi phiếu" + "Giữ lại" (bấm thì trở lại); dòng đã hủy nợ có badge "đã hủy nợ 2"', async () => {
    const view = adminRequest();
    view.lines[0] = { ...view.lines[0], qty: 5, delivered_qty: 3, cancelled_qty: 2 };
    stubAdjust({ views: [view] });
    const { drawer } = await renderDrawer();
    expect(within(row(drawer, 'Bút bi xanh')).getByText('đã hủy nợ 2')).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Bỏ Giấy note vàng khỏi phiếu' }));
    const note = row(drawer, 'Giấy note vàng');
    expect(within(note).getByText('Sẽ bỏ khỏi phiếu')).toBeInTheDocument();
    await userEvent.click(within(note).getByRole('button', { name: 'Giữ lại Giấy note vàng' }));
    expect(within(row(drawer, 'Giấy note vàng')).queryByText('Sẽ bỏ khỏi phiếu')).toBeNull();
  });

  it('món đã ngừng hoặc SL vượt max_qty: chỉ giảm; món chỉ Hành chính: "Chỉ Hành chính", "ram · Hành chính đặt", không trần UI', async () => {
    stubAdjust({
      views: [
        adminRequest({
          lines: [
            ...adminRequest().lines,
            lineView({ id: 'l-old', item_id: 'i-old', item: facts('Giấy cũ', 'cai', { active: false }), qty: 5 }),
            lineView({ id: 'l-clip', item_id: 'i-clip', item: facts('Kẹp giấy 33 mm', 'hop'), qty: 12 }),
            lineView({ id: 'l-a4', item_id: 'i-a4', item: facts('Giấy A4 Double A', 'ram', { admin_only: true }), qty: 40 }),
          ],
        }),
      ],
    });
    const { drawer } = await renderDrawer();
    for (const name of ['Giấy cũ', 'Kẹp giấy 33 mm']) {
      expect(within(drawer).getByRole('button', { name: `Thêm ${name}` })).toBeDisabled();
      expect(within(drawer).getByRole('button', { name: `Bớt ${name}` })).toBeEnabled();
    }
    const a4 = row(drawer, 'Giấy A4 Double A');
    expect(within(a4).getByText('Chỉ Hành chính')).toBeInTheDocument();
    expect(within(a4).getByText('ram · Hành chính đặt')).toBeInTheDocument();
    expect(within(a4).getByRole('button', { name: 'Thêm Giấy A4 Double A' })).toBeEnabled();
  });

  it('Hủy sau khi sửa → hỏi "Bỏ thay đổi chưa lưu?"; Tiếp tục sửa giữ ngăn, Bỏ thay đổi đóng; chân ngăn đếm thay đổi', async () => {
    stubAdjust();
    const { drawer, onClose } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Bỏ Giấy note vàng khỏi phiếu' }));
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    expect(within(drawer).getByText('2 thay đổi chưa lưu')).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Hủy' }));
    expect(await screen.findByText('Bỏ thay đổi chưa lưu?')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Tiếp tục sửa'));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Hủy' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('AdjustDrawer — thêm món', () => {
  const many = [
    ...ADMIN_ITEMS,
    ...['Giấy than', 'Giấy bìa', 'Giấy dán', 'Giấy kraft', 'Giấy decal'].map((name, k) => adminItem({ id: `i-g${k}`, name })),
  ];

  it('tìm "giấy" → tối đa 6 kết quả, gồm món chỉ Hành chính, không món đã có/ngừng; chọn → "Mới thêm"', async () => {
    stubAdjust({ items: many });
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: '+ Thêm món vào phiếu' }));
    await userEvent.type(within(drawer).getByRole('searchbox', { name: 'Tìm món trong danh mục' }), 'giấy');
    const results = within(drawer).getByRole('list', { name: 'Món tìm thấy' });
    expect(within(results).getAllByRole('button')).toHaveLength(6);
    const a4 = within(results).getByRole('button', { name: /Giấy A4 Double A/ });
    expect(a4).toHaveTextContent('Chỉ Hành chính');
    expect(within(results).queryByRole('button', { name: /Giấy note vàng/ })).toBeNull();
    expect(within(results).queryByRole('button', { name: /Giấy cũ/ })).toBeNull();
    await userEvent.click(a4);
    expect(within(row(drawer, 'Giấy A4 Double A')).getByText('Mới thêm')).toBeInTheDocument();
  });

  it('Enter trong ô tìm món không lưu ngăn: khớp món → thêm món đầu, không khớp → không làm gì', async () => {
    const f = stubAdjust({ views: [adminRequest({ is_open: true })] });
    const { drawer, onClose } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Giấy note vàng' }));
    await userEvent.click(within(drawer).getByRole('button', { name: '+ Thêm món vào phiếu' }));
    const search = within(drawer).getByRole('searchbox', { name: 'Tìm món trong danh mục' });
    await userEvent.type(search, 'zzz{Enter}');
    await userEvent.clear(search);
    await userEvent.type(search, 'a4{Enter}');
    expect(within(row(drawer, 'Giấy A4 Double A')).getByText('Mới thêm')).toBeInTheDocument();
    expect(f.mock.calls.some((c) => c[0] === '/api/admin/requests/r-1/lines')).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('món đã có trên dòng converted không được gợi ý lại (tránh DUPLICATE_ITEM)', async () => {
    const view = adminRequest();
    view.lines[2] = { ...view.lines[2], item_id: 'i-clip', review_status: 'converted', custom_name: null, custom_unit: null, item: facts('Kẹp giấy 33 mm', 'hop') };
    stubAdjust({ views: [view] });
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: '+ Thêm món vào phiếu' }));
    await userEvent.type(within(drawer).getByRole('searchbox', { name: 'Tìm món trong danh mục' }), 'giấy');
    const results = within(drawer).getByRole('list', { name: 'Món tìm thấy' });
    expect(within(results).getByRole('button', { name: /Giấy A4 Double A/ })).toBeInTheDocument();
    expect(within(results).queryByRole('button', { name: /Kẹp giấy 33 mm/ })).toBeNull();
  });
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
    await userEvent.click(within(drawer).getByRole('button', { name: 'Chấp nhận — Băng keo 2 mặt' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: /Chấp nhận “Băng keo 2 mặt”/ })).getByRole('button', { name: 'Chấp nhận' }));
    expect(await within(drawer).findByText('Đã chấp nhận')).toBeInTheDocument();
    expect(saveButton(drawer)).toBeDisabled();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Giấy note vàng' }));
    await userEvent.type(reasonBox(drawer), 'Sửa số');
    await userEvent.click(saveButton(drawer));
    await waitFor(() => expect(f.mock.calls.some((c) => c[0] === '/api/admin/requests/r-1/lines')).toBe(true));
    const call = f.mock.calls.find((c) => c[0] === '/api/admin/requests/r-1/lines') as unknown as [string, RequestInit];
    expect(JSON.parse(String(call[1].body)).expected_updated_at).toBe('2026-11-05T08:00:00.000Z');
  });

  it('Thêm vào danh mục (món có sẵn) → dòng bỏ nhãn "ngoài danh mục" ngay, không tải lại phiếu', async () => {
    const clip = facts('Kẹp giấy 33 mm', 'hop');
    const f = stubAdjust({ review: () => jsonResponse(200, reviewResult('converted', { id: 'l-tape', item_id: 'i-clip', item: clip })) });
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm vào danh mục — Băng keo 2 mặt' }));
    const dialog = screen.getByRole('dialog', { name: 'Thêm “Băng keo 2 mặt” vào danh mục' });
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Món có sẵn' }));
    await userEvent.click(await within(dialog).findByRole('button', { name: /Kẹp giấy 33 mm/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm vào danh mục' }));
    expect(await within(drawer).findByText('Đã thêm vào danh mục')).toBeInTheDocument();
    expect(within(drawer).queryByText(/ngoài danh mục$/)).toBeNull();
    expect(loadCalls(f)).toHaveLength(1);
  });

  it('review thua đua, dòng khác cũng đổi → đã tải bản mới, bỏ nháp, báo không chặn (không cần bấm tải lại), giữ lý do, Lưu được sau khi sửa', async () => {
    const fresh = adminRequest({ updated_at: '2026-10-06T01:00:00.000Z' });
    fresh.lines[1] = { ...fresh.lines[1], qty: 4 };
    fresh.lines[2] = { ...fresh.lines[2], review_status: 'accepted' };
    const f = stubAdjust({ views: [adminRequest(), fresh], review: () => jsonResponse(409, { code: 'LINE_ALREADY_REVIEWED' }) });
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await userEvent.type(reasonBox(drawer), 'An báo nhầm');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Chấp nhận — Băng keo 2 mặt' }));
    const confirm = screen.getByRole('dialog', { name: /Chấp nhận “Băng keo 2 mặt”/ });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Chấp nhận' }));
    await userEvent.click(await within(confirm).findByRole('button', { name: 'Quay lại' }));
    expect(await within(drawer).findByText('Nhân viên vừa sửa phiếu này — đã tải bản mới nhất, sửa lại rồi lưu.')).toBeInTheDocument();
    await waitFor(() => expect(within(drawer).getByRole('spinbutton', { name: 'Giấy note vàng' })).toHaveValue(4));
    expect(within(drawer).getByRole('spinbutton', { name: 'Bút bi xanh' })).toHaveValue(10);
    expect(within(drawer).queryByRole('button', { name: 'Tải bản mới nhất' })).toBeNull();
    expect(reasonBox(drawer)).toHaveValue('An báo nhầm');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    expect(saveButton(drawer)).toBeEnabled();
    expect(loadCalls(f)).toHaveLength(2);
  });

  it('review thua đua nhưng chỉ dòng đó đổi → giữ nháp, không khối STALE', async () => {
    const fresh = adminRequest({ updated_at: '2026-10-06T01:00:00.000Z' });
    fresh.lines[2] = { ...fresh.lines[2], review_status: 'accepted' };
    const f = stubAdjust({ views: [adminRequest(), fresh], review: () => jsonResponse(409, { code: 'LINE_ALREADY_REVIEWED' }) });
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await userEvent.click(within(drawer).getByRole('button', { name: 'Chấp nhận — Băng keo 2 mặt' }));
    const confirm = screen.getByRole('dialog', { name: /Chấp nhận “Băng keo 2 mặt”/ });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Chấp nhận' }));
    await userEvent.click(await within(confirm).findByRole('button', { name: 'Quay lại' }));
    await waitFor(() => expect(loadCalls(f)).toHaveLength(2));
    await waitFor(() => expect(within(drawer).getByText('Đã chấp nhận')).toBeInTheDocument());
    expect(within(drawer).getByRole('spinbutton', { name: 'Bút bi xanh' })).toHaveValue(11);
    expect(within(drawer).queryByText(/^Nhân viên vừa sửa phiếu này/)).toBeNull();
  });
});

describe('AdjustDrawer — món thuộc nhóm đang ngừng (active, usable=false)', () => {
  const paused = adminItem({ id: 'i-paused', name: 'Giấy nhóm ngừng', usable: false });

  it('không được gợi ý khi thêm món', async () => {
    stubAdjust({ items: [...ADMIN_ITEMS, paused] });
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: '+ Thêm món vào phiếu' }));
    await userEvent.type(within(drawer).getByRole('searchbox', { name: 'Tìm món trong danh mục' }), 'nhóm ngừng');
    expect(within(drawer).queryByRole('button', { name: /Giấy nhóm ngừng/ })).toBeNull();
  });

  it('dòng đã có của món đó: như món đã ngừng — chỉ giảm/bỏ, không tăng', async () => {
    stubAdjust({
      items: [...ADMIN_ITEMS, paused],
      views: [adminRequest({ lines: [...adminRequest().lines, lineView({ id: 'l-paused', item_id: 'i-paused', item: facts('Giấy nhóm ngừng', 'cai'), qty: 4 })] })],
    });
    const { drawer } = await renderDrawer();
    expect(within(drawer).getByRole('button', { name: 'Thêm Giấy nhóm ngừng' })).toBeDisabled();
    expect(within(drawer).getByRole('button', { name: 'Bớt Giấy nhóm ngừng' })).toBeEnabled();
  });
});
