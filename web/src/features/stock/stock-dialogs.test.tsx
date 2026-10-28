import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { ConfirmProvider } from '@/ui/confirm-provider';
import type { AdminItem } from '@/features/catalog/catalog.api';
import { IssueDialog, StockChangeDialog } from '@/features/stock/stock-dialogs';

const ITEM: AdminItem = {
  id: 'i-1',
  code: null,
  name: 'Giấy A4',
  name_en: null,
  unit: 'ram',
  pack_note: null,
  category_id: null,
  image_file_id: 'f-1',
  admin_only: false,
  max_qty: 20,
  stock_qty: 5,
  min_stock: 2,
  active: true,
  sort_order: 0,
  missing_image: false,
};

const USERS = {
  items: [
    { sub: 'u-binh', fullName: 'Trần Thị Bình', email: 'binh@pmh.com.vn', department: 'Giám sát', status: 'active' },
    { sub: 'u-cuong', fullName: 'Lê Văn Cường', email: 'cuong@pmh.com.vn', department: null, status: 'locked' },
  ],
  next_cursor: null,
};

function stubApi(mutationResponse: Response) {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) =>
    Promise.resolve(url.startsWith('/api/admin/users') ? jsonResponse(200, USERS) : mutationResponse),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function mutationCall(fetchMock: ReturnType<typeof stubApi>, url: string) {
  const call = fetchMock.mock.calls.find((c) => c[0] === url) as [string, RequestInit] | undefined;
  if (!call) throw new Error(`không có request tới ${url}`);
  return { init: call[1], body: JSON.parse(String(call[1].body)) as Record<string, unknown> };
}

function wrap(ui: React.ReactElement) {
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <ConfirmProvider>{ui}</ConfirmProvider>
    </MeContext.Provider>,
  );
}

describe('StockChangeDialog', () => {
  it('điều chỉnh không ghi lý do → nút "Lưu điều chỉnh" vô hiệu', async () => {
    wrap(<StockChangeDialog item={ITEM} mode="adjust" onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Số lượng điều chỉnh'), '-2');
    expect(screen.getByRole('button', { name: 'Lưu điều chỉnh' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Lý do điều chỉnh'), 'Kiểm kê');
    expect(screen.getByRole('button', { name: 'Lưu điều chỉnh' })).toBeEnabled();
  });

  it('nhập mua 10 kèm ghi chú → POST stock {delta: 10, reason: purchase, note} kèm CSRF rồi đóng', async () => {
    const fetchMock = stubApi(jsonResponse(201, { stock_qty: 15, movement_id: 'm-1' }));
    const onClose = vi.fn();
    wrap(<StockChangeDialog item={ITEM} mode="purchase" onClose={onClose} />);
    expect(screen.getByText('Tồn hiện tại: 5 ram')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Số lượng'), '10');
    await userEvent.type(screen.getByLabelText('Ghi chú'), 'Đơn T11');
    await userEvent.click(screen.getByRole('button', { name: 'Nhập kho' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const { init, body } = mutationCall(fetchMock, '/api/admin/items/i-1/stock');
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-1');
    expect(body).toEqual({ delta: 10, reason: 'purchase', note: 'Đơn T11' });
  });

  it('điều chỉnh giảm quá tồn: server STOCK_INSUFFICIENT {available: 5} → "Chỉ còn 5" gắn vào ô số lượng', async () => {
    stubApi(jsonResponse(409, { code: 'STOCK_INSUFFICIENT', message: 'x', available: 5 }));
    wrap(<StockChangeDialog item={ITEM} mode="adjust" onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Số lượng điều chỉnh'), '-9');
    await userEvent.type(screen.getByLabelText('Lý do điều chỉnh'), 'Hỏng');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu điều chỉnh' }));
    await vi.waitFor(() => expect(screen.getByLabelText('Số lượng điều chỉnh')).toHaveAccessibleDescription('Chỉ còn 5'));
  });
});

describe('IssueDialog', () => {
  it('server trả STOCK_INSUFFICIENT {available: 2} → thông báo "Chỉ còn 2"', async () => {
    stubApi(jsonResponse(409, { code: 'STOCK_INSUFFICIENT', message: 'x', available: 2 }));
    wrap(<IssueDialog item={ITEM} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Số lượng'), '3');
    await userEvent.click(screen.getByLabelText('Dùng chung'));
    await userEvent.type(screen.getByLabelText('Lý do'), 'In hồ sơ thầu');
    await userEvent.click(screen.getByRole('button', { name: 'Xuất kho' }));
    await vi.waitFor(() => expect(screen.getByLabelText('Số lượng')).toHaveAccessibleDescription('Chỉ còn 2'));
  });

  it('"Dùng chung" → body không có recipient_sub', async () => {
    const fetchMock = stubApi(jsonResponse(201, { stock_qty: 2, movement_id: 'm-2' }));
    const onClose = vi.fn();
    wrap(<IssueDialog item={ITEM} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText('Số lượng'), '3');
    await userEvent.click(screen.getByLabelText('Dùng chung'));
    await userEvent.type(screen.getByLabelText('Lý do'), 'Máy in tầng 2');
    await userEvent.click(screen.getByRole('button', { name: 'Xuất kho' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const { body } = mutationCall(fetchMock, '/api/admin/items/i-1/issue');
    expect(body).toEqual({ qty: 3, reason: 'Máy in tầng 2' });
    expect(body).not.toHaveProperty('recipient_sub');
  });

  it('chọn người từ danh bạ → gửi recipient_sub; người đã khóa không chọn được', async () => {
    const fetchMock = stubApi(jsonResponse(201, { stock_qty: 4, movement_id: 'm-3' }));
    const onClose = vi.fn();
    wrap(<IssueDialog item={ITEM} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText('Số lượng'), '1');
    await userEvent.type(screen.getByLabelText('Lý do'), 'Người mới vào giữa kỳ');
    expect(screen.getByRole('button', { name: 'Xuất kho' })).toBeDisabled();
    expect(await screen.findByRole('button', { name: /Lê Văn Cường/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Trần Thị Bình/ }));
    expect(screen.getByText('Trần Thị Bình · Giám sát')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xuất kho' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mutationCall(fetchMock, '/api/admin/items/i-1/issue').body).toEqual({
      qty: 1,
      recipient_sub: 'u-binh',
      reason: 'Người mới vào giữa kỳ',
    });
  });
});
