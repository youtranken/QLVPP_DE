import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { NOTE, PEN, PERIOD, facts, stubRequestApi, view } from '@/test/request-api-stub';
import { mockViewport } from '@/test/viewport';
import { openPhoneCart } from '@/test/request-cart';

const grid = () => screen.getByRole('region', { name: 'Danh mục món' });
const cart = (hidden = false, month = 11): HTMLElement =>
  hidden
    ? screen.getByRole<HTMLElement>('heading', { name: `Phiếu tháng ${month}`, hidden: true }).closest<HTMLElement>('aside, [role="dialog"]')!
    : (screen.queryByRole('complementary', { name: `Phiếu tháng ${month}` }) ?? screen.getByRole('dialog', { name: `Phiếu tháng ${month}` }));
const showAll = () => userEvent.click(within(grid()).getByRole('button', { name: /^Tất cả/ }));
const cartLine = (name: string, hidden = false, month = 11) => within(cart(hidden, month)).getByText(name).closest('li')!;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RequestPage: kỳ khóa giữa chừng (PERIOD_LOCKED)', () => {
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
    await userEvent.click(screen.getByRole('button', { name: '2 thay đổi chưa lưu · Lưu phiếu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng ký văn phòng phẩm tháng 12' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Phiếu tháng 11 đã khóa lúc 00:00. Món bạn chọn đã được chuyển sang phiếu tháng 12 — bấm Lưu phiếu để giữ.',
    );
    await openPhoneCart(12);
    expect(within(cartLine('Bút bi xanh', false, 12)).getByRole('spinbutton')).toHaveValue(2);
    expect(within(cartLine('Giấy note vàng', false, 12)).getByRole('spinbutton')).toHaveValue(1);
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
    // Điều kiện đầu: phiếu đã lưu đã nằm trong giỏ trước khi sửa
    await within(await openPhoneCart()).findByText('Bút bi xanh');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await showAll();
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm vào phiếu: Giấy note vàng' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu phiếu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng ký văn phòng phẩm tháng 12' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Phiếu tháng 11 đã khóa lúc 00:00. Phiếu đã lưu lúc 14:20 vẫn giữ và sẽ được giao; thay đổi chưa lưu không kịp áp dụng. Phiếu tháng 12 đã mở.',
    );
    // Kỳ mới giỏ trống, không có gì để lưu: thanh phiếu nổi không hiện (không nút Xem phiếu / Lưu phiếu)
    expect(screen.queryByRole('button', { name: /^Xem phiếu \(/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Lưu phiếu$/ })).toBeNull();
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
    expect(within(cartLine('Bút bi xanh', false, 1)).getByRole('spinbutton')).toHaveValue(1);
  });
});
