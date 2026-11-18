import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { PERIOD, PEN, facts, view } from '@/test/request-api-stub';
import { lineView } from '@/test/fixtures-request';
import { historyItem as item, issue, stubHistory as stub } from '@/test/history-stub';
import { setLanguage } from '@/lib/i18n';
import { mockViewport } from '@/test/viewport';
import { deliveryState } from './history.api';

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

const L = (id: string, name: string, over: Partial<ReturnType<typeof lineView>> = {}) => lineView({ id, custom_name: name, custom_unit: 'cay', qty: 1, ...over });
const NOV = view({
  period_ym: '2026-11',
  is_open: false,
  updated_at: '2026-11-07T14:38:00.000Z',
  department: 'Phòng Test',
  lines: [
    L('1', 'Bút bảng', { delivered_qty: 1, last_delivered_at: '2026-11-08T02:10:00.000Z' }),
    L('2', 'Bút bi', { delivered_qty: 1, last_delivered_at: '2026-11-08T02:10:00.000Z' }),
    L('3', 'Bút dạ'),
    L('4', 'Bút kim'),
    L('5', 'Bút chì'),
  ],
  removed_lines: [{ name: 'Bút ghi đĩa', name_en: null, unit: 'cay', before: 1, reason_code: 'adm_out_of_stock', reason_note: null, at: '2026-11-08T01:30:00.000Z' }],
});
const PERIOD_DEC = { ...PERIOD, ym: '2026-12' };

describe('HistoryPage — master–detail', () => {
  it('1280 /history: trái nhóm "2026", "2025"; mỗi mục "Tháng 11" + "6 món · 6 đơn vị" + chip; phải là phiếu tháng mới nhất đã khóa', async () => {
    stub(
      [
        {
          items: [
            item({ period_ym: '2026-12', line_count: 2, total_qty: 3, remaining_qty: 3 }),
            item({ period_ym: '2026-11', line_count: 6, total_qty: 6, delivered_qty: 3, remaining_qty: 3, owed_line_count: 3 }),
            item({ period_ym: '2026-10', delivered_qty: 9, remaining_qty: 0 }),
            item({ period_ym: '2025-12', delivered_qty: 12, remaining_qty: 0 }),
          ],
          next_cursor: null,
        },
      ],
      [],
      { '2026-11': NOV },
      PERIOD_DEC,
    );
    renderApp(makeMe('member'), '/history');
    const nav = await screen.findByRole('navigation', { name: 'Lịch sử' });
    expect(within(nav).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['2026', '2025']);
    const nov = within(nav).getByText('Tháng 11').closest('a')!;
    expect(within(nov).getByText('6 món · 6 đơn vị')).toBeInTheDocument();
    expect(within(nov).getByText('Còn chờ 3 món')).toBeInTheDocument();
    expect(nov).toHaveAttribute('aria-current', 'page');
    expect(nov).toHaveAttribute('href', '/history/2026-11');
    expect(await screen.findByRole('heading', { level: 2, name: 'Phiếu tháng 11/2026' })).toBeInTheDocument();
  });

  it('kỳ đang mở trong danh sách → chip "Đang mở", bấm về trang Đăng ký /', async () => {
    stub([{ items: [item({ period_ym: '2026-11', line_count: 2, total_qty: 3, remaining_qty: 3 }), item({ period_ym: '2026-10' })], next_cursor: null }]);
    renderApp(makeMe('member'), '/history');
    const open = (await screen.findByText('Tháng 11')).closest('a')!;
    expect(open).toHaveAttribute('href', '/');
    expect(within(open).getByText('Đang mở')).toBeInTheDocument();
    expect(screen.getByText('Tháng 10').closest('a')).toHaveAttribute('href', '/history/2026-10');
  });

  it('liệt kê: chip giao, món ngoài DM, không chèn tháng trống "Không đăng ký"/"Không có phiếu"', async () => {
    stub([
      {
        items: [
          // line_count đếm cả 4 dòng ngoài danh mục; số món chỉ còn 3 món trong danh mục
          item({ period_ym: '2026-10', line_count: 7, delivered_qty: 6, remaining_qty: 4, owed_line_count: 2, custom: { pending: 1, accepted: 0, converted: 2, rejected: 1 } }),
          item({ period_ym: '2026-09', delivered_qty: 10, remaining_qty: 0 }),
          item({ period_ym: '2026-07', owed_line_count: 1 }),
        ],
        next_cursor: null,
      },
    ]);
    renderApp(makeMe('member'), '/history');
    const oct = (await screen.findByText('Tháng 10')).closest('a')!;
    expect(within(oct).getByText('3 món · 10 đơn vị')).toBeInTheDocument();
    expect(within(oct).getByText('Còn chờ 2 món')).toBeInTheDocument();
    expect(within(oct).getByText(/1 sản phẩm ngoài danh mục, chờ phê duyệt · 2 món đã thêm vào danh mục · 1 món bị từ chối/)).toBeInTheDocument();
    expect(within(screen.getByText('Tháng 9').closest('a')!).getByText('Đã nhận đủ')).toBeInTheDocument();
    expect(screen.queryByText('Tháng 8')).toBeNull();
    expect(screen.queryByText(/Không đăng ký/)).toBeNull();
  });

  it('phiếu Adm D&E đã bỏ hết (removed_all) → chip "Adm D&E đã bỏ toàn bộ"', async () => {
    stub([{ items: [item({ period_ym: '2026-10', line_count: 0, total_qty: 0, delivered_qty: 0, remaining_qty: 0, removed_all: true })], next_cursor: null }]);
    renderApp(makeMe('member'), '/history');
    const oct = (await screen.findByText('Tháng 10')).closest('a')!;
    expect(within(oct).getByText('Adm D&E đã bỏ toàn bộ')).toBeInTheDocument();
  });

  it('"Xem thêm" tải trang kế theo cursor', async () => {
    const fetchMock = stub([
      { items: [item({ period_ym: '2026-10' })], next_cursor: 'c1' },
      { items: [item({ period_ym: '2026-09' })], next_cursor: null },
    ]);
    renderApp(makeMe('member'), '/history');
    await userEvent.click(await screen.findByRole('button', { name: 'Xem thêm' }));
    expect(await screen.findByText('Tháng 9')).toBeInTheDocument();
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

  it('390 /history: chỉ danh sách; bấm Tháng 10 → /history/2026-10 chỉ chi tiết + "← Lịch sử"; quay lại vẫn đủ các tháng đã tải', async () => {
    mockViewport(390);
    stub(
      [{ items: [item({ period_ym: '2026-10', delivered_qty: 1, remaining_qty: 1 }), item({ period_ym: '2026-09' })], next_cursor: null }],
      [],
      { '2026-10': view({ period_ym: '2026-10', is_open: false, lines: [L('1', 'Bút bảng', { delivered_qty: 1 })] }) },
    );
    renderApp(makeMe('member'), '/history');
    expect(await screen.findByText('Tháng 10')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Phiếu tháng 10/2026' })).toBeNull();
    await userEvent.click(screen.getByText('Tháng 10').closest('a')!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Phiếu tháng 10/2026' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Lịch sử' })).toBeNull();
    await userEvent.click(within(screen.getByRole('main')).getByRole('link', { name: /Lịch sử/ }));
    expect(await screen.findByText('Tháng 9')).toBeInTheDocument();
    expect(screen.getByText('Tháng 10')).toBeInTheDocument();
  });

  it('390 /history: không tô sẵn tháng mới nhất (không aria-current), mỗi tháng có dấu › ẩn với trình đọc', async () => {
    mockViewport(390);
    stub([{ items: [item({ period_ym: '2026-10', delivered_qty: 1, remaining_qty: 1 }), item({ period_ym: '2026-09' })], next_cursor: null }]);
    renderApp(makeMe('member'), '/history');
    const oct = (await screen.findByText('Tháng 10')).closest('a')!;
    expect(oct).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Tháng 9').closest('a')).not.toHaveAttribute('aria-current');
    expect(oct.querySelector('svg.hs-m-chev')).toHaveAttribute('aria-hidden', 'true');
  });

  it('1280: dòng tháng không có mũi tên › (chi tiết đã hiện bên phải); 390 vẫn có', async () => {
    mockViewport(1280);
    stub([{ items: [item({ period_ym: '2026-10', delivered_qty: 1, remaining_qty: 1 })], next_cursor: null }]);
    renderApp(makeMe('member'), '/history');
    const oct = (await screen.findByText('Tháng 10')).closest('a')!;
    expect(oct.querySelector('svg')).toBeNull();
  });

  it('1280: chỉ có phiếu kỳ đang mở (chưa chốt) → khung phải báo "Chưa có phiếu nào đã chốt."', async () => {
    stub([{ items: [item({ period_ym: '2026-12', line_count: 2, total_qty: 3, remaining_qty: 3 })], next_cursor: null }], [], {}, PERIOD_DEC);
    renderApp(makeMe('member'), '/history');
    expect(await screen.findByText('Chưa có phiếu nào đã chốt.')).toBeInTheDocument();
    expect(screen.getByText('Phiếu sẽ hiện ở đây sau ngày khóa đăng ký.')).toBeInTheDocument();
  });

  it('số món, đơn vị và chip giao theo khối catalog của API (món ngoài DM đã duyệt không cộng vào)', async () => {
    stub([
      {
        items: [
          item({
            period_ym: '2026-10',
            line_count: 4,
            total_qty: 9,
            delivered_qty: 0,
            remaining_qty: 9,
            owed_line_count: 3,
            custom: { pending: 0, accepted: 2, converted: 0, rejected: 0 },
            catalog: { line_count: 2, qty: 4, delivered_qty: 4, remaining_qty: 0, owed_line_count: 0 },
          }),
        ],
        next_cursor: null,
      },
    ]);
    renderApp(makeMe('member'), '/history');
    const oct = (await screen.findByText('Tháng 10')).closest('a')!;
    expect(within(oct).getByText('2 món · 4 đơn vị')).toBeInTheDocument();
    expect(within(oct).getByText('Đã nhận đủ')).toBeInTheDocument();
    expect(within(oct).getByText('2 món đã chấp nhận')).toBeInTheDocument();
  });

  it('1280: trang đầu chưa có tháng đã chốt nhưng còn trang sau → lời nhắc chọn tháng, không khẳng định "chưa có phiếu đã chốt"', async () => {
    stub(
      [
        { items: [item({ period_ym: '2026-12', line_count: 2, total_qty: 3, remaining_qty: 3 })], next_cursor: 'c1' },
        { items: [item({ period_ym: '2026-11' })], next_cursor: null },
      ],
      [],
      {},
      PERIOD_DEC,
    );
    renderApp(makeMe('member'), '/history');
    expect(await screen.findByText('Chọn một tháng ở danh sách bên trái để xem phiếu.')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có phiếu nào đã chốt.')).toBeNull();
  });

  it('en: dòng món dùng name_en', async () => {
    await setLanguage('en');
    stub([{ items: [item({ period_ym: '2026-10', delivered_qty: 4, remaining_qty: 0 })], next_cursor: null }], [], {
      '2026-10': view({ period_ym: '2026-10', is_open: false, lines: [lineView({ id: 'a', item_id: PEN.id, item: { ...facts(PEN), name_en: 'Blue pen' }, qty: 4, delivered_qty: 4 })] }),
    });
    renderApp(makeMe('member'), '/history');
    expect(await screen.findByText('Blue pen')).toBeInTheDocument();
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
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
      await screen.findByText('Tháng 10');
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
          if (url.startsWith('/api/me/request?ym=')) return Promise.resolve(jsonResponse(404, { code: 'REQUEST_NOT_FOUND' }));
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
          if (url.startsWith('/api/me/request?ym=')) return Promise.resolve(jsonResponse(404, { code: 'REQUEST_NOT_FOUND' }));
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
