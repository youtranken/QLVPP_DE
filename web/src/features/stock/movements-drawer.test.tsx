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
  renderWithI18n(<MovementsDrawer item={{ ...makeRow(stock), owed: 4 }} groupName="Giấy" onAction={onAction} onClose={vi.fn()} />);

describe('MovementsDrawer', () => {
  it('đầu ngăn kéo: "Giấy · ram", "Sổ cái · Giấy A4", tồn lớn 7, "Còn nợ: 4"', async () => {
    stubApi({ first: [] });
    show(7);
    expect(screen.getByText('Giấy · ram')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Sổ cái · Giấy A4' })).toBeInTheDocument();
    expect(screen.getByText('Còn nợ: 4')).toBeInTheDocument();
    expect(await screen.findByText('Chưa có biến động nào.')).toBeInTheDocument();
  });

  it('[+10, −3] với tồn 7: dòng mới trước "tồn 7", dòng cũ "tồn 10"', async () => {
    stubApi({ first: [move('m-2', { delta: -3, reason: 'issue', note: 'Người mới', recipient_sub: 'u-binh' }), move('m-1', { delta: 10 })] });
    show(7);
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('−3')).toBeInTheDocument();
    expect(within(items[0]).getByText('tồn 7')).toBeInTheDocument();
    expect(within(items[0]).getByText('Xuất lẻ · Trần Thị Bình')).toBeInTheDocument();
    expect(within(items[1]).getByText('+10')).toBeInTheDocument();
    expect(within(items[1]).getByText('tồn 10')).toBeInTheDocument();
    expect(within(items[1]).getByText('Nhập mua')).toBeInTheDocument();
  });

  it('nhãn loại: Xuất lẻ · Dùng chung, Giao, Hoàn; hiện giờ · người thao tác và ghi chú', async () => {
    stubApi({
      first: [
        move('m-3', { delta: 2, reason: 'return' }),
        move('m-2', { delta: -2, reason: 'delivery' }),
        move('m-1', { delta: -1, reason: 'issue', note: 'Máy in' }),
      ],
    });
    show(5);
    expect(await screen.findByText('Xuất lẻ · Dùng chung')).toBeInTheDocument();
    expect(screen.getByText('Giao')).toBeInTheDocument();
    expect(screen.getByText('Hoàn')).toBeInTheDocument();
    expect(screen.getByText('Máy in')).toBeInTheDocument();
    expect(screen.getAllByText(/Phạm Hành Chính/)).toHaveLength(3);
  });

  it('"Xem thêm" khi có next_cursor: tải trang sau, tồn sau tiếp nối qua trang, hết thì nút biến mất', async () => {
    stubApi({ first: [move('m-2', { delta: -3 })], next: 'c2', second: [move('m-1', { delta: 10 })] });
    show(7);
    await userEvent.click(await screen.findByRole('button', { name: 'Xem thêm' }));
    expect(await screen.findByText('tồn 10')).toBeInTheDocument();
    expect(screen.getByText('tồn 7')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull();
  });

  it('không có next_cursor → không có "Xem thêm"', async () => {
    stubApi({ first: [move('m-1', { delta: 1 })] });
    show(1);
    await screen.findByText('tồn 1');
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull();
  });

  it('chân: ba nút thao tác gọi onAction; "Xuất lẻ…" vô hiệu khi tồn 0', async () => {
    stubApi({ first: [] });
    const onAction = vi.fn();
    const { unmount } = show(3, onAction);
    await userEvent.click(screen.getByRole('button', { name: 'Nhập mua…' }));
    await userEvent.click(screen.getByRole('button', { name: 'Điều chỉnh…' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xuất lẻ…' }));
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(['purchase', 'adjust', 'issue']);
    unmount();
    show(0);
    expect(screen.getByRole('button', { name: 'Xuất lẻ…' })).toBeDisabled();
  });
});
