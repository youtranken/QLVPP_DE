import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { PERIOD, PEN, facts, view } from '@/test/request-api-stub';
import { lineView } from '@/test/fixtures-request';
import { historyItem as item, stubHistory as stub } from '@/test/history-stub';

const requestGets = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/api/me/request?ym='));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HistoryPage — chip trạng thái tháng', () => {
  it.each([
    [{ delivered_qty: 10, remaining_qty: 0 }, 'Đã nhận đủ'],
    [{ delivered_qty: 6, remaining_qty: 4, owed_line_count: 1 }, 'Còn chờ 1 món'],
    [{ total_qty: 0, line_count: 0, delivered_qty: 0, remaining_qty: 0 }, 'Không có phiếu'],
  ])('chip tháng %j → "%s"; kỳ đang mở → "Đang mở"', async (over, chip) => {
    stub([{ items: [item({ period_ym: '2026-11' }), item({ period_ym: '2026-10', ...over })], next_cursor: null }], [], {
      '2026-10': view({ period_ym: '2026-10', is_open: false, lines: [lineView({ id: 'a', item_id: PEN.id, item: facts(PEN), qty: 10, delivered_qty: 6 })] }),
    });
    renderApp(makeMe('member'), '/history');
    const card = (await screen.findByText('Tháng 10/2026')).closest('li')!;
    expect(await within(card).findByText(chip)).toBeInTheDocument();
    expect(within((await screen.findByText('Tháng 11/2026')).closest('li')!).getByText('Đang mở')).toBeInTheDocument();
  });

  it('"Còn chờ k món" lấy owed_line_count của danh sách ngay lần vẽ đầu — không GET phiếu từng tháng (chỉ tháng đóng gần nhất)', async () => {
    const fetchMock = stub([
      {
        items: [
          item({ period_ym: '2026-10', line_count: 0, total_qty: 0, remaining_qty: 0 }),
          item({ period_ym: '2026-09', delivered_qty: 1, remaining_qty: 9, owed_line_count: 3 }),
          item({ period_ym: '2026-08', delivered_qty: 0, remaining_qty: 10, owed_line_count: 2 }),
        ],
        next_cursor: null,
      },
    ]);
    renderApp(makeMe('member'), '/history');
    const sep = (await screen.findByText('Tháng 9/2026')).closest('li')!;
    expect(within(sep).getByText('Còn chờ 3 món')).toBeInTheDocument();
    expect(within(screen.getByText('Tháng 8/2026').closest('li')!).getByText('Còn chờ 2 món')).toBeInTheDocument();
    await waitFor(() => expect(requestGets(fetchMock)).toEqual(['/api/me/request?ym=2026-09']));
  });

  it('kỳ đang mở chưa tải xong → chưa tải dòng tháng nào; tải xong chỉ GET tháng đã đóng gần nhất (không GET kỳ đang mở)', async () => {
    let releasePeriod: (r: Response) => void = () => {};
    const page = { items: [item({ period_ym: '2026-11' }), item({ period_ym: '2026-10' })], next_cursor: null };
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/periods/current') return new Promise<Response>((resolve) => (releasePeriod = resolve));
      if (url.startsWith('/api/me/issues')) return Promise.resolve(jsonResponse(200, { items: [], next_cursor: null }));
      if (url.startsWith('/api/me/requests')) return Promise.resolve(jsonResponse(200, page));
      return Promise.resolve(jsonResponse(404, { code: 'REQUEST_NOT_FOUND' }));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp(makeMe('member'), '/history');
    await screen.findByText('Tháng 11/2026');
    await new Promise((r) => setTimeout(r, 20));
    expect(requestGets(fetchMock)).toEqual([]);
    releasePeriod(jsonResponse(200, PERIOD));
    await waitFor(() => expect(requestGets(fetchMock)).toEqual(['/api/me/request?ym=2026-10']));
  });
});
