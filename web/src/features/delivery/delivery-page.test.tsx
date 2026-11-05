import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import type { PersonRow } from '@/features/summary/summary.api';
import { PEN_LINE, NOTE_LINE, deliveryRequest, personRow } from './delivery-fixtures';
import { stubDelivery, urlsOf, type DeliveryStub } from './delivery-test-stub';

const LAN = personRow({ request_id: 'r-2', user_sub: 'u-lan', full_name: 'Võ Thị Lan', department: null, total_qty: 4, delivered_qty: 0 });
const ROWS: PersonRow[] = [personRow(), LAN];
const DONE_VIEW = deliveryRequest({ lines: [{ ...PEN_LINE, delivered_qty: 5 }, { ...NOTE_LINE, delivered_qty: 3 }] });
const LAN_VIEW = deliveryRequest({ id: 'r-2', full_name: 'Võ Thị Lan', department: null, lines: [] });

const search = () => screen.getByTestId('location-search').textContent ?? '';
const rowButton = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const list = () => screen.getByRole('list', { name: 'Danh sách phiếu' });

function open(path = '/admin/delivery/classic', opts: { reducedMotion?: boolean } = {}) {
  mockViewport(1280, opts);
  renderApp(makeMe('admin'), path);
}

// Server bỏ r-1 khỏi "chưa giao đủ" ngay sau khi Giao tất cả thành công
function completingStub(over: DeliveryStub = {}) {
  let delivered = false;
  return stubDelivery({
    rows: () => (delivered ? [LAN] : ROWS),
    views: [deliveryRequest({ lines: [PEN_LINE, NOTE_LINE] }), DONE_VIEW],
    others: { 'r-2': LAN_VIEW },
    deliverAll: () => {
      delivered = true;
      return jsonResponse(200, { delivered: [{ line_id: 'l-pen', qty: 2 }, { line_id: 'l-note', qty: 3 }], failed: [] });
    },
    ...over,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('DeliveryPage — đầu trang, tháng, dải trạng thái', () => {
  it('đúng một h1 "Giao hàng", mô tả; mặc định kỳ khóa gần nhất (10/2026) badge "Đã khóa 11/10", › vô hiệu; chỉ gọi lọc chưa giao đủ', async () => {
    const f = stubDelivery({ rows: ROWS, others: { 'r-2': LAN_VIEW } });
    open();
    expect(await screen.findByText('Tháng 10/2026')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Giao hàng');
    expect(screen.getByText('Giao theo phiếu sau khi khóa kỳ — tồn kho trừ ngay khi bấm Giao.')).toBeInTheDocument();
    expect(await screen.findByText('Đã khóa 11/10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
    await screen.findByText('Phiếu tháng 10 · Chưa giao đủ (2)');
    expect(urlsOf(f).some((u) => u.startsWith('/api/admin/periods/2026-10/requests?by=person&filter=pending_delivery'))).toBe(true);
    expect(urlsOf(f).some((u) => u.includes('filter=all'))).toBe(false);
  });

  it('dải không lặp trạng thái kỳ (chỉ bộ chọn kỳ nói "Đã khóa"): "16/18 phiếu đã giao đủ", "2 món thiếu kho: …" + liên kết Kho', async () => {
    stubDelivery({
      rows: ROWS,
      others: { 'r-2': LAN_VIEW },
      report: {
        byItem: [
          { key: 'a', item_id: 'i-a', name: 'Giấy A4', name_en: null, unit: 'ram', requested: 9, backlog_prev: 0, stock: 2, need: 7 },
          { key: 'b', item_id: 'i-b', name: 'Bìa lá', name_en: null, unit: 'bich', requested: 3, backlog_prev: 0, stock: 1, need: 2 },
          { key: 'c', item_id: 'i-c', name: 'Bút chì', name_en: null, unit: 'cay', requested: 3, backlog_prev: 0, stock: 9, need: 0 },
        ],
      },
    });
    open();
    const strip = await screen.findByRole('region', { name: 'Trạng thái giao tháng 10' });
    expect(await within(strip).findByText('16/18 phiếu đã giao đủ')).toBeInTheDocument();
    expect(strip).not.toHaveTextContent(/khóa/i);
    expect(screen.getAllByText(/đã khóa/i)).toHaveLength(1);
    expect(await within(strip).findByText('2 món thiếu kho: Giấy A4, Bìa lá')).toBeInTheDocument();
    expect(within(strip).getByRole('link', { name: 'Nhập mua ở Kho' })).toHaveAttribute('href', '/admin/stock');
  });

  it('?ym=2026-11 (kỳ đang mở) → kẹp về 2026-10 bằng replace, không gọi danh sách/báo cáo kỳ 2026-11', async () => {
    const f = stubDelivery();
    open('/admin/delivery/classic?ym=2026-11');
    expect(await screen.findByText('Tháng 10/2026')).toBeInTheDocument();
    await waitFor(() => expect(search()).toContain('ym=2026-10'));
    await screen.findByText('Phiếu tháng 10 · Chưa giao đủ (1)');
    expect(urlsOf(f).some((u) => u.startsWith('/api/admin/periods/2026-11/requests') || u.startsWith('/api/admin/reports/2026-11'))).toBe(false);
  });

  it('?ym=2026-09 (kỳ khóa cũ hơn) → giữ 2026-09, gọi danh sách kỳ đó', async () => {
    const f = stubDelivery();
    open('/admin/delivery/classic?ym=2026-09');
    expect(await screen.findByText('Tháng 9/2026')).toBeInTheDocument();
    await waitFor(() => expect(urlsOf(f).some((u) => u.startsWith('/api/admin/periods/2026-09/requests?by=person'))).toBe(true));
    expect(search()).toContain('ym=2026-09');
  });

  it('danh sách lỗi tải → "Không tải được dữ liệu — thử lại." + nút Thử lại', async () => {
    const base = stubDelivery();
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
      url.includes('/requests?by=person') ? Promise.resolve(jsonResponse(500, { code: 'INTERNAL' })) : base(url, init),
    );
    open();
    expect(await screen.findByText('Không tải được dữ liệu — thử lại.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });
});

describe('DeliveryPage — danh sách phiếu (trái)', () => {
  it('chọn sẵn phiếu đầu (aria-pressed, ?request=r-1) và mở chi tiết; bấm phiếu khác → chọn phiếu đó', async () => {
    stubDelivery({ rows: ROWS, others: { 'r-2': LAN_VIEW } });
    open();
    await screen.findByRole('table', { name: 'Các dòng của phiếu Phạm Văn Đức' });
    expect(rowButton('Phạm Văn Đức')).toHaveAttribute('aria-pressed', 'true');
    expect(within(rowButton('Phạm Văn Đức')).getByRole('progressbar', { name: 'đã giao 3/8 đơn vị' })).toBeInTheDocument();
    expect(within(rowButton('Võ Thị Lan')).getByText('Chưa có phòng ban')).toBeInTheDocument();
    await waitFor(() => expect(search()).toContain('request=r-1'));
    await userEvent.click(rowButton('Võ Thị Lan'));
    expect(rowButton('Võ Thị Lan')).toHaveAttribute('aria-pressed', 'true');
    expect(rowButton('Phạm Văn Đức')).toHaveAttribute('aria-pressed', 'false');
    expect(search()).toContain('request=r-2');
    expect(await screen.findByRole('table', { name: 'Các dòng của phiếu Võ Thị Lan' })).toBeInTheDocument();
  });

  it('?request=r-2 mở đúng phiếu đó', async () => {
    stubDelivery({ rows: ROWS, others: { 'r-2': LAN_VIEW } });
    open('/admin/delivery/classic?request=r-2');
    expect(await screen.findByRole('table', { name: 'Các dòng của phiếu Võ Thị Lan' })).toBeInTheDocument();
    expect(rowButton('Võ Thị Lan')).toHaveAttribute('aria-pressed', 'true');
  });

  it('bật "Hiện cả phiếu đã giao đủ" → filter=all, ?all=1, tiêu đề "Tất cả (3)"', async () => {
    const done = personRow({ request_id: 'r-3', full_name: 'Lê Hoà', delivered_qty: 8 });
    const f = stubDelivery({ rows: ROWS, allRows: [...ROWS, done], others: { 'r-2': LAN_VIEW } });
    open();
    await screen.findByText('Phiếu tháng 10 · Chưa giao đủ (2)');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Hiện cả phiếu đã giao đủ' }));
    expect(await screen.findByText('Phiếu tháng 10 · Tất cả (3)')).toBeInTheDocument();
    expect(urlsOf(f).some((u) => u.includes('filter=all'))).toBe(true);
    expect(search()).toContain('all=1');
  });

  it('không còn phiếu cần giao → "Không còn phiếu cần giao", câu nhắc tháng 10, liên kết "Xem Còn nợ"', async () => {
    stubDelivery({ rows: [] });
    open();
    expect(await screen.findByText('Không còn phiếu cần giao')).toBeInTheDocument();
    expect(screen.getByText('Mọi phiếu tháng 10 đã giao đủ. Phần thiếu kho nằm ở Còn nợ.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem Còn nợ' })).toHaveAttribute('href', '/admin/backlog');
  });
});

describe('DeliveryPage — phiếu vừa giao đủ rời bộ lọc', () => {
  it('giảm chuyển động: Giao tất cả đủ → toast "Đã giao đủ phiếu của Phạm Văn Đức", phiếu rời danh sách ngay, chọn sang Võ Thị Lan', async () => {
    completingStub();
    open('/admin/delivery/classic', { reducedMotion: true });
    await screen.findByRole('table', { name: 'Các dòng của phiếu Phạm Văn Đức' });
    await userEvent.click(screen.getByRole('button', { name: 'Giao tất cả' }));
    expect(await screen.findByText('Đã giao đủ phiếu của Phạm Văn Đức')).toBeInTheDocument();
    await waitFor(() => expect(within(list()).queryByRole('button', { name: /^Phạm Văn Đức/ })).toBeNull());
    expect(rowButton('Võ Thị Lan')).toHaveAttribute('aria-pressed', 'true');
    expect(search()).toContain('request=r-2');
  });

  it('bình thường: còn trong danh sách ở 599 ms (vòng "Đã giao đủ"), rời ở 600 ms rồi chọn phiếu kế', async () => {
    completingStub();
    open();
    await screen.findByRole('table', { name: 'Các dòng của phiếu Phạm Văn Đức' });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    act(() => screen.getByRole('button', { name: 'Giao tất cả' }).click());
    for (let i = 0; i < 50 && !within(list()).queryByText('Đã giao đủ'); i++) {
      await act(() => vi.advanceTimersByTimeAsync(0));
    }
    expect(within(rowButton('Phạm Văn Đức')).getByText('Đã giao đủ')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(599));
    expect(within(list()).getByRole('button', { name: /^Phạm Văn Đức/ })).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(within(list()).queryByRole('button', { name: /^Phạm Văn Đức/ })).toBeNull();
    expect(rowButton('Võ Thị Lan')).toHaveAttribute('aria-pressed', 'true');
  });

  it('đang xem "Tất cả": phiếu giao đủ vẫn ở danh sách và vẫn được chọn', async () => {
    completingStub({ allRows: ROWS });
    open('/admin/delivery/classic?all=1', { reducedMotion: true });
    await screen.findByRole('table', { name: 'Các dòng của phiếu Phạm Văn Đức' });
    await userEvent.click(screen.getByRole('button', { name: 'Giao tất cả' }));
    await screen.findByText('Đã giao đủ phiếu của Phạm Văn Đức');
    expect(rowButton('Phạm Văn Đức')).toHaveAttribute('aria-pressed', 'true');
  });
});
