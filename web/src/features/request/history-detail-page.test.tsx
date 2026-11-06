import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { PERIOD, PEN, NOTE, facts, stubRequestApi, view } from '@/test/request-api-stub';

afterEach(() => vi.unstubAllGlobals());

const past = (lines: ReturnType<typeof lineView>[]) =>
  stubRequestApi({ others: { '2026-10': view({ period_ym: '2026-10', is_open: false, lines }) } });

describe('HistoryDetailPage', () => {
  it('mỗi dòng có thanh tiến độ delivered/qty và "đã hủy n"', async () => {
    past([
      lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 10, delivered_qty: 6, cancelled_qty: 2 }),
      lineView({ id: 'l-2', item_id: NOTE.id, item: facts(NOTE), qty: 4, delivered_qty: 4 }),
    ]);
    renderApp(makeMe('member'), '/history/2026-10');
    expect(await screen.findByRole('heading', { level: 1, name: 'Phiếu tháng 10/2026' })).toBeInTheDocument();
    const bars = await screen.findAllByRole('progressbar');
    expect(bars[0]).toHaveAttribute('aria-valuenow', '6');
    expect(bars[0]).toHaveAttribute('aria-valuemax', '8');
    expect(within(bars[0]).getByText('6/8')).toBeInTheDocument();
    expect(bars[1]).toHaveAttribute('aria-valuenow', '4');
    expect(screen.getAllByText(/đã hủy/)).toHaveLength(1);
    expect(screen.getByText('đã hủy 2')).toBeInTheDocument();
    expect(screen.getByText('còn chờ 2')).toBeInTheDocument();
    expect(screen.getAllByText(/còn chờ/)).toHaveLength(1);
  });

  it('dòng ngoài DM: nhãn theo trạng thái, lý do từ chối hiển thị, không thanh tiến độ cho dòng chờ/từ chối', async () => {
    past([
      lineView({ id: 'a', custom_name: 'Bìa còng', custom_unit: 'cai', review_status: 'pending' }),
      lineView({ id: 'b', custom_name: 'Bút lông', custom_unit: 'cai', review_status: 'accepted', qty: 2, delivered_qty: 1 }),
      lineView({ id: 'c', custom_name: 'Giấy màu', custom_unit: 'ram', review_status: 'converted' }),
      lineView({ id: 'd', custom_name: 'Kéo', custom_unit: 'cai', review_status: 'rejected', review_note: 'Đã có trong kho' }),
    ]);
    renderApp(makeMe('member'), '/history/2026-10');
    expect(await screen.findByText('Chờ Hành chính xem')).toBeInTheDocument();
    expect(screen.getByText('Đã chấp nhận')).toBeInTheDocument();
    expect(screen.getByText('Đã thêm vào danh mục')).toBeInTheDocument();
    expect(screen.getByText('Từ chối: Đã có trong kho')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  });

  it('kỳ đang mở: chuyển về / (không có bản chỉ đọc)', async () => {
    past([]);
    renderApp(makeMe('member'), '/history/2026-11');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
  });

  it('không có phiếu kỳ đó: báo "Không có phiếu tháng này"', async () => {
    stubRequestApi();
    renderApp(makeMe('member'), '/history/2026-09');
    expect(await screen.findByText('Không có phiếu tháng này')).toBeInTheDocument();
  });

  it('kỳ sau kỳ đang mở: báo không có phiếu, không hiện lỗi "Thử lại"', async () => {
    stubRequestApi();
    renderApp(makeMe('member'), '/history/2026-12');
    expect(await screen.findByText('Không có phiếu tháng này')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('INVALID_PERIOD từ api coi như không có phiếu (không phải lỗi tải)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url === '/api/periods/current'
            ? jsonResponse(200, { ...PERIOD, ym: '2026-09' })
            : jsonResponse(400, { code: 'INVALID_PERIOD' }),
        ),
      ),
    );
    renderApp(makeMe('member'), '/history/2026-08');
    expect(await screen.findByText('Không có phiếu tháng này')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('dòng 5 giao 3 hủy 2: thanh trên 3 (aria-valuenow 3, max 3) và "đã hủy 2 — lý do"', async () => {
    past([lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 5, delivered_qty: 3, cancelled_qty: 2, cancel_note: 'Người đã nghỉ' })]);
    renderApp(makeMe('member'), '/history/2026-10');
    const bar = await screen.findByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '3');
    expect(within(bar).getByText('3/3')).toBeInTheDocument();
    expect(screen.getByText('đã hủy 2 — Người đã nghỉ')).toBeInTheDocument();
    expect(screen.queryByText(/còn chờ/)).toBeNull();
  });

  it('hủy hết 5: không progressbar, chỉ "Đã hủy 5 — lý do"', async () => {
    past([lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 5, cancelled_qty: 5, cancel_note: 'Hết hàng' })]);
    renderApp(makeMe('member'), '/history/2026-10');
    expect(await screen.findByText('Đã hủy 5 — Hết hàng')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('hủy qty−1: thanh trên 1; hủy 0: thanh trên qty', async () => {
    past([
      lineView({ id: 'a', item_id: PEN.id, item: facts(PEN), qty: 5, delivered_qty: 0, cancelled_qty: 4, cancel_note: 'x' }),
      lineView({ id: 'b', item_id: NOTE.id, item: facts(NOTE), qty: 5, delivered_qty: 2 }),
    ]);
    renderApp(makeMe('member'), '/history/2026-10');
    const bars = await screen.findAllByRole('progressbar');
    expect(bars[0]).toHaveAttribute('aria-valuemax', '1');
    expect(bars[0]).toHaveAttribute('aria-valuenow', '0');
    expect(bars[1]).toHaveAttribute('aria-valuemax', '5');
    expect(bars[1]).toHaveAttribute('aria-valuenow', '2');
  });

  it('lý do hủy rỗng/khoảng trắng → "đã hủy n" không có dấu gạch; hủy hết cũng vậy', async () => {
    past([
      lineView({ id: 'a', item_id: PEN.id, item: facts(PEN), qty: 5, delivered_qty: 1, cancelled_qty: 2, cancel_note: '  ' }),
      lineView({ id: 'b', item_id: NOTE.id, item: facts(NOTE), qty: 3, cancelled_qty: 3, cancel_note: null }),
    ]);
    renderApp(makeMe('member'), '/history/2026-10');
    expect(await screen.findByText('đã hủy 2')).toBeInTheDocument();
    expect(screen.getByText('Đã hủy 3')).toBeInTheDocument();
    expect(screen.queryByText(/—/)).toBeNull();
  });
});
