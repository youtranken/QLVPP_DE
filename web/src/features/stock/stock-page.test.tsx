import { describe, expect, it } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { callsTo, stubStockApi } from './stock-fixtures';

const LOW_BELL = {
  id: 'n-low',
  topic: 'low_stock',
  params: { name: 'Giấy A4', name_en: null, stock_qty: 6 },
  link: '/admin/stock?filter=low',
  created_at: '2026-11-12T03:00:00.000Z',
  read_at: '2026-11-12T04:00:00.000Z',
};

async function open(path = '/admin/stock', ready = 'Giấy A4') {
  mockViewport(1280);
  const f = stubStockApi((url) =>
    url.startsWith('/api/me/notifications') ? jsonResponse(200, { items: [LOW_BELL], next_cursor: null, unread_count: 0 }) : undefined,
  );
  renderApp(makeMe('admin'), path);
  await screen.findByText(ready);
  return f;
}

const rowOf = (name: string) => screen.getByText(name).closest('tr')!;

describe('StockPage', () => {
  it('đúng một h1 "Kho" + mô tả + liên kết "Danh mục"', async () => {
    await open();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Kho' })).toBeInTheDocument();
    expect(screen.getByText(/Giao hàng tự trừ tồn/)).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Danh mục' })).toHaveAttribute('href', '/admin/catalog');
  });

  it('thẻ: Đang theo dõi 4 món (ẩn món ngừng), Sắp hết 1, Hết hàng 1, Còn nợ "7 đơn vị · 2 món" (bỏ dòng ngoài danh mục), thẻ Còn nợ không bấm được', async () => {
    await open();
    expect(screen.getByRole('button', { name: /Đang theo dõi/ })).toHaveTextContent('4');
    expect(screen.getByRole('button', { name: /Sắp hết/ })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /Hết hàng/ })).toHaveTextContent('1');
    const owed = screen.getByText('Còn nợ', { selector: '.stat-card__k' }).closest('.stat-card')!;
    expect(owed).toHaveTextContent(/^Còn nợ7đơn vị2 món$/);
    expect(screen.queryByRole('button', { name: /Còn nợ/ })).toBeNull();
    expect(screen.queryByText('Bút xóa cũ')).toBeNull();
  });

  it('badge: Hết hàng / Sắp hết / Đủ dùng; không nhãn khi chưa theo dõi (untracked)', async () => {
    await open();
    expect(within(rowOf('Giấy A4')).getByText('Sắp hết')).toBeInTheDocument();
    expect(within(rowOf('Kẹp giấy')).getByText('Hết hàng')).toBeInTheDocument();
    expect(within(rowOf('Bút bi xanh')).getByText('Đủ dùng')).toBeInTheDocument();
    const never = rowOf('Ghim bấm');
    for (const label of ['Sắp hết', 'Hết hàng', 'Đủ dùng']) expect(within(never).queryByText(label)).toBeNull();
  });

  it('cột Còn nợ: số khi > 0, "—" khi 0', async () => {
    await open();
    expect(within(rowOf('Giấy A4')).getByText('4')).toBeInTheDocument();
    expect(within(rowOf('Giấy A4')).queryByText('—')).toBeNull();
    expect(within(rowOf('Kẹp giấy')).getByText('—')).toBeInTheDocument();
  });

  it('?filter=low chỉ còn món Sắp hết, hiện "Đang lọc", thẻ bật; bấm "Bỏ lọc" trả đủ món', async () => {
    await open('/admin/stock?filter=low');
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
    expect(screen.queryByText('Kẹp giấy')).toBeNull();
    expect(screen.getByRole('button', { name: /Sắp hết/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Đang lọc: Sắp hết · 1/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc' }));
    expect(await screen.findByText('Bút bi xanh')).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent('');
  });

  it('?filter=out chỉ còn món Hết hàng (không lấy món untracked tồn 0)', async () => {
    await open('/admin/stock?filter=out', 'Kẹp giấy');
    expect(screen.getByText('Kẹp giấy')).toBeInTheDocument();
    expect(screen.queryByText('Ghim bấm')).toBeNull();
  });

  it('bấm thẻ Hết hàng đặt URL ?filter=out; bấm "Đang theo dõi" bỏ lọc', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: /Hết hàng/ }));
    expect(screen.getByTestId('location-search')).toHaveTextContent('?filter=out');
    await userEvent.click(screen.getByRole('button', { name: /Đang theo dõi/ }));
    expect(screen.getByTestId('location-search')).toHaveTextContent('');
  });

  it('bấm thông báo sắp hết trên chuông khi đang ở /admin/stock → ?filter=low', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: /^Thông báo/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Giấy A4 sắp hết kho/ }));
    expect(screen.getByRole('button', { name: /Sắp hết/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
  });

  it('tìm theo tên món ghi lên URL ?q=; không khớp → trạng thái rỗng kèm "Xem tất cả món"', async () => {
    await open();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm theo tên món' }), 'zzz');
    expect(await screen.findByText('Không có món nào khớp')).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent('?q=zzz');
    await userEvent.click(screen.getByRole('button', { name: 'Xem tất cả món' }));
    expect(await screen.findByText('Giấy A4')).toBeInTheDocument();
  });

  it('"Xuất lẻ…" vô hiệu khi tồn 0 (title "Hết hàng — nhập mua trước"), bật khi tồn 6', async () => {
    await open();
    const out = within(rowOf('Kẹp giấy')).getByRole('button', { name: 'Xuất lẻ…' });
    expect(out).toBeDisabled();
    expect(out).toHaveAttribute('title', 'Hết hàng — nhập mua trước');
    expect(within(rowOf('Giấy A4')).getByRole('button', { name: 'Xuất lẻ…' })).toBeEnabled();
  });

  it('bấm "Xuất lẻ…" mở hộp "Xuất lẻ Bút bi xanh"; bấm tên món mở sổ cái', async () => {
    await open();
    await userEvent.click(within(rowOf('Bút bi xanh')).getByRole('button', { name: 'Xuất lẻ…' }));
    expect(await screen.findByRole('dialog', { name: 'Xuất lẻ Bút bi xanh' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Mở sổ cái Giấy A4' }));
    expect(await screen.findByRole('dialog', { name: 'Sổ cái · Giấy A4' })).toBeInTheDocument();
  });

  it('lỗi tải → "Thử lại" gọi lại items; thành công thì hiện bảng', async () => {
    mockViewport(1280);
    let fail = true;
    const f = stubStockApi((url) => (fail && url === '/api/admin/items' ? jsonResponse(500, { code: 'X' }) : undefined));
    renderApp(makeMe('admin'), '/admin/stock');
    expect(await screen.findByText('Không tải được dữ liệu — thử lại.')).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Giấy A4')).toBeInTheDocument();
    await waitFor(() => expect(callsTo(f, '/api/admin/items').length).toBeGreaterThan(1));
  });
});
