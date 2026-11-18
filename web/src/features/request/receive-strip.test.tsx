import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { mockViewport } from '@/test/viewport';
import type { CurrentPeriod } from './request.api';
import { PERIOD, view, stubRequestApi } from '@/test/request-api-stub';

afterEach(() => vi.unstubAllGlobals());

const L = (id: string, name: string, over = {}) => lineView({ id, custom_name: name, custom_unit: 'cay', qty: 1, ...over });
const PREV = view({
  id: 'r-0',
  period_ym: '2026-10',
  is_open: false,
  // updated_at đổi theo giao hàng/điều chỉnh nên không phải "lưu lúc"
  updated_at: '2026-10-09T03:00:00.000Z',
  saved_at: '2026-10-07T14:38:00.000Z',
  lines: [L('1', 'Bút bảng', { delivered_qty: 1 }), L('2', 'Bút bi', { delivered_qty: 1 }), L('3', 'Bút dạ'), L('4', 'Bút kim'), L('5', 'Bút chì')],
  removed_lines: [{ name: 'Bút ghi đĩa', name_en: null, unit: 'cay', before: 1, reason_code: 'adm_out_of_stock', reason_note: null, at: '2026-10-08T01:00:00Z' }],
});
const DELIVERING = { ...PERIOD, previous: { ym: '2026-10', delivering: true } };

async function open(period: CurrentPeriod = DELIVERING, width = 1280) {
  mockViewport(width);
  stubRequestApi({ period, others: { '2026-10': PREV } });
  renderApp(makeMe('member'), '/');
}

const ALL_BUT_ONE = { ...PREV, lines: PREV.lines.map((l, i) => (i < 4 ? { ...l, delivered_qty: 1 } : l)) };
const ALL_DONE = { ...PREV, lines: PREV.lines.map((l) => ({ ...l, delivered_qty: 1 })) };

describe('ReceiveStrip — dải phiếu đang giao', () => {
  it('một cách đếm: "Phiếu tháng 10 · còn chờ 3 món" + "Xem"; không còn "đã chốt · đã nhận 2/5"', async () => {
    await open();
    const head = await screen.findByText('Phiếu tháng 10');
    expect(head.tagName).toBe('B');
    expect(head.parentElement).toHaveTextContent('Phiếu tháng 10 · còn chờ 3 món');
    expect(screen.queryByText(/đã chốt/)).toBeNull();
    expect(screen.queryByText(/đã nhận 2\/5/)).toBeNull();
  });

  it('biên còn chờ: 1 món → "còn chờ 1 món"; 0 món → "đã nhận đủ"', async () => {
    mockViewport(1280);
    stubRequestApi({ period: DELIVERING, others: { '2026-10': ALL_BUT_ONE } });
    const first = renderApp(makeMe('member'), '/');
    expect((await screen.findByText('Phiếu tháng 10')).parentElement).toHaveTextContent('Phiếu tháng 10 · còn chờ 1 món');
    first.unmount();
    stubRequestApi({ period: DELIVERING, others: { '2026-10': ALL_DONE } });
    renderApp(makeMe('member'), '/');
    expect((await screen.findByText('Phiếu tháng 10')).parentElement).toHaveTextContent('Phiếu tháng 10 · đã nhận đủ');
    expect(screen.queryByText(/còn chờ 0/)).toBeNull();
  });

  it('"Xem" là liên kết thẳng tới Lịch sử /history/2026-10, không mở hộp "Phiếu tháng 10"', async () => {
    await open();
    const link = await screen.findByRole('link', { name: 'Xem' });
    expect(link).toHaveAttribute('href', '/history/2026-10');
    expect(screen.queryByRole('button', { name: 'Xem' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('kỳ trước không còn đang giao → không có dải', async () => {
    await open({ ...PERIOD, previous: { ym: '2026-10', delivering: false } });
    await screen.findByRole('region', { name: 'Danh mục món' });
    expect(screen.queryByRole('link', { name: 'Xem' })).toBeNull();
    expect(screen.queryByText(/đang giao/)).toBeNull();
  });

  it('còn nợ tháng 9 → dải thêm "· Tháng 9 còn chờ 2 món" là link /history/2026-09', async () => {
    await open({ ...DELIVERING, owed: [{ ym: '2026-09', items: 2, units: 3, lines: [] }] });
    const link = await screen.findByRole('link', { name: 'Tháng 9 còn chờ 2 món' });
    expect(link).toHaveAttribute('href', '/history/2026-09');
    expect(await screen.findAllByText('Phiếu tháng 10')).toHaveLength(1);
  });

  it('chỉ có nợ tháng cũ (kỳ trước đã xong) → dải chỉ gồm liên kết, không có "Xem"', async () => {
    await open({ ...PERIOD, owed: [{ ym: '2026-09', items: 1, units: 1, lines: [] }] });
    expect(await screen.findByRole('link', { name: 'Tháng 9 còn chờ 1 món' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Xem' })).toBeNull();
  });

  it('390: dải có "Xem" thao tác được, thanh dưới giữ nguyên', async () => {
    await open(DELIVERING, 390);
    expect(await screen.findByRole('link', { name: 'Xem' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Điều hướng chính' })).toBeInTheDocument();
  });
});
