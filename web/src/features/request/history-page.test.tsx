import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { PERIOD } from '@/test/request-api-stub';
import { deliveryState, type HistoryItem } from './history.api';

const item = (over: Partial<HistoryItem>): HistoryItem => ({
  period_ym: '2026-10',
  line_count: 3,
  total_qty: 10,
  delivered_qty: 0,
  remaining_qty: 10,
  cancelled_qty: 0,
  custom: { pending: 0, accepted: 0, converted: 0, rejected: 0 },
  ...over,
});

function stub(pages: { items: HistoryItem[]; next_cursor: string | null }[]) {
  let at = 0;
  const fetchMock = vi.fn((url: string) => {
    if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
    if (url.startsWith('/api/me/requests')) return Promise.resolve(jsonResponse(200, pages[at++] ?? { items: [], next_cursor: null }));
    return Promise.resolve(jsonResponse(500, {}));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('deliveryState', () => {
  it.each([
    [{ total_qty: 10, delivered_qty: 10, remaining_qty: 0 }, 'done'],
    [{ total_qty: 10, delivered_qty: 6, remaining_qty: 4 }, 'owed'],
    [{ total_qty: 10, delivered_qty: 0, remaining_qty: 10 }, 'undelivered'],
    [{ total_qty: 5, delivered_qty: 3, remaining_qty: 0 }, 'done'],
    [{ total_qty: 5, delivered_qty: 0, remaining_qty: 0 }, 'cancelled'],
    [{ total_qty: 0, delivered_qty: 0, remaining_qty: 0 }, 'none'],
  ])('%j -> %s', (n, state) => {
    expect(deliveryState(n)).toBe(state);
  });
});

describe('HistoryPage', () => {
  it('liệt kê kỳ: tháng, loại món · đơn vị, trạng thái giao, món ngoài DM; kỳ đang mở dẫn về /', async () => {
    stub([
      {
        items: [
          item({ period_ym: '2026-11', line_count: 2, total_qty: 3, remaining_qty: 3 }),
          item({ period_ym: '2026-10', delivered_qty: 6, remaining_qty: 4, custom: { pending: 1, accepted: 0, converted: 2, rejected: 1 } }),
          item({ period_ym: '2026-09', delivered_qty: 10, remaining_qty: 0 }),
          item({ period_ym: '2026-08' }),
        ],
        next_cursor: null,
      },
    ]);
    renderApp(makeMe('member'), '/history');
    const open = (await screen.findByText('Tháng 11/2026')).closest('a')!;
    expect(open).toHaveAttribute('href', '/');
    expect(within(open).getByText('Đang mở')).toBeInTheDocument();
    const oct = screen.getByText('Tháng 10/2026').closest('a')!;
    expect(oct).toHaveAttribute('href', '/history/2026-10');
    expect(within(oct).getByText('3 loại món · 10 đơn vị')).toBeInTheDocument();
    expect(within(oct).getByText('Còn nợ 4')).toBeInTheDocument();
    expect(within(oct).getByText(/1 món chờ Hành chính xem · 2 món đã thêm vào danh mục · 1 món bị từ chối/)).toBeInTheDocument();
    expect(within(screen.getByText('Tháng 9/2026').closest('a')!).getByText('Đã giao đủ')).toBeInTheDocument();
    expect(within(screen.getByText('Tháng 8/2026').closest('a')!).getByText('Chưa giao')).toBeInTheDocument();
  });

  it('"Xem thêm" tải trang kế theo cursor', async () => {
    const fetchMock = stub([
      { items: [item({ period_ym: '2026-10' })], next_cursor: 'c1' },
      { items: [item({ period_ym: '2026-09' })], next_cursor: null },
    ]);
    renderApp(makeMe('member'), '/history');
    await userEvent.click(await screen.findByRole('button', { name: 'Xem thêm' }));
    expect(await screen.findByText('Tháng 9/2026')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/me/requests?limit=12&cursor=c1', expect.anything());
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull();
  });

  it('trống: "Chưa có phiếu nào" + nút về trang Đăng ký', async () => {
    stub([{ items: [], next_cursor: null }]);
    renderApp(makeMe('member'), '/history');
    expect(await screen.findByText('Chưa có phiếu nào')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Về trang Đăng ký' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
  });

  it('lỗi tải: báo lỗi có nút thử lại, không giả làm trống', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(500, {}))));
    renderApp(makeMe('member'), '/history');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có phiếu nào')).toBeNull();
  });
});
