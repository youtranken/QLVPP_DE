import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent } from '@/test/test-utils';
import type { AdminItem } from '@/features/catalog/catalog.api';
import { MovementsDrawer } from '@/features/stock/movements-drawer';

const ITEM = { id: 'i-1', name: 'Giấy A4', unit: 'ram' } as AdminItem;

const move = (id: string, over: Record<string, unknown>) => ({
  id,
  delta: 1,
  reason: 'purchase',
  note: null,
  actor_sub: 'u-hc',
  recipient_sub: null,
  created_at: '2026-10-28T03:15:00.000Z',
  ...over,
});

const USERS = {
  items: [
    { sub: 'u-hc', fullName: 'Phạm Hành Chính', email: null, department: null, status: 'active' },
    { sub: 'u-binh', fullName: 'Trần Thị Bình', email: null, department: null, status: 'active' },
  ],
  next_cursor: null,
};

function stubApi() {
  const fetchMock = vi.fn((url: string) => {
    if (url.startsWith('/api/admin/users')) return Promise.resolve(jsonResponse(200, USERS));
    if (url.includes('cursor=c2')) {
      return Promise.resolve(
        jsonResponse(200, { items: [move('m-3', { delta: -2, reason: 'adjust', note: 'Kiểm kê' })], next_cursor: null }),
      );
    }
    return Promise.resolve(
      jsonResponse(200, {
        items: [
          move('m-1', { delta: -3, reason: 'issue', note: 'Người mới', recipient_sub: 'u-binh' }),
          move('m-2', { delta: -1, reason: 'issue', note: 'Máy in' }),
        ],
        next_cursor: 'c2',
      }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('MovementsDrawer', () => {
  it('nhãn theo reason: xuất lẻ có tên người nhận / "Dùng chung", hiện người thực hiện và lý do; "Xem thêm" tải trang sau', async () => {
    stubApi();
    renderWithI18n(<MovementsDrawer item={ITEM} onClose={vi.fn()} />);
    expect(await screen.findByText('Xuất lẻ · Trần Thị Bình')).toBeInTheDocument();
    expect(screen.getByText('Xuất lẻ · Dùng chung')).toBeInTheDocument();
    expect(screen.getByText('Người mới')).toBeInTheDocument();
    expect(screen.getByText('−3')).toBeInTheDocument();
    expect(screen.getAllByText(/Phạm Hành Chính/)).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Xem thêm' }));
    expect(await screen.findByText('Điều chỉnh')).toBeInTheDocument();
    expect(screen.getByText('Kiểm kê')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull();
  });
});
