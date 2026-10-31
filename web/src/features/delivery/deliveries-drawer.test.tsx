import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, within } from '@/test/test-utils';
import type { LineDeliveries } from './backlog.api';
import { DeliveriesDrawer } from './deliveries-drawer';
import { backlogLine, deliveriesOf } from './backlog-fixtures';

const URL = '/api/admin/lines/l-pen/deliveries';

function stub(body: LineDeliveries | (() => Response | Promise<Response>)) {
  const fetchMock = vi.fn((url: string) =>
    Promise.resolve(url === URL ? (typeof body === 'function' ? body() : jsonResponse(200, body)) : jsonResponse(404, {})),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const round = (id: string, qty: number, created_at: string, actor_name: string | null, actor_sub = 'u-an') => ({
  id,
  qty,
  movement_id: `m-${id}`,
  actor_sub,
  actor_name,
  created_at,
});

afterEach(() => vi.unstubAllGlobals());

describe('DeliveriesDrawer — lịch sử đợt giao của một dòng (chỉ xem)', () => {
  it('2 đợt đúng thứ tự server trả "hh:mm dd/mm · n · người giao" (giờ VN), rồi dòng "Đã hủy n — lý do"', async () => {
    stub(
      deliveriesOf({ delivered_qty: 3, cancelled_qty: 2, cancel_note: 'Hết mẫu, đổi loại khác' }, [
        // 02:05Z = 09:05 giờ VN; 16:30Z ngày 11 = 23:30 giờ VN cùng ngày
        round('d1', 2, '2026-11-11T02:05:00.000Z', 'Nguyễn Văn An'),
        round('d2', 1, '2026-11-11T16:30:00.000Z', null, 'local:sa'),
      ]),
    );
    renderWithI18n(<DeliveriesDrawer line={backlogLine()} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Lịch sử giao Phạm Văn Đức' });
    const list = await within(dialog).findByRole('list', { name: 'Các đợt giao' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Giao 2 cây09:05 11/11 · Nguyễn Văn An',
      'Giao 1 cây23:30 11/11 · local:sa',
    ]);
    expect(within(dialog).getByText('Bút bi xanh · Tháng 10')).toBeInTheDocument();
    expect(within(dialog).getByText('Đăng ký').nextSibling).toHaveTextContent('5');
    expect(within(dialog).getByText('Đã giao').nextSibling).toHaveTextContent('3');
    expect(within(dialog).getByText('Đã hủy').nextSibling).toHaveTextContent('2');
    expect(within(dialog).getByText('Đã hủy 2 — Hết mẫu, đổi loại khác')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Hoàn tác/ })).toBeNull();
  });

  it('chưa hủy → thẻ thứ ba là "Còn nợ" = đăng ký − đã giao', async () => {
    stub(deliveriesOf({ delivered_qty: 2 }, [round('d1', 2, '2026-11-11T02:05:00.000Z', 'An')]));
    renderWithI18n(<DeliveriesDrawer line={backlogLine()} onClose={() => {}} />);
    const owed = await screen.findByText('Còn nợ');
    expect(owed.nextSibling).toHaveTextContent('3');
    expect(screen.queryByText('Đã hủy')).toBeNull();
  });

  it('chưa có đợt nào, chưa hủy → "Chưa giao đợt nào", không có dòng hủy', async () => {
    stub(deliveriesOf());
    renderWithI18n(<DeliveriesDrawer line={backlogLine()} onClose={() => {}} />);
    expect(await screen.findByText('Chưa giao đợt nào')).toBeInTheDocument();
    expect(screen.queryByText(/^Đã hủy/)).toBeNull();
  });

  it('đã hủy mà không có ghi chú → "Đã hủy 2", không có gạch nối thừa', async () => {
    stub(deliveriesOf({ cancelled_qty: 2, cancel_note: null }));
    renderWithI18n(<DeliveriesDrawer line={backlogLine()} onClose={() => {}} />);
    expect(await screen.findByText('Đã hủy 2')).toBeInTheDocument();
  });

  it('đang tải → khung xương (role status), không phải chữ "Đang tải"; ngăn rộng 384', async () => {
    stub(() => new Promise<Response>(() => {}));
    renderWithI18n(<DeliveriesDrawer line={backlogLine()} onClose={() => {}} />);
    expect(await screen.findByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('dialog', { name: 'Lịch sử giao Phạm Văn Đức' })).toHaveStyle({ maxWidth: '384px' });
  });

  it('tải lỗi → báo lỗi có nút thử lại, không nuốt thành rỗng', async () => {
    stub(() => jsonResponse(500, {}));
    renderWithI18n(<DeliveriesDrawer line={backlogLine()} onClose={() => {}} />);
    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(screen.queryByText('Chưa giao đợt nào')).toBeNull();
  });
});
