import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, within } from '@/test/test-utils';
import { MovementsDrawer } from './movements-drawer';
import { makeRow } from './stock-dialog-fixtures';
import { move, USERS } from './stock-fixtures';

function stubApi(pages: { first: unknown[]; next?: string | null; second?: unknown[] }) {
  const fetchMock = vi.fn((url: string) => {
    if (url.startsWith('/api/admin/users')) return Promise.resolve(jsonResponse(200, USERS));
    if (url.includes('cursor=c2')) return Promise.resolve(jsonResponse(200, { items: pages.second ?? [], next_cursor: null }));
    return Promise.resolve(jsonResponse(200, { items: pages.first, next_cursor: pages.next ?? null }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const show = (stock: number, onAction = vi.fn()) =>
  renderWithI18n(<MovementsDrawer item={makeRow(stock, 4, 2)} groupName="Giấy" onAction={onAction} onClose={vi.fn()} />);

describe('MovementsDrawer — Lịch sử nhập xuất', () => {
  it('đầu panel: "Lịch sử nhập xuất Giấy A4", "Giấy · ram", dòng tóm tắt "Tủ 7 · đang giữ 4 · còn xuất được 3"', async () => {
    stubApi({ first: [] });
    show(7);
    expect(screen.getByText('Giấy · ram')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Lịch sử nhập xuất Giấy A4' })).toBeInTheDocument();
    const sum = document.querySelector('.sk-balance')!;
    expect(sum.textContent).toContain('Tủ 7·đang giữ 4·còn xuất được 3');
    expect(await screen.findByText('Chưa có lần nhập xuất nào.')).toBeInTheDocument();
  });

  it('mỗi dòng một câu: [−3 xuất lẻ cho Bình, +10 hàng về kỳ] với tồn 7 → "còn 7", "còn 10"; ghi chú máy "Hàng về kỳ" thành "Hàng về tháng 10"', async () => {
    stubApi({
      first: [
        move('m-2', { delta: -3, reason: 'issue', note: 'Người mới', recipient_sub: 'u-binh' }),
        move('m-1', { delta: 10, note: 'Hàng về kỳ 2026-10', receipt_ym: '2026-10' }),
      ],
    });
    show(7);
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('−3')).toBeInTheDocument();
    expect(within(items[0]).getByText('còn 7')).toBeInTheDocument();
    expect(items[0]).toHaveTextContent('Xuất lẻ 3 ram cho Trần Thị Bình');
    expect(items[0]).toHaveTextContent('Phạm Hành Chính · “Người mới”');
    expect(within(items[1]).getByText('+10')).toBeInTheDocument();
    expect(within(items[1]).getByText('còn 10')).toBeInTheDocument();
    expect(items[1]).toHaveTextContent('Nhập 10 ram · Hàng về tháng 10');
    expect(screen.queryByText(/Hàng về kỳ 2026-10/)).toBeNull();
  });

  it('câu theo loại: dùng chung, giao cho chủ phiếu, hoàn, điều chỉnh, nhập ngoài kỳ; về bù giữ phần ghi chú sau dấu ·', async () => {
    stubApi({
      first: [
        move('m-6', { delta: 4, note: 'Về bù kỳ 2026-09 · ADM giao thiếu', receipt_ym: '2026-09' }),
        move('m-5', { delta: 2, note: 'Đơn số 12' }),
        move('m-4', { delta: -1, reason: 'adjust', note: 'Hộp rơi' }),
        move('m-3', { delta: 2, reason: 'return' }),
        move('m-2', { delta: -2, reason: 'delivery', delivered_to_sub: 'u-binh' }),
        move('m-1', { delta: -1, reason: 'issue', note: 'Máy in' }),
      ],
    });
    show(5);
    const items = await screen.findAllByRole('listitem');
    expect(items.map((i) => i.querySelector('.sk-ledger__text')?.textContent)).toEqual([
      'Nhập Nhập 4 ram · Về bù tháng 9',
      'Nhập Nhập ngoài kỳ 2 ram',
      'Điều chỉnh Điều chỉnh tồn',
      'Hoàn Hoàn 2 ram vào tủ',
      'Giao Giao 2 ram cho Trần Thị Bình',
      'Xuất lẻ Xuất lẻ 1 ram dùng chung',
    ]);
    expect(items[0]).toHaveTextContent('“ADM giao thiếu”');
    expect(items[1]).toHaveTextContent('“Đơn số 12”');
    expect(items[2]).toHaveTextContent('“Hộp rơi”');
  });

  it('gom theo ngày giờ VN: tiêu đề "Ngày 28/10" (khác hôm nay), giờ 10:15; người thao tác lạ không hiện mã', async () => {
    stubApi({ first: [move('m-1', { delta: 1, actor_sub: 'u-la' })] });
    show(1);
    expect(await screen.findByRole('heading', { name: /Ngày 28\/10/ })).toBeInTheDocument();
    const item = screen.getByRole('listitem');
    expect(within(item).getByText('10:15')).toBeInTheDocument();
    expect(item).toHaveTextContent('Người dùng cũ');
    expect(item).not.toHaveTextContent('u-la');
  });

  it('"Xem thêm" khi có next_cursor: tải trang sau, tồn sau tiếp nối qua trang, hết thì nút biến mất', async () => {
    stubApi({ first: [move('m-2', { delta: -3 })], next: 'c2', second: [move('m-1', { delta: 10 })] });
    show(7);
    await userEvent.click(await screen.findByRole('button', { name: 'Xem thêm' }));
    expect(await screen.findByText('còn 10')).toBeInTheDocument();
    expect(screen.getByText('còn 7')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull();
  });

  it('không có next_cursor → không có "Xem thêm"', async () => {
    stubApi({ first: [move('m-1', { delta: 1 })] });
    show(1);
    await screen.findByText('còn 1');
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull();
  });

  it('chân: hai nút thao tác (không còn Kiểm kê) gọi onAction; "Xuất lẻ" vô hiệu khi tồn 0', async () => {
    stubApi({ first: [] });
    const onAction = vi.fn();
    const { unmount } = show(3, onAction);
    await userEvent.click(screen.getByRole('button', { name: 'Nhập ngoài kỳ (tự mua lẻ)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xuất lẻ' }));
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(['purchase', 'issue']);
    expect(screen.queryByRole('button', { name: 'Kiểm kê' })).toBeNull();
    unmount();
    show(0);
    expect(screen.getByRole('button', { name: 'Xuất lẻ' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Xuất lẻ' })).toHaveAccessibleDescription('Tủ hết món này');
    expect(screen.getByText('Tủ hết món này')).toBeVisible();
  });

  it('tồn 1 (phía kia mốc 0) → "Xuất lẻ" bật, không có lý do khóa', async () => {
    stubApi({ first: [] });
    show(1);
    expect(screen.getByRole('button', { name: 'Xuất lẻ' })).toBeEnabled();
    expect(screen.queryByText('Tủ hết món này')).toBeNull();
  });
});
