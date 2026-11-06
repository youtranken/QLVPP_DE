import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { A4, CLIP, NOTE, PEN, PERIOD, facts, stubRequestApi, view } from '@/test/request-api-stub';
import { mockViewport } from '@/test/viewport';

const grid = () => screen.getByRole('region', { name: 'Danh mục món' });
// Radix ẩn nền khi hộp thoại mở (mất tên truy cập) → tìm giỏ phía sau qua tiêu đề
const cart = (hidden = false) =>
  hidden
    ? screen.getByRole('heading', { name: 'Phiếu của tôi', hidden: true }).closest('aside')!
    : screen.getByRole('complementary', { name: 'Phiếu của tôi' });
// 390 px mặc định nhóm đầu (R-C2): món ở nhóm khác phải bấm chip "Tất cả" mới thấy
const showAll = () => userEvent.click(within(grid()).getByRole('button', { name: /^Tất cả/ }));
const cartLine = (name: string, hidden = false) => within(cart(hidden)).getByText(name).closest('li')!;

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

  it('chưa có phiếu: hero "Đăng ký văn phòng phẩm tháng 11", còn 4 ngày, "Chưa lưu phiếu tháng này"; món chỉ Hành chính không hiện', async () => {
    mockViewport(1280);
    stubRequestApi();
    renderApp(makeMe('member'), '/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng ký văn phòng phẩm tháng 11' })).toBeInTheDocument();
    expect(screen.getByText('Chưa lưu phiếu tháng này')).toBeInTheDocument();
    expect(screen.getByText('Chọn món, bấm Lưu phiếu. Bạn sửa được tới 23:59 ngày 10/11, còn 4 ngày.')).toBeInTheDocument();
    expect(await within(grid()).findByText('Bút bi xanh')).toBeInTheDocument();
    expect(within(grid()).getByText('cây · tối đa 20/tháng')).toBeInTheDocument();
    expect(within(grid()).queryByText('Giấy A4')).toBeNull();
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

    expect(within(cart()).getByText('3 loại món · 4 đơn vị')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '3 thay đổi chưa lưu · Lưu' }));
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
    expect(screen.getByText(/Đã lưu 14:20 · sửa tiếp đến hết 10\/11/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu phiếu' })).toBeDisabled();
  });

  it('server 409 STALE_UPDATE → hộp "Phiếu vừa được cập nhật ở nơi khác"; giỏ giữ nguyên; "Tải lại" lấy bản mới', async () => {
    mockViewport(1280);
    const saved = view({ lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 })] });
    const api = stubRequestApi({ request: saved, put: () => jsonResponse(409, { code: 'STALE_UPDATE', message: 'x' }) });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('complementary', { name: 'Phiếu của tôi' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
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
    await within(await screen.findByRole('complementary', { name: 'Phiếu của tôi' })).findByText('Giấy note vàng');
    await showAll();
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Giấy note vàng' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));

    expect(await within(cartLine('Giấy note vàng')).findByText('Món này đã ngừng — bỏ khỏi phiếu rồi lưu lại.')).toBeInTheDocument();
    expect(within(cartLine('Bút bi xanh')).queryByText(/ngừng/)).toBeNull();
    expect(within(cartLine('Bút bi xanh')).getByRole('spinbutton')).toHaveValue(2);
    expect(within(cartLine('Giấy note vàng')).getByRole('spinbutton')).toHaveValue(2);
  });

  it('dòng Hành chính thêm: nhãn "Hành chính thêm", không có nút −/+/×', async () => {
    mockViewport(1280);
    stubRequestApi({
      request: view({
        lines: [
          lineView({ id: 'l-a', item_id: A4.id, item: facts(A4), qty: 2, added_by_admin: true, readonly_for_member: true }),
        ],
      }),
    });
    renderApp(makeMe('member'), '/');
    const line = (await within(await screen.findByRole('complementary', { name: 'Phiếu của tôi' })).findByText('Giấy A4')).closest('li')!;
    expect(within(line).getByText('Hành chính thêm')).toHaveAttribute(
      'title',
      'Dòng này do Hành chính thêm — cần sửa thì liên hệ chị Bình — Hành chính.',
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
    await within(await screen.findByRole('complementary', { name: 'Phiếu của tôi' })).findByText('Giấy note vàng');
    await userEvent.click(within(cart()).getByRole('button', { name: 'Thêm Giấy note vàng' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
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
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));
    // Giỏ nằm dưới lưới ở 390 → thông báo phải ở ngoài giỏ (cạnh thanh lưu), chỉ một alert
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Chưa lưu được — kiểm tra mạng rồi thử lại.');
    expect(cart()).not.toContainElement(alert);
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it('STALE: "Đóng, xem giỏ của tôi" giữ giỏ, báo rõ phải tải bản mới mới lưu được', async () => {
    mockViewport(390);
    const saved = view({ lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 })] });
    stubRequestApi({ request: saved, put: () => jsonResponse(409, { code: 'STALE_UPDATE', message: 'x' }) });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('complementary', { name: 'Phiếu của tôi' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));
    const stale = await screen.findByRole('dialog', { name: 'Phiếu vừa được cập nhật ở nơi khác' });
    await userEvent.click(within(stale).getByRole('button', { name: 'Đóng, xem giỏ của tôi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Giỏ này chưa lưu được vì phiếu đã đổi ở nơi khác — bấm Lưu phiếu để mở lại lựa chọn tải bản mới nhất.',
    );
    expect(within(cartLine('Bút bi xanh')).getByRole('spinbutton')).toHaveValue(3);
  });

  it('dòng chỉ xem được, chưa cấu hình liên hệ → câu "liên hệ Hành chính"', async () => {
    mockViewport(1280);
    stubRequestApi({
      request: view({ lines: [lineView({ id: 'l-a', item_id: A4.id, item: facts(A4), qty: 2, added_by_admin: true, readonly_for_member: true })] }),
    });
    const me = makeMe('member');
    renderApp({ ...me, config: { ...me.config, admin_contact: ' ' } }, '/');
    const line = (await within(await screen.findByRole('complementary', { name: 'Phiếu của tôi' })).findByText('Giấy A4')).closest('li')!;
    expect(within(line).getByText('Hành chính thêm')).toHaveAttribute('title', 'Dòng này do Hành chính thêm — cần sửa thì liên hệ Hành chính.');
  });

  it('390 px: PERIOD_LOCKED, kỳ cũ CHƯA lưu → giỏ mang sang (bỏ id), tiêu đề "Phiếu tháng 12", câu báo đúng; lưu lại gửi ym mới', async () => {
    mockViewport(390);
    let calls = 0;
    const api = stubRequestApi({
      put: () => {
        calls += 1;
        if (calls > 1) return jsonResponse(500, {});
        api.setPeriod({ ...PERIOD, ym: '2026-12', deadline: '2026-12-10T17:00:00.000Z', days_left: 30 });
        return jsonResponse(400, { code: 'PERIOD_LOCKED', message: 'x', next_ym: '2026-12' });
      },
    });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm vào phiếu: Bút bi xanh' }));
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await showAll();
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm vào phiếu: Giấy note vàng' }));
    await userEvent.click(screen.getByRole('button', { name: '2 thay đổi chưa lưu · Lưu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng ký văn phòng phẩm tháng 12' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Phiếu tháng 11 đã khóa lúc 00:00. Món bạn chọn đã được chuyển sang phiếu tháng 12 — bấm Lưu phiếu để giữ.',
    );
    expect(within(cartLine('Bút bi xanh')).getByRole('spinbutton')).toHaveValue(2);
    expect(within(cartLine('Giấy note vàng')).getByRole('spinbutton')).toHaveValue(1);
    await userEvent.click(screen.getByRole('button', { name: '2 thay đổi chưa lưu · Lưu' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Lưu phiếu tháng 12?' })).getByRole('button', { name: 'Lưu phiếu' }));
    await waitFor(() => expect(calls).toBe(2));
    expect(api.putBody(1)).toEqual({
      ym: '2026-12',
      lines: [
        { item_id: PEN.id, qty: 2 },
        { item_id: NOTE.id, qty: 1 },
      ],
    });
  });

  it('390 px: PERIOD_LOCKED, kỳ cũ ĐÃ lưu → không mang giỏ; kỳ mới từ server (rỗng); báo phiếu lưu lúc 14:20 vẫn giữ', async () => {
    mockViewport(390);
    const saved = view({ lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 })] });
    const api = stubRequestApi({
      request: saved,
      put: () => {
        api.setPeriod({ ...PERIOD, ym: '2026-12', deadline: '2026-12-10T17:00:00.000Z', days_left: 30 });
        return jsonResponse(400, { code: 'PERIOD_LOCKED', message: 'x', next_ym: '2026-12' });
      },
    });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('complementary', { name: 'Phiếu của tôi' })).findByText('Bút bi xanh');
    await showAll();
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm vào phiếu: Giấy note vàng' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng ký văn phòng phẩm tháng 12' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Phiếu tháng 11 đã khóa lúc 00:00. Phiếu đã lưu lúc 14:20 vẫn giữ và sẽ được giao; thay đổi chưa lưu không kịp áp dụng. Phiếu tháng 12 đã mở.',
    );
    expect(within(cart()).getByText('Chưa chọn món nào — bấm + trên thẻ món để thêm.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu phiếu' })).toBeDisabled();
  });

  it('PERIOD_LOCKED thiếu next_ym ở tháng 12 → "phiếu tháng 1" (sang năm mới, không có "tháng 13")', async () => {
    mockViewport(1280);
    const dec = { ...PERIOD, ym: '2026-12', deadline: '2026-12-10T17:00:00.000Z' };
    const api = stubRequestApi({
      period: dec,
      put: () => {
        api.setPeriod({ ...dec, ym: '2027-01', deadline: '2027-01-10T17:00:00.000Z' });
        return jsonResponse(400, { code: 'PERIOD_LOCKED', message: 'x' });
      },
    });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm vào phiếu: Bút bi xanh' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Phiếu tháng 12 đã khóa lúc 00:00. Món bạn chọn đã được chuyển sang phiếu tháng 1 — bấm Lưu phiếu để giữ.',
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng ký văn phòng phẩm tháng 1' })).toBeInTheDocument();
    expect(within(cartLine('Bút bi xanh')).getByRole('spinbutton')).toHaveValue(1);
  });
});

describe('RequestPage — kỳ khóa', () => {
  it('period.is_open=false → thẻ lưới vô hiệu kèm lý do, stepper thẻ đã chọn vô hiệu', async () => {
    mockViewport(1280);
    stubRequestApi({
      period: { ...PERIOD, is_open: false, days_left: 0 },
      request: view({ lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 })] }),
    });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Giấy note vàng');
    const add = within(grid()).getByRole('button', { name: 'Thêm vào phiếu: Giấy note vàng' });
    expect(add).toBeDisabled();
    expect(add).toHaveAttribute('title', 'Kỳ đã khóa sổ — phiếu chỉ xem');
    expect(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' })).toBeDisabled();
    expect(within(grid()).getByRole('button', { name: 'Bớt Bút bi xanh' })).toBeDisabled();
  });
});
