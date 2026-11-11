import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { NOTE, PAUSED, PEN, facts, stubRequestApi, view } from '@/test/request-api-stub';
import { mockViewport } from '@/test/viewport';
import { openPhoneCart, startEditingOrder } from '@/test/request-cart';

const grid = () => screen.getByRole('region', { name: 'Danh mục món' });
const cart = () => screen.queryByRole('complementary', { name: 'Phiếu tháng 11' }) ?? screen.getByRole('dialog', { name: 'Phiếu tháng 11' });
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
      put: () => jsonResponse(500, {}),
    });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: '+ Thêm món khác' }));
    const dialog = await screen.findByRole('dialog', { name: 'Thêm món khác' });
    await userEvent.type(within(dialog).getByLabelText('Tên món'), 'Bìa còng 7cm');
    await userEvent.selectOptions(within(dialog).getByLabelText('Đơn vị tính'), 'cai');
    expect(within(dialog).queryByLabelText(/ảnh/i)).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm vào phiếu' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await openPhoneCart();
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
      lines: [{ custom_name: 'Bìa còng 5cm', custom_unit: 'cai', custom_note: null, image_file_id: null, qty: 2 }],
    });
  });

  it('dòng ngoài DM đã lưu, chờ xem, kỳ đang mở → nhãn "Adm D&E xem từ 00:00 ngày 11/11" (không "Chờ Adm D&E xem"); sửa tên gửi id kèm trường riêng', async () => {
    mockViewport(1280);
    const custom = lineView({ id: 'l-c', custom_name: 'Bìa còng', custom_unit: 'cai', image_file_id: 'f-1', qty: 2, review_status: 'pending' });
    const api = stubRequestApi({ request: view({ lines: [custom] }), put: () => jsonResponse(500, {}) });
    renderApp(makeMe('member'), '/');
    const label = await within(await screen.findByRole('complementary', { name: 'Phiếu tháng 11' })).findByText('Bìa còng');
    expect(within(label.closest('li')!).getByText('Adm D&E xem từ 00:00 ngày 11/11')).toBeInTheDocument();
    await startEditingOrder();
    const name = within(cart()).getByRole('button', { name: 'Sửa Bìa còng' });
    expect(within(name.closest('li')!).getByText('Adm D&E xem từ 00:00 ngày 11/11')).toBeInTheDocument();
    expect(within(name.closest('li')!).queryByText('Sản phẩm ngoài danh mục, chờ phê duyệt')).toBeNull();
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

  it('dòng đã được Adm D&E thêm vào danh mục (converted) → tên món mới, nhãn "Đã thêm vào danh mục"', async () => {
    mockViewport(1280);
    const converted = lineView({
      id: 'l-v',
      item_id: NOTE.id,
      item: facts(NOTE),
      qty: 2,
      review_status: 'converted',
      review_note: 'Từ: Giấy note',
    });
    stubRequestApi({ request: view({ lines: [converted] }) });
    renderApp(makeMe('member'), '/');
    const side = await screen.findByRole('complementary', { name: 'Phiếu tháng 11' });
    const line = (await within(side).findByText('Giấy note vàng')).closest('li')!;
    expect(within(line).getByText('Đã thêm vào danh mục')).toHaveClass('tag--ok');
    expect(within(line).queryByText('Ngoài danh mục')).toBeNull();
  });
});

describe('RequestPage — chép lại tháng trước', () => {
  it('không có phiếu kỳ trước (404) → không có nút chép', async () => {
    mockViewport(1280);
    stubRequestApi();
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    expect(screen.queryByRole('button', { name: /Chép lại danh sách tháng/ })).toBeNull();
  });

  it('giỏ rỗng → điền thẳng (chưa lưu) + hộp tóm tắt "Đã bỏ: Giấy A4 — chỉ Adm D&E đặt"; lưu gửi dòng ngoài DM kèm ảnh cũ', async () => {
    mockViewport(1280);
    const api = stubRequestApi({ copy: () => jsonResponse(200, COPY), put: () => jsonResponse(500, {}) });
    renderApp(makeMe('member'), '/');
    await userEvent.click(await screen.findByRole('button', { name: 'Chép lại danh sách tháng 10' }));
    const summary = await screen.findByRole('dialog', { name: 'Đã chép danh sách tháng 10' });
    expect(within(summary).getByText('Đã bỏ: Giấy A4 — chỉ Adm D&E đặt')).toBeInTheDocument();
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

  it('giỏ có dòng Adm D&E thêm cùng món → chép bỏ món đó (không trùng id), tóm tắt "Adm D&E đã thêm món này"', async () => {
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
    expect(within(summary).getByText('Đã bỏ: Bút bi xanh — Adm D&E đã thêm món này')).toBeInTheDocument();
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
    await userEvent.click(within(grid()).getByRole('button', { name: `Thêm vào phiếu: ${NOTE.name}` }));
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

describe('RequestPage — rời trang', () => {
  it('có thay đổi chưa lưu → bấm "Lịch sử" ở thanh dưới hỏi trước; Ở lại thì giữ trang, Rời trang thì đi', async () => {
    mockViewport(390);
    stubRequestApi();
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    await userEvent.click(within(grid()).getByRole('button', { name: `Thêm vào phiếu: ${PEN.name}` }));

    await userEvent.click(within(nav).getByRole('link', { name: /Lịch sử/ }));
    let ask = await screen.findByRole('dialog', { name: 'Rời trang khi chưa lưu?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Ở lại' }));
    expect(location()).toBe('/');
    await openPhoneCart();
    expect(within(cart()).getByRole('spinbutton', { name: PEN.name })).toHaveValue(1);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await userEvent.click(within(nav).getByRole('link', { name: /Lịch sử/ }));
    ask = await screen.findByRole('dialog', { name: 'Rời trang khi chưa lưu?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Rời trang' }));
    await waitFor(() => expect(location()).toBe('/history'));
  });

  it('có thay đổi chưa lưu → bấm "Tôi" mở hộp tài khoản, không đổi trang, không hỏi rời trang', async () => {
    mockViewport(390);
    stubRequestApi();
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: `Thêm vào phiếu: ${PEN.name}` }));
    await userEvent.click(screen.getByRole('button', { name: /Tôi/ }));
    expect(await screen.findByRole('dialog', { name: 'Tài khoản' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Rời trang khi chưa lưu?' })).toBeNull();
    expect(location()).toBe('/');
  });
});

describe('RequestPage — dòng món đã ngừng', () => {
  it('món đã ngừng trên phiếu đã lưu: nút Bớt/Thêm trong giỏ vô hiệu, nút Bỏ vẫn bấm được', async () => {
    mockViewport(1280);
    stubRequestApi({
      request: view({ lines: [lineView({ id: 'l-pen', item_id: PEN.id, item: { ...facts(PEN), active: false }, qty: 3 })] }),
    });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('complementary', { name: 'Phiếu tháng 11' })).findByText('Bút bi xanh');
    await startEditingOrder();
    const line = within(cart()).getByText('Bút bi xanh').closest('li')!;
    expect(within(line).getByRole('button', { name: 'Bớt Bút bi xanh' })).toBeDisabled();
    expect(within(line).getByRole('button', { name: 'Thêm Bút bi xanh' })).toBeDisabled();
    expect(within(line).getByRole('button', { name: 'Bỏ Bút bi xanh' })).toBeEnabled();
  });

  it('SL đã lưu vượt max_qty mới (max bị hạ): bấm Bớt trên thẻ lưới giảm 1 (12 → 11), không nhảy về max', async () => {
    mockViewport(1280);
    stubRequestApi({ request: view({ lines: [lineView({ id: 'l-note', item_id: NOTE.id, item: facts(NOTE), qty: 12 })] }) });
    renderApp(makeMe('member'), '/');
    const card = (await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Giấy note vàng')).closest('article')!;
    await userEvent.click(within(card).getByRole('button', { name: 'Bớt Giấy note vàng' }));
    expect(within(card).getByRole('spinbutton', { name: 'Giấy note vàng' })).toHaveValue(11);
  });
});

describe('RequestPage — món thuộc nhóm đang ngừng (active, usable=false)', () => {
  it('hiện trên lưới chọn món với dấu "Tạm ngưng", không đặt được', async () => {
    mockViewport(1280);
    stubRequestApi({ items: [PEN, PAUSED] });
    renderApp(makeMe('member'), '/');
    expect(await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh')).toBeInTheDocument();
    const grid = within(screen.getByRole('region', { name: 'Danh mục món' }));
    expect(grid.getByText('Bút dạ quang')).toBeInTheDocument();
    expect(grid.getByRole('img', { name: 'Tạm ngưng' })).toBeInTheDocument();
    expect(grid.getByRole('button', { name: /Không đặt được/ })).toBeDisabled();
  });

  it('dòng đã lưu của món đó: như món đã ngừng — Bớt/Thêm vô hiệu, Bỏ vẫn bấm được', async () => {
    mockViewport(1280);
    stubRequestApi({
      items: [PEN, PAUSED],
      request: view({ lines: [lineView({ id: 'l-paused', item_id: PAUSED.id, item: facts(PAUSED), qty: 3 })] }),
    });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('complementary', { name: 'Phiếu tháng 11' })).findByText('Bút dạ quang');
    await startEditingOrder();
    const line = within(cart()).getByText('Bút dạ quang').closest('li')!;
    expect(within(line).getByRole('button', { name: 'Bớt Bút dạ quang' })).toBeDisabled();
    expect(within(line).getByRole('button', { name: 'Thêm Bút dạ quang' })).toBeDisabled();
    expect(within(line).getByRole('button', { name: 'Bỏ Bút dạ quang' })).toBeEnabled();
  });
});
