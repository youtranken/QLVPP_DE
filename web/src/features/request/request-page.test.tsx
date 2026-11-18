import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { A4, CLIP, NOTE, PAUSED, PEN, PERIOD, facts, stubRequestApi, view } from '@/test/request-api-stub';
import { mockViewport } from '@/test/viewport';
import { openPhoneCart } from '@/test/request-cart';

const grid = () => screen.getByRole('region', { name: 'Danh mục món' });
// Radix ẩn nền khi hộp thoại mở (mất tên truy cập) → tìm giỏ phía sau qua tiêu đề
const cart = (hidden = false, month = 11): HTMLElement =>
  hidden
    ? screen.getByRole<HTMLElement>('heading', { name: `Phiếu tháng ${month}`, hidden: true }).closest<HTMLElement>('aside, [role="dialog"]')!
    : (screen.queryByRole('complementary', { name: `Phiếu tháng ${month}` }) ?? screen.getByRole('dialog', { name: `Phiếu tháng ${month}` }));
// 390 px mặc định nhóm đầu: món ở nhóm khác phải bấm chip "Tất cả" mới thấy
const showAll = () => userEvent.click(within(grid()).getByRole('button', { name: /^Tất cả/ }));
const cartLine = (name: string, hidden = false, month = 11) => within(cart(hidden, month)).getByText(name).closest('li')!;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RequestPage', () => {
  it('đang tải và lỗi tải nằm trong khung sáng .m-panel (không trơ trên nền teal); lỗi có "Thử lại"', async () => {
    mockViewport(1280);
    const api = stubRequestApi();
    api.fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.startsWith('/api/me/request?ym=') ? jsonResponse(500, {}) : jsonResponse(200, url === '/api/periods/current' ? PERIOD : [])),
    );
    renderApp(makeMe('member'), '/');
    expect(document.querySelector('.load-state')?.closest('.m-panel')).not.toBeNull();
    const retry = await screen.findByRole('button', { name: 'Thử lại' });
    expect(retry.closest('.m-panel')).not.toBeNull();
  });

  // Rà soát 13/11 Gu #5 (nhân viên): lỗi tải chỉ còn hộp lỗi, mất tiêu đề trang (Lịch sử thì giữ)
  it('lỗi tải phiếu (đã biết kỳ) giữ tiêu đề trang "Đăng ký văn phòng phẩm tháng 11" ở 390', async () => {
    mockViewport(390);
    const api = stubRequestApi();
    api.fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.startsWith('/api/me/request?ym=') ? jsonResponse(500, {}) : jsonResponse(200, url === '/api/periods/current' ? PERIOD : [])),
    );
    renderApp(makeMe('member'), '/');
    const retry = await screen.findByRole('button', { name: 'Thử lại' });
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng ký văn phòng phẩm tháng 11' })).toBeInTheDocument();
    expect(retry.closest('.m-panel')).not.toBeNull();
  });

  it('lỗi tải kỳ hiện tại → tiêu đề "Đăng ký" + Thử lại trong khung sáng', async () => {
    mockViewport(1280);
    const api = stubRequestApi();
    api.fetchMock.mockImplementation((url: string) => Promise.resolve(url === '/api/periods/current' ? jsonResponse(500, {}) : jsonResponse(200, [])));
    renderApp(makeMe('member'), '/');
    const retry = await screen.findByRole('button', { name: 'Thử lại' }, { timeout: 15000 });
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng ký' })).toBeInTheDocument();
    expect(retry.closest('.m-panel')).not.toBeNull();
  }, 20000);

  it('chưa có phiếu: hero "Đăng ký văn phòng phẩm tháng 11", còn 4 ngày, "Chưa lưu phiếu tháng này"', async () => {
    mockViewport(1280);
    stubRequestApi();
    renderApp(makeMe('member'), '/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng ký văn phòng phẩm tháng 11' })).toBeInTheDocument();
    expect(screen.getByText('Chưa lưu phiếu tháng này')).toBeInTheDocument();
    expect(screen.getByText('Chọn món, bấm Lưu phiếu. Bạn sửa được tới 23:59 ngày 10/11, còn 4 ngày.')).toBeInTheDocument();
    expect(await within(grid()).findByText('Bút bi xanh')).toBeInTheDocument();
    expect(within(grid()).getByText((_, el) => el?.classList.contains('rq-card-unit') === true && el.textContent === 'Tối đa 20 cây/tháng')).toBeInTheDocument();
    expect(within(grid()).getByRole('button', { name: /Không thấy món cần\?/ })).toBeInTheDocument();
  });

  it('390 px: chọn 3 món → thanh "3 thay đổi chưa lưu · Lưu" → hộp xác nhận → PUT đúng body → toast + "Đã lưu 14:20"', async () => {
    mockViewport(390);
    const api = stubRequestApi({ request: null, put: () =>
      jsonResponse(200, {
        request: view({
          lines: [
            lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 }),
            lineView({ id: 'l-2', item_id: NOTE.id, item: facts(NOTE), qty: 1 }),
            lineView({ id: 'l-3', item_id: CLIP.id, item: facts(CLIP), qty: 1 }),
          ],
        }),
      }),
    });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm vào phiếu: Bút bi xanh' }));
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await showAll();
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm vào phiếu: Giấy note vàng' }));
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm vào phiếu: Kẹp giấy' }));

    expect(screen.getByRole('button', { name: 'Xem phiếu (3 món)' })).toBeInTheDocument();
    await openPhoneCart();
    expect(within(cart()).getByText('3 loại món · 4 đơn vị')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '3 thay đổi chưa lưu · Lưu phiếu' }));
    const dialog = await screen.findByRole('dialog', { name: 'Lưu phiếu tháng 11?' });
    expect(within(dialog).getByText('2 cây')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu phiếu' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.putBody()).toEqual({
      ym: '2026-11',
      lines: [
        { item_id: PEN.id, qty: 2 },
        { item_id: NOTE.id, qty: 1 },
        { item_id: CLIP.id, qty: 1 },
      ],
    });
    expect(screen.getByText('Đã lưu phiếu tháng 11').closest('[role="status"]')).not.toBeNull();
    expect(screen.getByText('Đã lưu 14:20')).toBeInTheDocument();
    expect(screen.queryByText(/sửa tiếp/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Lưu phiếu/ })).toBeNull();
  });

  it('server 409 STALE_UPDATE → hộp "Phiếu vừa được cập nhật ở nơi khác"; giỏ giữ nguyên; "Tải lại" lấy bản mới', async () => {
    mockViewport(1280);
    const saved = view({ lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 })] });
    const api = stubRequestApi({ request: saved, put: () => jsonResponse(409, { code: 'STALE_UPDATE', message: 'x' }) });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('complementary', { name: 'Phiếu tháng 11' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu phiếu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));

    const stale = await screen.findByRole('dialog', { name: 'Phiếu vừa được cập nhật ở nơi khác' });
    expect(within(cartLine('Bút bi xanh', true)).getByRole('spinbutton', { hidden: true })).toHaveValue(3);
    api.setServer(view({ updated_at: '2026-11-03T08:00:00.000Z', lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 7 })] }));
    expect(within(stale).getByText(/Để lưu, cần tải bản mới nhất — các thay đổi chưa lưu ở đây sẽ mất\./)).toBeInTheDocument();
    await userEvent.click(within(stale).getByRole('button', { name: 'Tải bản mới nhất' }));
    await waitFor(() => expect(within(cartLine('Bút bi xanh')).getByRole('spinbutton')).toHaveValue(7));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('400 ITEM_INACTIVE {line_id} → đúng dòng đó báo lỗi, dòng khác giữ nguyên không lỗi', async () => {
    mockViewport(1280);
    const saved = view({
      lines: [
        lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 }),
        lineView({ id: 'l-2', item_id: NOTE.id, item: facts(NOTE), qty: 1 }),
      ],
    });
    stubRequestApi({ request: saved, put: () => jsonResponse(400, { code: 'ITEM_INACTIVE', message: 'x', line_id: 'l-2' }) });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('complementary', { name: 'Phiếu tháng 11' })).findByText('Giấy note vàng');
    await showAll();
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Giấy note vàng' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu phiếu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));

    expect(await within(cartLine('Giấy note vàng')).findByText('Món này đã ngừng — bỏ khỏi phiếu rồi lưu lại.')).toBeInTheDocument();
    expect(within(cartLine('Bút bi xanh')).queryByText(/ngừng/)).toBeNull();
    expect(within(cartLine('Bút bi xanh')).getByRole('spinbutton')).toHaveValue(2);
    expect(within(cartLine('Giấy note vàng')).getByRole('spinbutton')).toHaveValue(2);
  });

  it('dòng Adm D&E thêm: nhãn "Adm D&E thêm", không có nút −/+/×', async () => {
    mockViewport(1280);
    stubRequestApi({
      request: view({
        lines: [
          lineView({ id: 'l-a', item_id: A4.id, item: facts(A4), qty: 2, added_by_admin: true, readonly_for_member: true }),
        ],
      }),
    });
    renderApp(makeMe('member'), '/');
    const line = (await within(await screen.findByRole('complementary', { name: 'Phiếu tháng 11' })).findByText('Giấy A4')).closest('li')!;
    expect(within(line).getByText('Adm D&E thêm')).toHaveAttribute(
      'title',
      'Dòng này do Adm D&E thêm — cần sửa thì liên hệ Adm D&E.',
    );
    expect(within(line).queryAllByRole('button')).toEqual([]);
    expect(within(line).getByText('2 ram')).toBeInTheDocument();
  });

  it('390 px: lỗi theo dòng → thông báo role=alert thấy ngay, focus stepper của dòng lỗi (aria-describedby = câu lỗi)', async () => {
    mockViewport(390);
    const saved = view({
      lines: [
        lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 }),
        lineView({ id: 'l-2', item_id: NOTE.id, item: facts(NOTE), qty: 1 }),
      ],
    });
    stubRequestApi({ request: saved, put: () => jsonResponse(400, { code: 'ITEM_INACTIVE', message: 'x', line_id: 'l-2' }) });
    renderApp(makeMe('member'), '/');
    await openPhoneCart();
    await within(cart()).findByText('Giấy note vàng');
    await userEvent.click(within(cart()).getByRole('button', { name: 'Thêm Giấy note vàng' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu phiếu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));

    const msg = 'Món này đã ngừng — bỏ khỏi phiếu rồi lưu lại.';
    expect(await screen.findByRole('alert')).toHaveTextContent(`Chưa lưu được — Giấy note vàng: ${msg}`);
    const stepper = within(cart()).getByRole('spinbutton', { name: 'Giấy note vàng' });
    await waitFor(() => expect(stepper).toHaveFocus());
    expect(stepper).toHaveAccessibleDescription(msg);
    expect(stepper).toHaveAttribute('aria-invalid', 'true');

    await userEvent.click(within(cart()).getByRole('button', { name: 'Bớt Giấy note vàng' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('390 px: lỗi mạng/không rõ → thông báo role=alert "Chưa lưu được — kiểm tra mạng rồi thử lại."', async () => {
    mockViewport(390);
    stubRequestApi({ request: null, put: () => jsonResponse(500, {}) });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm vào phiếu: Bút bi xanh' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu phiếu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));
    // Lỗi chung (không gắn dòng) không mở sheet phiếu → thông báo ở ngoài giỏ (cạnh thanh lưu), chỉ một alert
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Chưa lưu được — kiểm tra mạng rồi thử lại.');
    expect(screen.queryByRole('dialog', { name: 'Phiếu tháng 11' })).toBeNull();
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it('STALE: "Đóng, xem giỏ của tôi" giữ giỏ, báo rõ phải tải bản mới mới lưu được', async () => {
    mockViewport(390);
    const saved = view({ lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 })] });
    stubRequestApi({ request: saved, put: () => jsonResponse(409, { code: 'STALE_UPDATE', message: 'x' }) });
    renderApp(makeMe('member'), '/');
    await openPhoneCart();
    await within(cart()).findByText('Bút bi xanh');
    await userEvent.click(within(cart()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu phiếu' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Lưu phiếu tháng 11?' })).getByRole('button', { name: 'Lưu phiếu' }));
    const stale = await screen.findByRole('dialog', { name: 'Phiếu vừa được cập nhật ở nơi khác' });
    await userEvent.click(within(stale).getByRole('button', { name: 'Đóng, xem giỏ của tôi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Giỏ này chưa lưu được vì phiếu đã đổi ở nơi khác — bấm Lưu phiếu để mở lại lựa chọn tải bản mới nhất.',
    );
    expect(within(cartLine('Bút bi xanh')).getByRole('spinbutton')).toHaveValue(3);
  });

  it('dòng chỉ xem được → câu cố định "liên hệ Adm D&E" (không còn cấu hình liên hệ)', async () => {
    mockViewport(1280);
    stubRequestApi({
      request: view({ lines: [lineView({ id: 'l-a', item_id: A4.id, item: facts(A4), qty: 2, added_by_admin: true, readonly_for_member: true })] }),
    });
    renderApp(makeMe('member'), '/');
    const line = (await within(await screen.findByRole('complementary', { name: 'Phiếu tháng 11' })).findByText('Giấy A4')).closest('li')!;
    expect(within(line).getByText('Adm D&E thêm')).toHaveAttribute('title', 'Dòng này do Adm D&E thêm — cần sửa thì liên hệ Adm D&E.');
  });

  it('NV-19: phiếu đã lưu mở trang → giỏ có ngay −/+ (không "Sửa phiếu"), không nút Lưu khi chưa đổi', async () => {
    mockViewport(1280);
    stubRequestApi({ request: view({ lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 })] }) });
    renderApp(makeMe('member'), '/');
    const panel = await screen.findByRole('complementary', { name: 'Phiếu tháng 11' });
    await within(panel).findByText('Bút bi xanh');
    expect(within(cartLine('Bút bi xanh')).getByRole('spinbutton')).toHaveValue(2);
    expect(within(panel).queryByRole('button', { name: 'Sửa phiếu' })).toBeNull();
    expect(within(panel).queryByRole('button', { name: /Lưu phiếu/ })).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Hủy' })).toBeNull();
  });

  it('đổi số lượng trong giỏ: "Lưu phiếu" bật kèm "Hủy" phụ; Hủy bỏ thay đổi về phiếu đã lưu (2), focus về ô số lượng dòng đầu', async () => {
    mockViewport(1280);
    stubRequestApi({ request: view({ lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 })] }) });
    renderApp(makeMe('member'), '/');
    const panel = await screen.findByRole('complementary', { name: 'Phiếu tháng 11' });
    await within(panel).findByText('Bút bi xanh');
    await userEvent.click(within(cartLine('Bút bi xanh')).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    expect(within(cart()).getByRole('button', { name: '1 thay đổi chưa lưu · Lưu phiếu' })).toBeEnabled();
    await userEvent.click(within(cart()).getByRole('button', { name: 'Hủy' }));
    expect(within(cartLine('Bút bi xanh')).getByRole('spinbutton')).toHaveValue(2);
    expect(within(cart()).queryByRole('button', { name: 'Hủy' })).toBeNull();
    expect(within(cart()).getByText(/^Đã lưu/)).toHaveClass('is-saved');
    expect(document.body).not.toHaveFocus();
  });

  it('phiếu đã lưu, thêm ở thẻ rồi bỏ dòng đó (dirty về 0) → không nút Lưu, không Hủy, giỏ vẫn có −/+', async () => {
    mockViewport(1280);
    stubRequestApi({ request: view({ lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 })] }) });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('complementary', { name: 'Phiếu tháng 11' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm vào phiếu: Giấy note vàng' }));
    await userEvent.click(within(cartLine('Giấy note vàng')).getByRole('button', { name: /^Bỏ / }));
    expect(within(cart()).queryByRole('button', { name: 'Hủy' })).toBeNull();
    expect(within(cart()).queryByRole('button', { name: /Lưu phiếu/ })).toBeNull();
    expect(within(cartLine('Bút bi xanh')).getByRole('spinbutton')).toHaveValue(2);
  });

  it('kỳ khóa (is_open false): giỏ chỉ xem — không −/+, không nút Lưu (luật server giữ nguyên)', async () => {
    mockViewport(1280);
    stubRequestApi({ period: { ...PERIOD, is_open: false, days_left: 0 }, request: view({ is_open: false, lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 })] }) });
    renderApp(makeMe('member'), '/');
    const panel = await screen.findByRole('complementary', { name: 'Phiếu tháng 11' });
    await within(panel).findByText('Bút bi xanh');
    expect(within(panel).queryByRole('spinbutton')).toBeNull();
    expect(within(panel).queryByRole('button', { name: /Lưu phiếu|Thêm món khác/ })).toBeNull();
    expect(within(cartLine('Bút bi xanh')).getByText('2 cây')).toBeInTheDocument();
  });

  it('món tạm ngưng hiện trong lưới (có dấu); G7: không còn món ẩn — Giấy A4 hiện như món thường', async () => {
    mockViewport(1280);
    stubRequestApi({ items: [PEN, PAUSED, A4] });
    renderApp(makeMe('member'), '/');
    await screen.findByRole('region', { name: 'Danh mục món' });
    expect(await within(grid()).findByText('Bút dạ quang')).toBeInTheDocument();
    expect(within(grid()).getAllByRole('img', { name: 'Tạm ngưng' })).toHaveLength(1);
    expect(within(grid()).getByRole('button', { name: /Không đặt được/ })).toBeDisabled();
    expect(within(grid()).getByText('Giấy A4')).toBeInTheDocument();
  });
});
