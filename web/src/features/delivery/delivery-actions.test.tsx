import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { deliveryRequest } from './delivery-fixtures';
import { countOf, stubDelivery } from './delivery-test-stub';

const DELIVER_ALL = '/api/admin/requests/r-1/deliver-all';

async function openDetail() {
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/delivery?request=r-1');
  return screen.findByRole('table', { name: 'Các dòng của phiếu Phạm Văn Đức' });
}

const result = () => screen.findByRole('status', { name: 'Kết quả giao' });

afterEach(() => vi.unstubAllGlobals());

describe('DeliveryDetail — Giao dòng đã chọn (lần lượt từng dòng)', () => {
  it('2 dòng, dòng 1 hết hàng → dòng 2 vẫn gửi; "Đã giao 1 dòng · Không giao được 1: Bút bi xanh — chỉ còn 0"; câu lỗi ở dòng 1', async () => {
    const order: string[] = [];
    const f = stubDelivery({
      views: [deliveryRequest(), deliveryRequest()],
      deliver: (url, body) => {
        order.push(`${url}:${body.qty}:${body.expected_delivered_qty}`);
        return url.includes('l-pen')
          ? jsonResponse(409, { code: 'STOCK_INSUFFICIENT', message: 'x', available: 0 })
          : jsonResponse(200, { line: {}, request_complete: false });
      },
    });
    await openDetail();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn Giấy note vàng' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn Bút bi xanh' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bớt Giấy note vàng' }));
    await userEvent.click(screen.getByRole('button', { name: 'Giao dòng đã chọn (2)' }));
    expect(await result()).toHaveTextContent('Đã giao 1 dòng · Không giao được 1: Bút bi xanh — chỉ còn 0');
    expect(order).toEqual(['/api/admin/lines/l-pen/deliver:2:3', '/api/admin/lines/l-note/deliver:2:0']);
    expect(countOf(f, '/api/admin/requests/r-1')).toBe(2);
    expect(screen.getByRole('row', { name: /Bút bi xanh/ })).toHaveTextContent('Chỉ còn 0 cây.');
  });

  it('cả 2 dòng giao được → "Đã giao 2 dòng", bỏ chọn', async () => {
    stubDelivery({ deliver: () => jsonResponse(200, { line: {} }) });
    await openDetail();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn mọi dòng giao được' }));
    expect(screen.getByText('Đã chọn 2 dòng')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Giao dòng đã chọn (2)' }));
    expect(await result()).toHaveTextContent(/^Đã giao 2 dòng$/);
    expect(screen.getByText('Đã chọn 0 dòng')).toBeInTheDocument();
  });

  it('PERIOD_NOT_LOCKED ở các dòng → khối "Kỳ chưa khóa…" đầu chi tiết', async () => {
    stubDelivery({ deliver: () => jsonResponse(409, { code: 'PERIOD_NOT_LOCKED', message: 'x' }) });
    await openDetail();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn Bút bi xanh' }));
    await userEvent.click(screen.getByRole('button', { name: 'Giao dòng đã chọn (1)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Kỳ chưa khóa — giao sau 00:00 ngày 11/10.');
  });
});

describe('DeliveryDetail — Giao tất cả', () => {
  it('kết quả từ {delivered, failed}: "(chỉ còn 1)", "(chờ xem)", "(đã từ chối)"; tải lại phiếu', async () => {
    const f = stubDelivery({
      views: [deliveryRequest(), deliveryRequest()],
      deliverAll: () =>
        jsonResponse(200, {
          delivered: [{ line_id: 'l-pen', qty: 2 }],
          failed: [
            { line_id: 'l-note', code: 'STOCK_INSUFFICIENT', available: 1 },
            { line_id: 'l-tape', code: 'LINE_NOT_REVIEWED' },
            { line_id: 'l-cut', code: 'LINE_REJECTED' },
          ],
        }),
    });
    await openDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Giao tất cả' }));
    expect(await result()).toHaveTextContent(
      'Đã giao 1 dòng · Không giao được: Giấy note vàng (chỉ còn 1), Băng keo 2 mặt (chờ xem), Kéo cắt giấy (đã từ chối)',
    );
    expect(countOf(f, '/api/admin/requests/r-1')).toBe(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('{delivered: [], failed: []} → "Không còn dòng nào cần giao"', async () => {
    stubDelivery({ deliverAll: () => jsonResponse(200, { delivered: [], failed: [] }) });
    await openDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Giao tất cả' }));
    expect(await result()).toHaveTextContent('Không còn dòng nào cần giao');
  });

  it('PERIOD_NOT_LOCKED → khối đầu chi tiết, vẫn tải lại phiếu', async () => {
    const f = stubDelivery({ deliverAll: () => jsonResponse(409, { code: 'PERIOD_NOT_LOCKED', message: 'x' }) });
    await openDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Giao tất cả' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Kỳ chưa khóa — giao sau 00:00 ngày 11/10.');
    expect(countOf(f, '/api/admin/requests/r-1')).toBe(2);
  });

  it('bấm hai lần trước khi vẽ lại → một POST; nút "Đang giao…" vô hiệu', async () => {
    let release: (r: Response) => void = () => {};
    const f = stubDelivery({ deliverAll: () => new Promise<Response>((res) => (release = res)) });
    await openDetail();
    const button = screen.getByRole('button', { name: 'Giao tất cả' });
    act(() => {
      button.click();
      button.click();
    });
    expect(screen.getByRole('button', { name: 'Đang giao…' })).toBeDisabled();
    expect(countOf(f, DELIVER_ALL)).toBe(1);
    await act(async () => release(jsonResponse(200, { delivered: [], failed: [] })));
  });

  it('bấm đúp Giao một dòng → một POST', async () => {
    let release: (r: Response) => void = () => {};
    const f = stubDelivery({ deliver: () => new Promise<Response>((res) => (release = res)) });
    const table = await openDetail();
    const button = within(table).getByRole('button', { name: 'Giao Bút bi xanh' });
    act(() => {
      button.click();
      button.click();
    });
    expect(countOf(f, '/api/admin/lines/l-pen/deliver')).toBe(1);
    await act(async () => release(jsonResponse(200, { line: {} })));
  });

  it('phiếu không còn dòng giao được → Giao tất cả vô hiệu', async () => {
    stubDelivery({ views: [deliveryRequest({ lines: [] })] });
    await openDetail();
    expect(screen.getByRole('button', { name: 'Giao tất cả' })).toBeDisabled();
  });
});
