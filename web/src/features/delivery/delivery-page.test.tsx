import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { PERIOD } from '@/test/request-api-stub';
import type { AdminRequestView, PersonRow } from '@/features/summary/summary.api';
import { NOTE_LINE, PEN_LINE, deliveryRequest, personRow } from './delivery-fixtures';

const ROWS: PersonRow[] = [
  personRow(),
  personRow({ request_id: 'r-2', user_sub: 'u-lan', full_name: 'Võ Thị Lan', department: null, total_qty: 4, delivered_qty: 0 }),
];

interface Stub {
  views?: AdminRequestView[];
  deliverAll?: () => Response | Promise<Response>;
  deliver?: (url: string) => Response;
}

function stub({ views = [deliveryRequest()], deliverAll, deliver }: Stub = {}) {
  let loads = 0;
  const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
    const res = (r: Response | Promise<Response>) => Promise.resolve(r);
    if (url === '/api/periods/current') return res(jsonResponse(200, PERIOD));
    if (url.startsWith('/api/admin/periods/')) return res(jsonResponse(200, { items: ROWS, next_cursor: null }));
    if (url === '/api/admin/requests/r-1') return res(jsonResponse(200, views[Math.min(loads++, views.length - 1)]));
    if (url === '/api/admin/requests/r-2') return res(jsonResponse(200, deliveryRequest({ id: 'r-2', full_name: 'Võ Thị Lan', lines: [] })));
    if (url === '/api/admin/requests/r-1/deliver-all' && deliverAll) return res(deliverAll());
    if (url.endsWith('/deliver') && deliver) return res(deliver(url));
    return res(jsonResponse(200, { items: [] }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const urls = (f: ReturnType<typeof stub>) => f.mock.calls.map((c) => String(c[0]));
const count = (f: ReturnType<typeof stub>, url: string) => urls(f).filter((u) => u === url).length;
const toggle = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

async function openPage(path = '/admin/delivery?request=r-1') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
  return screen.findByRole('list', { name: 'Các dòng của phiếu Phạm Văn Đức' });
}

afterEach(() => vi.unstubAllGlobals());

describe('DeliveryPage — trang Giao hàng', () => {
  it('mặc định kỳ khóa gần nhất (tháng trước kỳ đang mở), không sang được kỳ đang mở; chỉ phiếu còn cần giao', async () => {
    mockViewport(1280);
    const f = stub();
    renderApp(makeMe('admin'), '/admin/delivery');
    expect(await screen.findByText('Tháng 10/2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
    await screen.findByText('Phạm Văn Đức');
    expect(urls(f).some((u) => u.startsWith('/api/admin/periods/2026-10/requests?by=person&filter=pending_delivery'))).toBe(true);
    expect(toggle('Phạm Văn Đức')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('progressbar', { name: 'Đã giao 3/8' })).toBeInTheDocument();
  });

  it('?ym= là kỳ đang mở → rơi về kỳ khóa gần nhất', async () => {
    mockViewport(1280);
    stub();
    renderApp(makeMe('admin'), '/admin/delivery?ym=2026-11');
    expect(await screen.findByText('Tháng 10/2026')).toBeInTheDocument();
  });

  it('bật "Hiện cả phiếu đã giao đủ" → gọi filter=all', async () => {
    mockViewport(1280);
    const f = stub();
    renderApp(makeMe('admin'), '/admin/delivery');
    await screen.findByText('Phạm Văn Đức');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Hiện cả phiếu đã giao đủ' }));
    await waitFor(() => expect(urls(f).some((u) => u.includes('filter=all'))).toBe(true));
  });

  it('?request=r-1 mở sẵn phiếu đó (aria-expanded) với từng dòng; bấm người khác mở thêm phiếu đó', async () => {
    stub();
    const lines = await openPage();
    expect(toggle('Phạm Văn Đức')).toHaveAttribute('aria-expanded', 'true');
    expect(within(lines).getByLabelText(/^Thực giao Bút bi xanh/)).toHaveValue(2);
    expect(within(lines).getByText('Chờ xem — chưa giao được')).toBeInTheDocument();
    expect(within(lines).getByText('Đã từ chối')).toBeInTheDocument();
    await userEvent.click(toggle('Võ Thị Lan'));
    expect(toggle('Võ Thị Lan')).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle('Phạm Văn Đức'));
    expect(toggle('Phạm Văn Đức')).toHaveAttribute('aria-expanded', 'false');
  });

  it('Giao tất cả → "Đã giao 1 dòng", thiếu kho liệt kê "Không giao được: <món> — <lý do>", dòng chờ xem/từ chối là thông tin; tải lại phiếu + danh sách', async () => {
    const after = deliveryRequest({ lines: [{ ...PEN_LINE, delivered_qty: 5 }, NOTE_LINE] });
    const f = stub({
      views: [deliveryRequest(), after],
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
    await openPage();
    const listLoads = urls(f).filter((u) => u.startsWith('/api/admin/periods/')).length;
    await userEvent.click(screen.getByRole('button', { name: 'Giao tất cả' }));
    const result = (await screen.findByText('Đã giao 1 dòng')).closest<HTMLElement>('[role="status"]')!;
    const failed = within(result).getByRole('list', { name: 'Không giao được' });
    expect(failed).toHaveTextContent('Không giao được: Giấy note vàng — chỉ còn 1 trong kho');
    const info = within(result).getByRole('list', { name: 'Bỏ qua' });
    expect(info).toHaveTextContent('Băng keo 2 mặt — Chờ xem — chưa giao được');
    expect(info).toHaveTextContent('Kéo cắt giấy — Đã từ chối');
    expect(screen.queryByRole('alert')).toBeNull();
    await waitFor(() => expect(count(f, '/api/admin/requests/r-1')).toBe(2));
    expect(await screen.findByText('Đã giao đủ')).toBeInTheDocument();
    await waitFor(() => expect(urls(f).filter((u) => u.startsWith('/api/admin/periods/')).length).toBeGreaterThan(listLoads));
  });

  it('Giao tất cả bấm hai lần trước khi giao diện vẽ lại → một POST; nút vô hiệu khi đang gửi', async () => {
    let release: (r: Response) => void = () => {};
    const f = stub({ deliverAll: () => new Promise<Response>((res) => (release = res)) });
    await openPage();
    const button = screen.getByRole('button', { name: 'Giao tất cả' });
    act(() => {
      button.click();
      button.click();
    });
    expect(screen.getByRole('button', { name: /Đang giao/ })).toBeDisabled();
    expect(count(f, '/api/admin/requests/r-1/deliver-all')).toBe(1);
    await act(async () => release(jsonResponse(200, { delivered: [], failed: [] })));
  });

  it('409 STALE_UPDATE khi giao một dòng → tải lại phiếu + "Dòng vừa được giao ở nơi khác — số đã cập nhật"', async () => {
    const fresh = deliveryRequest({ lines: [{ ...PEN_LINE, delivered_qty: 4 }, NOTE_LINE] });
    const f = stub({ views: [deliveryRequest(), fresh], deliver: () => jsonResponse(409, { code: 'STALE_UPDATE', message: 'x', delivered_qty: 4 }) });
    const lines = await openPage();
    await userEvent.click(within(lines).getByRole('button', { name: 'Giao Bút bi xanh' }));
    expect(await screen.findByText('Dòng vừa được giao ở nơi khác — số đã cập nhật')).toBeInTheDocument();
    await waitFor(() => expect(count(f, '/api/admin/requests/r-1')).toBe(2));
    expect(await within(lines).findByText('đã giao 4/5')).toBeInTheDocument();
    expect(within(lines).getByLabelText(/^Thực giao Bút bi xanh/)).toHaveValue(1);
  });

  it('400 DELIVER_EXCEEDS_QTY (vừa hủy nợ ở nơi khác) → tải lại phiếu, ô đặt lại theo phần còn lại mới', async () => {
    const fresh = deliveryRequest({ lines: [{ ...PEN_LINE, cancelled_qty: 1 }, NOTE_LINE] });
    const f = stub({ views: [deliveryRequest(), fresh], deliver: () => jsonResponse(400, { code: 'DELIVER_EXCEEDS_QTY', message: 'x', remaining: 1 }) });
    const lines = await openPage();
    await userEvent.click(within(lines).getByRole('button', { name: 'Giao Bút bi xanh' }));
    await waitFor(() => expect(count(f, '/api/admin/requests/r-1')).toBe(2));
    expect(await within(lines).findByText('đã hủy 1')).toBeInTheDocument();
    expect(within(lines).getByLabelText(/^Thực giao Bút bi xanh/)).toHaveValue(1);
  });

  it('Giao tất cả lỗi cả phiếu (PERIOD_NOT_LOCKED) → vẫn tải lại phiếu', async () => {
    const f = stub({ deliverAll: () => jsonResponse(409, { code: 'PERIOD_NOT_LOCKED', message: 'x' }) });
    await openPage();
    await userEvent.click(screen.getByRole('button', { name: 'Giao tất cả' }));
    await screen.findByRole('alert');
    await waitFor(() => expect(count(f, '/api/admin/requests/r-1')).toBe(2));
  });

  it('409 PERIOD_NOT_LOCKED → "Kỳ chưa khóa — giao sau 00:00 ngày 11"', async () => {
    stub({ deliverAll: () => jsonResponse(409, { code: 'PERIOD_NOT_LOCKED', message: 'x' }) });
    await openPage();
    await userEvent.click(screen.getByRole('button', { name: 'Giao tất cả' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Kỳ chưa khóa — giao sau 00:00 ngày 11');
  });

  it('phiếu không còn dòng giao được → nút Giao tất cả vô hiệu', async () => {
    stub({ views: [deliveryRequest({ lines: [{ ...PEN_LINE, delivered_qty: 5 }] })] });
    await openPage();
    expect(screen.getByRole('button', { name: 'Giao tất cả' })).toBeDisabled();
  });

  it('Hành chính tăng qty Bút bi 5→7 ở nơi khác, giao dòng khác xong tải lại → ô "Thực giao" Bút bi đặt lại 4 (còn lại mới)', async () => {
    const fresh = deliveryRequest({ lines: [{ ...PEN_LINE, qty: 7 }, { ...NOTE_LINE, delivered_qty: 3 }] });
    stub({ views: [deliveryRequest(), fresh], deliver: () => jsonResponse(200, { line: {} }) });
    const lines = await openPage();
    expect(within(lines).getByLabelText(/^Thực giao Bút bi xanh/)).toHaveValue(2);
    await userEvent.click(within(lines).getByRole('button', { name: 'Giao Giấy note vàng' }));
    expect(await within(lines).findByText('đã giao 3/7')).toBeInTheDocument();
    expect(within(lines).getByLabelText(/^Thực giao Bút bi xanh/)).toHaveValue(4);
  });

  it('409 STOCK_INSUFFICIENT {available: 1} → "Chỉ còn 1"; phiếu tải lại sau đó (giao dòng khác) → bỏ mức trần cũ, Giao 2 bật lại', async () => {
    const fresh = deliveryRequest({ lines: [PEN_LINE, { ...NOTE_LINE, delivered_qty: 3 }] });
    stub({
      views: [deliveryRequest(), fresh],
      deliver: (url) => (url.includes('l-pen') ? jsonResponse(409, { code: 'STOCK_INSUFFICIENT', message: 'x', available: 1 }) : jsonResponse(200, { line: {} })),
    });
    const lines = await openPage();
    await userEvent.click(within(lines).getByRole('button', { name: 'Giao Bút bi xanh' }));
    expect(await within(lines).findByText('Chỉ còn 1')).toBeInTheDocument();
    expect(within(lines).getByRole('button', { name: 'Giao Bút bi xanh' })).toBeDisabled();
    await userEvent.click(within(lines).getByRole('button', { name: 'Giao Giấy note vàng' }));
    await waitFor(() => expect(within(lines).queryByText('Chỉ còn 1')).toBeNull());
    expect(within(lines).getByLabelText(/^Thực giao Bút bi xanh/)).toHaveValue(2);
    expect(within(lines).getByRole('button', { name: 'Giao Bút bi xanh' })).toBeEnabled();
  });
});
