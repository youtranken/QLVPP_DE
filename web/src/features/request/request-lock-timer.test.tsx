import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { PEN, PERIOD, facts, stubRequestApi, view } from '@/test/request-api-stub';
import { mockViewport } from '@/test/viewport';

const grid = () => screen.getByRole('region', { name: 'Danh mục món' });
const cart = (month: number) => screen.getByRole('complementary', { name: `Phiếu tháng ${month}` });
const NEXT = { ...PERIOD, ym: '2026-12', deadline: '2026-12-10T17:00:00.000Z', days_left: 30 };
const WAIT = { timeout: 4000 };

afterEach(() => vi.unstubAllGlobals());

// Hạn khóa rơi vào lúc đang mở trang: hẹn giờ deadline + 1 s của trang chạy thật (đồng hồ thật, hạn cách 1,5 s)
async function openWithDeadlineSoon(request: ReturnType<typeof view> | null) {
  mockViewport(1280);
  const api = stubRequestApi({ request, period: { ...PERIOD, deadline: new Date(Date.now() + 1500).toISOString() } });
  renderApp(makeMe('member'), '/');
  await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
  // Server đã sang kỳ 12 sau mốc; chỉ được đọc lại khi hẹn giờ khóa chạy
  api.setPeriod(NEXT);
  return api;
}

describe('RequestPage — qua giờ khóa khi đang sửa chưa lưu (B9)', () => {
  it('kỳ cũ CHƯA lưu, đang chọn Bút bi → tới giờ khóa: sang kỳ 12, câu "Phiếu tháng 11 đã khóa…", giỏ mang sang Bút bi 1 (không mất)', async () => {
    await openWithDeadlineSoon(null);
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm vào phiếu: Bút bi xanh' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng ký văn phòng phẩm tháng 12' }, WAIT)).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Phiếu tháng 11 đã khóa lúc 00:00. Món bạn chọn đã được chuyển sang phiếu tháng 12 — bấm Lưu phiếu để giữ.',
    );
    expect(within(within(cart(12)).getByText('Bút bi xanh').closest('li')!).getByRole('spinbutton')).toHaveValue(1);
  }, 10000);

  it('kỳ cũ ĐÃ lưu 14:20 + sửa chưa lưu → tới giờ khóa: câu "Phiếu đã lưu lúc 14:20 vẫn giữ… thay đổi chưa lưu không kịp áp dụng"', async () => {
    await openWithDeadlineSoon(view({ lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 })] }));
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng ký văn phòng phẩm tháng 12' }, WAIT)).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Phiếu tháng 11 đã khóa lúc 00:00. Phiếu đã lưu lúc 14:20 vẫn giữ và sẽ được giao; thay đổi chưa lưu không kịp áp dụng. Phiếu tháng 12 đã mở.',
    );
  }, 10000);

  it('không có thay đổi chưa lưu → tới giờ khóa chỉ sang kỳ 12, không câu báo', async () => {
    await openWithDeadlineSoon(null);
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng ký văn phòng phẩm tháng 12' }, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  }, 10000);
});
