import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import i18n from '@/lib/i18n';
import { handleSessionExpired } from '@/lib/session-relogin';
import { ISSUE, SNAPSHOT_ID, snapshotDataFixture } from './reports-fixtures';
import type { SnapshotData } from './reports.api';
import { errorResponse } from './reports-test-stub';
import { jsonResponse } from '@/test/test-utils';

vi.mock('@/lib/session-relogin', () => ({ handleSessionExpired: vi.fn() }));

function open(reply: Response | SnapshotData, id = SNAPSHOT_ID) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === `/api/admin/reports/snapshots/${id}`) return reply instanceof Response ? reply.clone() : jsonResponse(200, reply);
    return jsonResponse(200, { items: [], next_cursor: null, unread_count: 0 });
  });
  vi.stubGlobal('fetch', fetchMock);
  mockViewport(1280);
  renderApp(makeMe('admin'), `/admin/reports/snapshots/${id}/print`);
  return fetchMock;
}

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.mocked(handleSessionExpired).mockClear();
  await i18n.changeLanguage('vi');
});

describe('Trang in từ bản chốt', () => {
  it('tiêu đề tháng, phần 1, Xuất lẻ, phần 2 và số Đặt mua lấy từ bản chốt', async () => {
    open(snapshotDataFixture({ issues: [ISSUE] }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Báo cáo văn phòng phẩm tháng 10/2026' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Phần 1 · Tổng hợp theo món' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Xuất lẻ trong kỳ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Phần 2 · Chi tiết theo phòng ban' })).toBeInTheDocument();
    const part1 = screen.getByRole('region', { name: 'Phần 1 · Tổng hợp theo món' });
    const pen = within(part1).getByRole('row', { name: /Bút bi xanh/ });
    const cells = within(pen).getAllByRole('cell').map((c) => c.textContent);
    expect(cells.at(-2)).toBe('10');
    expect(cells.at(-1)).toBe('14');
    expect(within(part1).getAllByRole('columnheader')[2]).toHaveTextContent('Chưa giao kỳ này');
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('bản chốt thiếu khóa order_qty của một dòng → Đặt mua rơi về Cần mua (như xlsx)', async () => {
    open(snapshotDataFixture({ order_qty: {} }));
    const part1 = await screen.findByRole('region', { name: 'Phần 1 · Tổng hợp theo món' });
    const pen = within(part1).getByRole('row', { name: /Bút bi xanh/ });
    expect(within(pen).getAllByRole('cell').at(-1)).toHaveTextContent('10');
  });

  it('3 ô ký có tên từ bản chốt; ký rỗng vẫn có ô, không in "undefined"', async () => {
    open(snapshotDataFixture({ signers: { preparer: 'Lê Thị Hoa', head: '', approver: 'Đỗ Minh Châu' } }));
    const sign = await screen.findByRole('group', { name: 'Chữ ký' });
    const boxes = within(sign).getAllByRole('group');
    expect(boxes.map((b) => b.getAttribute('aria-label'))).toEqual(['Người lập', 'Trưởng phòng', 'Duyệt']);
    expect(within(boxes[0]).getByText('Lê Thị Hoa')).toBeInTheDocument();
    expect(boxes[1].textContent).toBe('Trưởng phòng');
    expect(within(boxes[2]).getByText('Đỗ Minh Châu')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('undefined');
  });

  it('"Lập lúc hh:mm dd/mm/yyyy bởi <tên>" theo giờ VN', async () => {
    open(snapshotDataFixture());
    expect(await screen.findByText('Lập lúc 09:30 28/10/2026 bởi Trần Thị Bình')).toBeInTheDocument();
  });

  it('người lập không có tên → hiện mã người dùng', async () => {
    open(snapshotDataFixture({ created_by: { sub: 'u-admin', name: null } }));
    expect(await screen.findByText('Lập lúc 09:30 28/10/2026 bởi u-admin')).toBeInTheDocument();
  });

  it('không có xuất lẻ → ẩn bảng Xuất lẻ', async () => {
    open(snapshotDataFixture({ issues: [] }));
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('heading', { name: 'Xuất lẻ trong kỳ' })).not.toBeInTheDocument();
  });

  it('bản chốt 0 dòng → hiện câu trống của hai phần', async () => {
    open(snapshotDataFixture({ byItem: [], custom: [], byDepartment: [], order_qty: {} }));
    expect(await screen.findByText('Tháng này chưa có món nào được đăng ký.')).toBeInTheDocument();
    expect(screen.getByText('Chưa có phiếu nào trong tháng này.')).toBeInTheDocument();
  });

  it('thanh công cụ: "In" gọi window.print, "Quay lại Báo cáo" về đúng tháng', async () => {
    open(snapshotDataFixture());
    const print = vi.fn();
    vi.stubGlobal('print', print);
    await userEvent.click(await screen.findByRole('button', { name: 'In' }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Quay lại Báo cáo' })).toHaveAttribute('href', '/admin/reports?ym=2026-10');
  });

  it('SNAPSHOT_NOT_FOUND → trang không tìm thấy', async () => {
    open(errorResponse(404, 'SNAPSHOT_NOT_FOUND'));
    expect(await screen.findByRole('heading', { name: 'Không tìm thấy trang' })).toBeInTheDocument();
  });

  it('id không phải uuid → không tìm thấy và không gọi api', async () => {
    const f = open(snapshotDataFixture(), 'abc');
    expect(await screen.findByRole('heading', { name: 'Không tìm thấy trang' })).toBeInTheDocument();
    expect(f.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('snapshots/'))).toEqual([]);
  });

  it('lỗi khác → thử lại, không giả không tìm thấy', async () => {
    open(errorResponse(500, 'INTERNAL'));
    expect(await screen.findByRole('button', { name: /Thử lại/ })).toBeInTheDocument();
  });

  it('hết phiên (401) → đăng nhập lại tập trung', async () => {
    open(errorResponse(401, 'UNAUTHENTICATED'));
    await vi.waitFor(() => expect(handleSessionExpired).toHaveBeenCalled());
  });

  it('thành viên thường bị chuyển về trang chủ, không gọi api bản chốt', async () => {
    const f = vi.fn(async (_url: string) => jsonResponse(200, { items: [], next_cursor: null, unread_count: 0 }));
    vi.stubGlobal('fetch', f);
    mockViewport(1280);
    renderApp(makeMe('member'), `/admin/reports/snapshots/${SNAPSHOT_ID}/print`);
    expect(await screen.findByTestId('location')).toHaveTextContent('/');
    expect(f.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('snapshots/'))).toEqual([]);
  });
});
