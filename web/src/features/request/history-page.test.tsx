import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { PERIOD, PEN, NOTE, facts, view } from '@/test/request-api-stub';
import { lineView } from '@/test/fixtures-request';
import { setLanguage } from '@/lib/i18n';
import { deliveryState, type HistoryItem, type MyIssue } from './history.api';

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

const issue = (over: Partial<MyIssue>): MyIssue => ({
  id: 'm-1',
  item_id: 'i-1',
  item_name: 'Bút bi',
  item_name_en: 'Ballpoint pen',
  unit: 'cai',
  qty: 2,
  note: 'Người mới vào',
  created_at: '2026-10-20T03:30:00Z',
  ...over,
});

function stub(
  pages: { items: HistoryItem[]; next_cursor: string | null }[],
  issuePages: { items: MyIssue[]; next_cursor: string | null }[] = [],
  requests: Record<string, ReturnType<typeof view>> = {},
) {
  let at = 0;
  let issueAt = 0;
  const fetchMock = vi.fn((url: string) => {
    if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
    if (url.startsWith('/api/me/request?ym=')) {
      const found = requests[url.slice('/api/me/request?ym='.length)];
      return Promise.resolve(found ? jsonResponse(200, found) : jsonResponse(404, { code: 'REQUEST_NOT_FOUND' }));
    }
    if (url.startsWith('/api/me/issues')) return Promise.resolve(jsonResponse(200, issuePages[issueAt++] ?? { items: [], next_cursor: null }));
    if (url.startsWith('/api/me/requests')) return Promise.resolve(jsonResponse(200, pages[at++] ?? { items: [], next_cursor: null }));
    return Promise.resolve(jsonResponse(500, {}));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await setLanguage('vi');
});

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
    ], [], {
      '2026-10': view({ period_ym: '2026-10', is_open: false, lines: [
        lineView({ id: 'a', item_id: PEN.id, item: facts(PEN), qty: 8, delivered_qty: 4 }),
        lineView({ id: 'b', item_id: NOTE.id, item: facts(NOTE), qty: 2 }),
        lineView({ id: 'c', custom_name: 'Kéo', custom_unit: 'cai', qty: 2, delivered_qty: 2, review_status: 'accepted' }),
      ] }),
      '2026-08': view({ period_ym: '2026-08', is_open: false, lines: [lineView({ id: 'd', item_id: PEN.id, item: facts(PEN), qty: 10 })] }),
    });
    renderApp(makeMe('member'), '/history');
    const open = (await screen.findByText('Tháng 11/2026')).closest('a')!;
    expect(open).toHaveAttribute('href', '/');
    expect(within(open).getByText('Đang mở')).toBeInTheDocument();
    const oct = screen.getByText('Tháng 10/2026').closest('a')!;
    expect(oct).toHaveAttribute('href', '/history/2026-10');
    expect(within(oct).getByText('3 loại món · 10 đơn vị')).toBeInTheDocument();
    expect(await within(oct).findByText('Còn chờ 2 món')).toBeInTheDocument();
    expect(within(oct).getByText(/1 món chờ Hành chính xem · 2 món đã thêm vào danh mục · 1 món bị từ chối/)).toBeInTheDocument();
    expect(within(screen.getByText('Tháng 9/2026').closest('a')!).getByText('Đã nhận đủ')).toBeInTheDocument();
    expect(await within(screen.getByText('Tháng 8/2026').closest('a')!).findByText('Còn chờ 1 món')).toBeInTheDocument();
  });

  it.each([
    [{ delivered_qty: 10, remaining_qty: 0 }, 'Đã nhận đủ'],
    [{ delivered_qty: 6, remaining_qty: 4 }, 'Còn chờ 1 món'],
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

  it('tháng gần nhất đã đóng có dòng món: tên theo ngôn ngữ, số lượng, chip từng dòng, dòng hủy kèm lý do', async () => {
    stub(
      [{ items: [item({ period_ym: '2026-11' }), item({ period_ym: '2026-10', delivered_qty: 7, remaining_qty: 2, cancelled_qty: 2 }), item({ period_ym: '2026-09' })], next_cursor: null }],
      [],
      {
        '2026-10': view({
          period_ym: '2026-10',
          is_open: false,
          lines: [
            lineView({ id: 'a', item_id: PEN.id, item: { ...facts(PEN), name_en: 'Blue pen' }, qty: 4, delivered_qty: 4 }),
            lineView({ id: 'b', item_id: NOTE.id, item: facts(NOTE), qty: 5, delivered_qty: 2, cancelled_qty: 1 }),
            lineView({ id: 'c', custom_name: 'Bìa còng', custom_unit: 'cai', qty: 3, cancelled_qty: 3, cancel_note: 'Hết hàng', review_status: 'accepted' }),
          ],
        }),
      },
    );
    renderApp(makeMe('member'), '/history');
    const card = (await screen.findByText('Tháng 10/2026')).closest('li')!;
    const pen = (await within(card).findByText('Bút bi xanh')).closest('li')!;
    expect(within(pen).getByText('Đã nhận đủ')).toBeInTheDocument();
    const note = within(card).getByText('Giấy note vàng').closest('li')!;
    expect(within(note).getByText('Nhận 2, chờ 2')).toBeInTheDocument();
    expect(within(note).getByText('Đã hủy 1')).toBeInTheDocument();
    const cover = within(card).getByText('Bìa còng').closest('li')!;
    expect(within(cover).getByText('Đã hủy 3 — Hết hàng')).toBeInTheDocument();
    // chỉ tháng gần nhất có dòng món
    expect(within(screen.getByText('Tháng 9/2026').closest('li')!).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('dòng ngoài danh mục: "Chờ Hành chính xem" và "Từ chối: lý do" hiện trên dòng, không có chip giao hàng', async () => {
    stub([{ items: [item({ period_ym: '2026-10', delivered_qty: 1, remaining_qty: 0 })], next_cursor: null }], [], {
      '2026-10': view({
        period_ym: '2026-10',
        is_open: false,
        lines: [
          lineView({ id: 'a', custom_name: 'Bìa còng', custom_unit: 'cai', review_status: 'pending' }),
          lineView({ id: 'b', custom_name: 'Bút lông', custom_unit: 'cai', review_status: 'rejected', review_note: 'Đã có trong kho' }),
        ],
      }),
    });
    renderApp(makeMe('member'), '/history');
    const pending = (await screen.findByText('Bìa còng')).closest('li')!;
    expect(within(pending).getByText('Chờ Hành chính xem')).toBeInTheDocument();
    const rejected = screen.getByText('Bút lông').closest('li')!;
    expect(within(rejected).getByText('Từ chối: Đã có trong kho')).toBeInTheDocument();
    expect(within(rejected).queryByText(/Chờ \d/)).toBeNull();
  });

  it('dòng hủy hết, không lý do: chip "Đã hủy 2"', async () => {
    stub([{ items: [item({ period_ym: '2026-10', delivered_qty: 1, remaining_qty: 0 })], next_cursor: null }], [], {
      '2026-10': view({ period_ym: '2026-10', is_open: false, lines: [lineView({ id: 'a', item_id: PEN.id, item: facts(PEN), qty: 2, cancelled_qty: 2 })] }),
    });
    renderApp(makeMe('member'), '/history');
    expect(await screen.findByText('Đã hủy 2')).toBeInTheDocument();
  });

  it('en: dòng món dùng name_en', async () => {
    await setLanguage('en');
    stub(
      [{ items: [item({ period_ym: '2026-10', delivered_qty: 4, remaining_qty: 0 })], next_cursor: null }],
      [],
      { '2026-10': view({ period_ym: '2026-10', is_open: false, lines: [lineView({ id: 'a', item_id: PEN.id, item: { ...facts(PEN), name_en: 'Blue pen' }, qty: 4, delivered_qty: 4 })] }) },
    );
    renderApp(makeMe('member'), '/history');
    expect(await screen.findByText('Blue pen')).toBeInTheDocument();
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
  });

  it('phiếu tháng gần nhất lỗi tải: báo lỗi ngay trong thẻ, có Thử lại, các tháng khác vẫn hiện', async () => {
    const fetchMock = stub([{ items: [item({ period_ym: '2026-10' }), item({ period_ym: '2026-09' })], next_cursor: null }]);
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
      if (url.startsWith('/api/me/issues')) return Promise.resolve(jsonResponse(200, { items: [], next_cursor: null }));
      if (url.startsWith('/api/me/request?ym=')) return Promise.resolve(jsonResponse(500, {}));
      return Promise.resolve(jsonResponse(200, { items: [item({ period_ym: '2026-10' }), item({ period_ym: '2026-09' })], next_cursor: null }));
    });
    renderApp(makeMe('member'), '/history');
    const card = (await screen.findByText('Tháng 10/2026')).closest('li')!;
    expect(await within(card).findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(screen.getByText('Tháng 9/2026')).toBeInTheDocument();
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
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Chưa có phiếu nào')).toBeNull();
  });

  describe('Nhận lẻ', () => {
    it('có 1 mục → hiện tiêu đề, món, số lượng, ngày giờ VN và lý do', async () => {
      stub([{ items: [item({})], next_cursor: null }], [{ items: [issue({})], next_cursor: null }]);
      renderApp(makeMe('member'), '/history');
      const section = (await screen.findByRole('heading', { level: 2, name: 'Nhận lẻ' })).closest('section')!;
      expect(within(section).getByText('Bút bi')).toBeInTheDocument();
      expect(within(section).getByText('2 cái')).toBeInTheDocument();
      expect(within(section).getByText('10:30 20/10/2026')).toBeInTheDocument();
      expect(within(section).getByText('Người mới vào')).toBeInTheDocument();
    });

    it('rỗng → không có mục Nhận lẻ', async () => {
      const fetchMock = stub([{ items: [item({})], next_cursor: null }], [{ items: [], next_cursor: null }]);
      renderApp(makeMe('member'), '/history');
      await screen.findByText('Tháng 10/2026');
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/me/issues?limit=10', expect.anything()));
      await new Promise((r) => setTimeout(r, 0));
      expect(screen.queryByRole('heading', { name: 'Nhận lẻ' })).toBeNull();
    });

    it('chưa có phiếu nào nhưng có nhận lẻ → vẫn hiện Nhận lẻ', async () => {
      stub([{ items: [], next_cursor: null }], [{ items: [issue({})], next_cursor: null }]);
      renderApp(makeMe('member'), '/history');
      expect(await screen.findByRole('heading', { name: 'Nhận lẻ' })).toBeInTheDocument();
      expect(screen.getByText('Chưa có phiếu nào')).toBeInTheDocument();
    });

    it('"Xem thêm" của Nhận lẻ chỉ có khi còn next_cursor; bấm tải trang kế theo cursor', async () => {
      const fetchMock = stub(
        [{ items: [item({})], next_cursor: null }],
        [
          { items: [issue({ id: 'm-1' })], next_cursor: 'ic1' },
          { items: [issue({ id: 'm-2', item_name: 'Kẹp giấy', item_name_en: null })], next_cursor: null },
        ],
      );
      renderApp(makeMe('member'), '/history');
      const section = (await screen.findByRole('heading', { name: 'Nhận lẻ' })).closest('section')!;
      await userEvent.click(within(section).getByRole('button', { name: 'Xem thêm' }));
      expect(await within(section).findByText('Kẹp giấy')).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith('/api/me/issues?limit=10&cursor=ic1', expect.anything());
      expect(within(section).queryByRole('button', { name: 'Xem thêm' })).toBeNull();
    });

    it('đủ một trang mà next_cursor rỗng → không có nút Xem thêm', async () => {
      const full = Array.from({ length: 10 }, (_, i) => issue({ id: `m-${i}` }));
      stub([{ items: [item({})], next_cursor: null }], [{ items: full, next_cursor: null }]);
      renderApp(makeMe('member'), '/history');
      const section = (await screen.findByRole('heading', { name: 'Nhận lẻ' })).closest('section')!;
      expect(within(section).getAllByText('Bút bi')).toHaveLength(10);
      expect(within(section).queryByRole('button', { name: 'Xem thêm' })).toBeNull();
    });

    it('me/issues lỗi 500: vẫn có tiêu đề Nhận lẻ + thông báo lỗi; Thử lại tải được', async () => {
      let calls = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
          if (url.startsWith('/api/me/issues')) {
            return Promise.resolve(calls++ === 0 ? jsonResponse(500, {}) : jsonResponse(200, { items: [issue({})], next_cursor: null }));
          }
          return Promise.resolve(jsonResponse(200, { items: [item({})], next_cursor: null }));
        }),
      );
      renderApp(makeMe('member'), '/history');
      const section = (await screen.findByRole('heading', { name: 'Nhận lẻ' })).closest('section')!;
      expect(await within(section).findByRole('alert')).toBeInTheDocument();
      await userEvent.click(within(section).getByRole('button', { name: 'Thử lại' }));
      expect(await within(section).findByText('Bút bi')).toBeInTheDocument();
      expect(within(section).queryByRole('alert')).toBeNull();
    });

    it('"Xem thêm" lỗi: giữ các mục đã có, báo lỗi ngay trong mục và thử lại được', async () => {
      let calls = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
          if (url.startsWith('/api/me/issues')) {
            const n = calls++;
            if (n === 0) return Promise.resolve(jsonResponse(200, { items: [issue({})], next_cursor: 'ic1' }));
            if (n === 1) return Promise.resolve(jsonResponse(500, {}));
            return Promise.resolve(jsonResponse(200, { items: [issue({ id: 'm-2', item_name: 'Kẹp giấy', item_name_en: null })], next_cursor: null }));
          }
          return Promise.resolve(jsonResponse(200, { items: [item({})], next_cursor: null }));
        }),
      );
      renderApp(makeMe('member'), '/history');
      const section = (await screen.findByRole('heading', { name: 'Nhận lẻ' })).closest('section')!;
      await userEvent.click(await within(section).findByRole('button', { name: 'Xem thêm' }));
      expect(await within(section).findByRole('alert')).toBeInTheDocument();
      expect(within(section).getByText('Bút bi')).toBeInTheDocument();
      await userEvent.click(within(section).getByRole('button', { name: 'Thử lại' }));
      expect(await within(section).findByText('Kẹp giấy')).toBeInTheDocument();
      expect(within(section).queryByRole('alert')).toBeNull();
    });
  });
});
