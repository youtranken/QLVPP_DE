import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { PEN, NOTE, facts, stubRequestApi, view } from '@/test/request-api-stub';

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
    expect(bars[0]).toHaveAttribute('aria-valuemax', '10');
    expect(within(bars[0]).getByText('6/10')).toBeInTheDocument();
    expect(bars[1]).toHaveAttribute('aria-valuenow', '4');
    expect(screen.getAllByText(/đã hủy/)).toHaveLength(1);
    expect(screen.getByText('đã hủy 2')).toBeInTheDocument();
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
});
