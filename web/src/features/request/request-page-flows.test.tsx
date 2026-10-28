import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { NOTE, PEN, PERIOD, facts, stubRequestApi, view } from '@/test/request-api-stub';
import { mockViewport } from '@/test/viewport';

vi.mock('@/lib/image-compress', () => ({
  compressImage: vi.fn(async (file: File) => ({ blob: file, mime: 'image/png', width: 10, height: 10 })),
}));

const grid = () => screen.getByRole('region', { name: 'Danh mục món' });
const cart = () => screen.getByRole('complementary', { name: 'Phiếu của tôi' });
const location = () => screen.getByTestId('location').textContent;

const COPY = {
  from_ym: '2026-10',
  lines: [
    { item_id: PEN.id, qty: 20 },
    { custom_name: 'Bìa còng 7cm', custom_unit: 'cai', custom_note: null, image_file_id: 'f-old', qty: 2 },
  ],
  skipped: [{ name: 'Giấy A4', reason: 'ADMIN_ONLY' }],
  capped: [{ name: 'Bút bi xanh', from: 30, to: 20 }],
  previously_accepted: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RequestPage — món ngoài danh mục', () => {
  it('390 px: "Thêm món khác" → hộp → dòng vào giỏ nhãn info "Ngoài danh mục" → lưu gửi đủ trường; bấm tên để sửa', async () => {
    mockViewport(390);
    const api = stubRequestApi({
      upload: () => jsonResponse(201, { id: 'f-1' }),
      put: () => jsonResponse(500, {}),
    });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: '+ Thêm món khác' }));
    const dialog = await screen.findByRole('dialog', { name: 'Thêm món khác' });
    await userEvent.type(within(dialog).getByLabelText('Tên món'), 'Bìa còng 7cm');
    await userEvent.selectOptions(within(dialog).getByLabelText('Đơn vị tính'), 'cai');
    await userEvent.upload(within(dialog).getByLabelText('Chụp hoặc chọn ảnh'), new File(['x'], 'a.png', { type: 'image/png' }));
    await within(dialog).findByRole('img', { name: 'Ảnh món' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm vào phiếu' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const line = within(cart()).getByRole('button', { name: 'Sửa Bìa còng 7cm' }).closest('li')!;
    expect(within(line).getByText('Ngoài danh mục')).toHaveClass('tag--info');
    expect(within(line).getByRole('spinbutton', { name: 'Bìa còng 7cm' })).toHaveValue(1);

    await userEvent.click(within(line).getByRole('button', { name: 'Sửa Bìa còng 7cm' }));
    const edit = await screen.findByRole('dialog', { name: 'Sửa món khác' });
    await userEvent.clear(within(edit).getByLabelText('Tên món'));
    await userEvent.type(within(edit).getByLabelText('Tên món'), 'Bìa còng 5cm');
    await userEvent.click(within(edit).getByRole('button', { name: 'Lưu thay đổi' }));
    await userEvent.click(within(cart()).getByRole('button', { name: 'Thêm Bìa còng 5cm' }));

    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));
    await screen.findByRole('alert');
    expect(api.putBody()).toEqual({
      ym: '2026-11',
      lines: [{ custom_name: 'Bìa còng 5cm', custom_unit: 'cai', custom_note: null, image_file_id: 'f-1', qty: 2 }],
    });
  });

  it('dòng ngoài DM đã lưu, chờ xem → nhãn "Chờ Hành chính xem"; sửa tên gửi id kèm trường riêng', async () => {
    mockViewport(1280);
    const custom = lineView({ id: 'l-c', custom_name: 'Bìa còng', custom_unit: 'cai', image_file_id: 'f-1', qty: 2, review_status: 'pending' });
    const api = stubRequestApi({ request: view({ lines: [custom] }), put: () => jsonResponse(500, {}) });
    renderApp(makeMe('member'), '/');
    const name = await within(await screen.findByRole('complementary', { name: 'Phiếu của tôi' })).findByRole('button', { name: 'Sửa Bìa còng' });
    expect(within(name.closest('li')!).getByText('Chờ Hành chính xem')).toBeInTheDocument();
    await userEvent.click(name);
    const edit = await screen.findByRole('dialog', { name: 'Sửa món khác' });
    await userEvent.type(within(edit).getByLabelText('Ghi chú (tùy chọn)'), 'loại dày');
    await userEvent.click(within(edit).getByRole('button', { name: 'Lưu thay đổi' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));
    await screen.findByRole('alert');
    expect(api.putBody().lines).toEqual([
      { id: 'l-c', custom_name: 'Bìa còng', custom_unit: 'cai', custom_note: 'loại dày', image_file_id: 'f-1', qty: 2 },
    ]);
  });
});

describe('RequestPage — chép lại tháng trước', () => {
  it('không có phiếu kỳ trước (404) → không có nút chép', async () => {
    mockViewport(1280);
    stubRequestApi();
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    expect(screen.queryByRole('button', { name: /Chép lại danh sách/ })).toBeNull();
  });

  it('giỏ rỗng → điền thẳng (chưa lưu) + hộp tóm tắt "Đã bỏ: Giấy A4 — chỉ Hành chính đặt"; lưu gửi dòng ngoài DM kèm ảnh cũ', async () => {
    mockViewport(1280);
    const api = stubRequestApi({ copy: () => jsonResponse(200, COPY), put: () => jsonResponse(500, {}) });
    renderApp(makeMe('member'), '/');
    await userEvent.click(await screen.findByRole('button', { name: 'Chép lại danh sách tháng 10' }));
    const summary = await screen.findByRole('dialog', { name: 'Đã chép danh sách tháng 10' });
    expect(within(summary).getByText('Đã bỏ: Giấy A4 — chỉ Hành chính đặt')).toBeInTheDocument();
    await userEvent.click(within(summary).getByRole('button', { name: 'Đã hiểu' }));
    expect(within(cart()).getByRole('spinbutton', { name: 'Bút bi xanh' })).toHaveValue(20);
    expect(within(cart()).getByRole('button', { name: 'Sửa Bìa còng 7cm' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '2 thay đổi chưa lưu · Lưu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));
    await screen.findByRole('alert');
    expect(api.putBody()).toEqual({
      ym: '2026-11',
      lines: [
        { item_id: PEN.id, qty: 20 },
        { custom_name: 'Bìa còng 7cm', custom_unit: 'cai', custom_note: null, image_file_id: 'f-old', qty: 2 },
      ],
    });
  });

  it('giỏ có dòng Hành chính thêm cùng món → chép bỏ món đó (không trùng id), tóm tắt "Hành chính đã thêm món này"', async () => {
    mockViewport(1280);
    const admin = lineView({ id: 'l-a', item_id: PEN.id, item: facts(PEN), qty: 1, added_by_admin: true, readonly_for_member: true });
    const api = stubRequestApi({
      request: view({ lines: [admin] }),
      copy: () => jsonResponse(200, { ...COPY, skipped: [], capped: [] }),
      put: () => jsonResponse(500, {}),
    });
    renderApp(makeMe('member'), '/');
    await userEvent.click(await screen.findByRole('button', { name: 'Chép lại danh sách tháng 10' }));
    const summary = await screen.findByRole('dialog', { name: 'Đã chép danh sách tháng 10' });
    expect(within(summary).getByText('Đã bỏ: Bút bi xanh — Hành chính đã thêm món này')).toBeInTheDocument();
    await userEvent.click(within(summary).getByRole('button', { name: 'Đã hiểu' }));
    expect(within(cart()).getAllByText('Bút bi xanh')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));
    await screen.findByRole('alert');
    expect(api.putBody().lines).toEqual([
      { id: 'l-a', qty: 1 },
      { custom_name: 'Bìa còng 7cm', custom_unit: 'cai', custom_note: null, image_file_id: 'f-old', qty: 2 },
    ]);
  });

  it('giỏ đang có dòng → hỏi "Thay giỏ hiện tại?"; Giữ giỏ thì không đổi, Thay giỏ thì thay', async () => {
    mockViewport(1280);
    stubRequestApi({ copy: () => jsonResponse(200, { ...COPY, skipped: [], capped: [] }) });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Giấy note vàng');
    await userEvent.click(within(grid()).getByRole('button', { name: `Thêm ${NOTE.name}` }));
    const copy = await screen.findByRole('button', { name: 'Chép lại danh sách tháng 10' });

    await userEvent.click(copy);
    let ask = await screen.findByRole('dialog', { name: 'Thay giỏ hiện tại?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Giữ giỏ' }));
    expect(within(cart()).getByRole('spinbutton', { name: NOTE.name })).toBeInTheDocument();
    expect(within(cart()).queryByRole('spinbutton', { name: PEN.name })).toBeNull();

    await userEvent.click(copy);
    ask = await screen.findByRole('dialog', { name: 'Thay giỏ hiện tại?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Thay giỏ' }));
    await waitFor(() => expect(within(cart()).getByRole('spinbutton', { name: PEN.name })).toHaveValue(20));
    expect(within(cart()).queryByRole('spinbutton', { name: NOTE.name })).toBeNull();
    expect(screen.getByText('Đã chép danh sách tháng 10 — kiểm tra rồi bấm Lưu phiếu')).toBeInTheDocument();
  });
});

describe('RequestPage — kỳ trước đang giao, rời trang', () => {
  it('previous.delivering → thẻ "Tháng 10 đang giao · 1/2 món" dẫn tới /history/2026-10', async () => {
    mockViewport(1280);
    const prev = view({
      id: 'r-0',
      period_ym: '2026-10',
      is_open: false,
      lines: [
        lineView({ id: 'p-1', item_id: PEN.id, item: facts(PEN), qty: 2, delivered_qty: 2 }),
        lineView({ id: 'p-2', item_id: NOTE.id, item: facts(NOTE), qty: 3, delivered_qty: 1 }),
        lineView({ id: 'p-3', custom_name: 'Bìa', custom_unit: 'cai', review_status: 'rejected' }),
      ],
    });
    stubRequestApi({ period: { ...PERIOD, previous: { ym: '2026-10', delivering: true } }, others: { '2026-10': prev } });
    renderApp(makeMe('member'), '/');
    const card = await screen.findByRole('link', { name: /Tháng 10 đang giao · 1\/2 món/ });
    expect(card).toHaveAttribute('href', '/history/2026-10');
  });

  it('có thay đổi chưa lưu → bấm "Lịch sử" ở thanh dưới hỏi trước; Ở lại thì giữ trang, Rời trang thì đi', async () => {
    mockViewport(390);
    stubRequestApi();
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    await userEvent.click(within(grid()).getByRole('button', { name: `Thêm ${PEN.name}` }));

    await userEvent.click(within(nav).getByRole('link', { name: /Lịch sử/ }));
    let ask = await screen.findByRole('dialog', { name: 'Rời trang khi chưa lưu?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Ở lại' }));
    expect(location()).toBe('/');
    expect(within(cart()).getByRole('spinbutton', { name: PEN.name })).toHaveValue(1);

    await userEvent.click(within(nav).getByRole('link', { name: /Lịch sử/ }));
    ask = await screen.findByRole('dialog', { name: 'Rời trang khi chưa lưu?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Rời trang' }));
    await waitFor(() => expect(location()).toBe('/history'));
  });

  it('không có thay đổi → bấm "Tôi" đi thẳng, không hỏi', async () => {
    mockViewport(390);
    stubRequestApi();
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(screen.getByRole('link', { name: /Tôi/ }));
    await waitFor(() => expect(location()).toBe('/me'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
