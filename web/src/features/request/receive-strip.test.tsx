import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, within } from '@/test/test-utils';
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

describe('ReceiveStrip — dải phiếu đang giao', () => {
  it('đúng một dải "Phiếu tháng 10 đã chốt · đã nhận 2/5 món" + nút Xem; không còn hai băng cũ', async () => {
    await open();
    const strip = await screen.findByText('Phiếu tháng 10 đã chốt');
    expect(strip.tagName).toBe('B');
    expect(strip.parentElement).toHaveTextContent('Phiếu tháng 10 đã chốt · đã nhận 2/5 món');
    expect(screen.queryByText(/Bạn còn chờ nhận/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Xem' })).toBeInTheDocument();
  });

  it('Xem → popup bảng Món · ĐVT · Đăng ký · Được giao · Đã nhận · Tình trạng; "Xem lịch sử các tháng" tới /history/2026-10', async () => {
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'Xem' }));
    const dlg = await screen.findByRole('dialog', { name: 'Phiếu tháng 10' });
    expect(within(dlg).getByText('Đang giao · đã nhận 2/5 món · lưu lúc 07/10 21:38')).toBeInTheDocument();
    for (const h of ['Món', 'ĐVT', 'Đăng ký', 'Được giao', 'Đã nhận', 'Tình trạng']) expect(within(dlg).getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(within(dlg).getAllByText('Đã nhận 1/1')).toHaveLength(2);
    expect(within(dlg).getAllByText('Chờ 1')).toHaveLength(3);
    expect(within(dlg).getByText('Không giao')).toBeInTheDocument();
    expect(within(dlg).getByText('Adm D&E bỏ món: Không có hàng')).toBeInTheDocument();
    expect(within(dlg).getByText('Món còn chờ sẽ giao khi hàng về, không cần đăng ký lại.')).toBeInTheDocument();
    expect(within(dlg).getByRole('link', { name: 'Xem lịch sử các tháng' })).toHaveAttribute('href', '/history/2026-10');
  });

  it('kỳ trước không còn đang giao → không có dải', async () => {
    await open({ ...PERIOD, previous: { ym: '2026-10', delivering: false } });
    await screen.findByRole('region', { name: 'Danh mục món' });
    expect(screen.queryByRole('button', { name: 'Xem' })).toBeNull();
    expect(screen.queryByText(/đang giao/)).toBeNull();
  });

  it('còn nợ tháng 9 → dải thêm "· Tháng 9 còn chờ 2 món" là link /history/2026-09', async () => {
    await open({ ...DELIVERING, owed: [{ ym: '2026-09', items: 2, units: 3, lines: [] }] });
    const link = await screen.findByRole('link', { name: 'Tháng 9 còn chờ 2 món' });
    expect(link).toHaveAttribute('href', '/history/2026-09');
    expect(await screen.findAllByText('Phiếu tháng 10 đã chốt')).toHaveLength(1);
  });

  it('chỉ có nợ tháng cũ (kỳ trước đã xong) → dải chỉ gồm liên kết, không có nút Xem', async () => {
    await open({ ...PERIOD, owed: [{ ym: '2026-09', items: 1, units: 1, lines: [] }] });
    expect(await screen.findByRole('link', { name: 'Tháng 9 còn chờ 1 món' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xem' })).toBeNull();
  });

  it('390: dải có nút Xem thao tác được, thanh dưới giữ nguyên', async () => {
    await open(DELIVERING, 390);
    expect(await screen.findByRole('button', { name: 'Xem' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Điều hướng chính' })).toBeInTheDocument();
  });
});
