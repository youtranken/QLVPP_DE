import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import type { PersonRow } from '@/features/summary/summary.api';
import { PEN_LINE, NOTE_LINE, deliveryRequest, personRow } from './delivery-fixtures';
import { stubDelivery } from './delivery-test-stub';

const LAN = personRow({ request_id: 'r-2', user_sub: 'u-lan', full_name: 'Võ Thị Lan', department: null, total_qty: 4, delivered_qty: 0 });
const ROWS: PersonRow[] = [personRow(), LAN];
const LAN_VIEW = deliveryRequest({ id: 'r-2', full_name: 'Võ Thị Lan', department: null, lines: [] });
const DONE_VIEW = deliveryRequest({ lines: [{ ...PEN_LINE, delivered_qty: 5 }, { ...NOTE_LINE, delivered_qty: 3 }] });

const search = () => screen.getByTestId('location-search').textContent ?? '';
const list = () => screen.getByRole('list', { name: 'Danh sách phiếu' });
const DUC_ROW = 'Mở phiếu của Phạm Văn Đức, đã giao 3 trên 8 đơn vị';

function open(path = '/admin/delivery/classic') {
  mockViewport(390);
  renderApp(makeMe('admin'), path);
}

function completingStub(allRows?: PersonRow[]) {
  let delivered = false;
  return stubDelivery({
    allRows,
    rows: () => (delivered ? [LAN] : ROWS),
    views: [deliveryRequest({ lines: [PEN_LINE, NOTE_LINE] }), DONE_VIEW],
    others: { 'r-2': LAN_VIEW },
    deliverAll: () => {
      delivered = true;
      return jsonResponse(200, { delivered: [{ line_id: 'l-pen', qty: 2 }, { line_id: 'l-note', qty: 3 }], failed: [] });
    },
  });
}

async function completeOnDetail(path = '/admin/delivery/classic?request=r-1', allRows?: PersonRow[]) {
  completingStub(allRows);
  open(path);
  await screen.findByRole('table', { name: 'Các dòng của phiếu Phạm Văn Đức' });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  act(() => screen.getByRole('button', { name: 'Giao tất cả' }).click());
  for (let i = 0; i < 50 && !screen.queryByText('Đã giao đủ phiếu · Đã báo cho Phạm Văn Đức.'); i++) {
    await act(() => vi.advanceTimersByTimeAsync(0));
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Giao hàng 390 px — màn danh sách', () => {
  it('chỉ có danh sách: không tự chọn phiếu, không có màn chi tiết hay câu "Chọn một phiếu bên trái"', async () => {
    stubDelivery({ rows: ROWS, others: { 'r-2': LAN_VIEW } });
    open();
    expect(await screen.findByRole('button', { name: DUC_ROW })).toBeInTheDocument();
    expect(search()).not.toContain('request=');
    expect(screen.queryByRole('table', { name: /^Các dòng của phiếu/ })).toBeNull();
    expect(screen.queryByText('Chọn một phiếu bên trái để giao.')).toBeNull();
  });

  it('segmented "Chưa giao đủ (2)" / "Tất cả (18)"; chọn Tất cả → ?all=1', async () => {
    stubDelivery({ rows: ROWS, others: { 'r-2': LAN_VIEW } });
    open();
    const seg = await screen.findByRole('radiogroup', { name: 'Lọc phiếu' });
    expect(within(seg).getByRole('radio', { name: 'Chưa giao đủ, 2' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(await within(seg).findByRole('radio', { name: 'Tất cả, 18' }));
    await waitFor(() => expect(search()).toContain('all=1'));
    expect(screen.queryByRole('checkbox', { name: 'Hiện cả phiếu đã giao đủ' })).toBeNull();
  });

  it('dải: "16/18 phiếu đã giao đủ" (trạng thái kỳ chỉ ở bộ chọn kỳ), "2 món thiếu kho — phần thiếu còn ở Chưa nhận"', async () => {
    stubDelivery({
      rows: ROWS,
      others: { 'r-2': LAN_VIEW },
      report: {
        byItem: [
          { key: 'a', item_id: 'i-a', name: 'Giấy A4', name_en: null, unit: 'ram', requested: 9, backlog_prev: 0, stock: 2, need: 7 },
          { key: 'b', item_id: 'i-b', name: 'Bìa lá', name_en: null, unit: 'bich', requested: 3, backlog_prev: 0, stock: 1, need: 2 },
        ],
      },
    });
    open();
    const strip = await screen.findByRole('region', { name: 'Trạng thái giao tháng 10' });
    expect(await within(strip).findByText('16/18 phiếu đã giao đủ')).toBeInTheDocument();
    expect(strip).not.toHaveTextContent(/khóa/i);
    expect(await within(strip).findByText('2 món thiếu kho — phần thiếu còn ở Chưa nhận')).toBeInTheDocument();
  });

  it('chạm hàng "Mở phiếu của …" → ?request=r-1, màn chi tiết toàn màn (danh sách và dải ẩn)', async () => {
    stubDelivery({ rows: ROWS, others: { 'r-2': LAN_VIEW } });
    open('/admin/delivery/classic?all=1');
    await userEvent.click(await screen.findByRole('button', { name: DUC_ROW }));
    expect(search()).toContain('request=r-1');
    expect(search()).toContain('all=1');
    expect(await screen.findByRole('table', { name: 'Các dòng của phiếu Phạm Văn Đức' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Danh sách phiếu' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Trạng thái giao tháng 10' })).toBeNull();
  });
});

describe('Giao hàng 390 px — giao đủ tự về danh sách sau 1,4 s', () => {
  it('"Đã giao đủ phiếu · Đã báo cho Phạm Văn Đức." — 1399 ms còn ở chi tiết, 1400 ms về danh sách', async () => {
    await completeOnDetail();
    expect(screen.getByText('Đã giao đủ phiếu · Đã báo cho Phạm Văn Đức.')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1399));
    expect(search()).toContain('request=r-1');
    expect(screen.getByRole('table', { name: 'Các dòng của phiếu Phạm Văn Đức' })).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(search()).not.toContain('request=');
    expect(list()).toBeInTheDocument();
  });

  it('đã tự quay lại rồi mở phiếu khác trước 1,4 s → hẹn giờ cũ không kéo về danh sách', async () => {
    await completeOnDetail();
    act(() => within(screen.getAllByRole('banner')[0]).getByRole('button', { name: 'Quay lại danh sách phiếu' }).click());
    await act(() => vi.advanceTimersByTimeAsync(0));
    act(() => within(list()).getByRole('button', { name: /^Mở phiếu của Võ Thị Lan/ }).click());
    await act(() => vi.advanceTimersByTimeAsync(1400));
    expect(search()).toContain('request=r-2');
  });

  it('quay lại danh sách rồi mở lại đúng phiếu đó trước 1,4 s → hẹn giờ cũ đã hủy, vẫn ở chi tiết', async () => {
    await completeOnDetail('/admin/delivery/classic?all=1&request=r-1', ROWS);
    act(() => within(screen.getAllByRole('banner')[0]).getByRole('button', { name: 'Quay lại danh sách phiếu' }).click());
    await act(() => vi.advanceTimersByTimeAsync(0));
    act(() => within(list()).getByRole('button', { name: /^Mở phiếu của Phạm Văn Đức/ }).click());
    await act(() => vi.advanceTimersByTimeAsync(1400));
    expect(search()).toContain('request=r-1');
  });

  it('bảng phiếu dựng lại (đổi tháng đi rồi về) trước 1,4 s → hẹn giờ của bảng cũ bị hủy, mở lại đúng phiếu đó vẫn ở chi tiết', async () => {
    await completeOnDetail('/admin/delivery/classic?all=1&request=r-1', ROWS);
    act(() => screen.getByRole('button', { name: 'Tháng trước' }).click());
    await act(() => vi.advanceTimersByTimeAsync(0));
    act(() => screen.getByRole('button', { name: 'Tháng sau' }).click());
    for (let i = 0; i < 50 && !screen.queryByRole('button', { name: /^Mở phiếu của Phạm Văn Đức/ }); i++) {
      await act(() => vi.advanceTimersByTimeAsync(0));
    }
    act(() => screen.getByRole('button', { name: /^Mở phiếu của Phạm Văn Đức/ }).click());
    await act(() => vi.advanceTimersByTimeAsync(1400));
    expect(search()).toContain('request=r-1');
  });
});
