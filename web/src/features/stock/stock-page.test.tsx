import { describe, expect, it } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { callsTo, item, stubStockApi } from './stock-fixtures';

const LOW_BELL = {
  id: 'n-low',
  topic: 'low_stock',
  params: { name: 'Giấy A4', name_en: null, stock_qty: 6 },
  link: '/admin/stock?filter=low',
  created_at: '2026-11-12T03:00:00.000Z',
  read_at: '2026-11-12T04:00:00.000Z',
};

async function open(path = '/admin/stock', ready = 'Giấy A4', width = 1280) {
  mockViewport(width);
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

  it('?filter=out chỉ còn món Hết hàng (không lấy món untracked còn tồn)', async () => {
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
    expect(await screen.findByText('Không có món nào khớp', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent('?q=zzz');
    await userEvent.click(screen.getByRole('button', { name: 'Xem tất cả món' }));
    expect(await screen.findByText('Giấy A4', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('mỗi hàng một nút "Nhập mua" (không dấu …) + nút ⋯; "Xuất lẻ" trong menu vô hiệu khi tồn 0 (title "Hết hàng — nhập mua trước"), bật khi tồn 6', async () => {
    await open();
    expect(within(rowOf('Giấy A4')).getByRole('button', { name: 'Nhập mua' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /…$/ })).toBeNull();
    await userEvent.click(within(rowOf('Kẹp giấy')).getByRole('button', { name: 'Thao tác khác cho Kẹp giấy' }));
    const out = within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Xuất lẻ' });
    expect(out).toHaveAttribute('aria-disabled', 'true');
    expect(out).toHaveAttribute('title', 'Hết hàng — nhập mua trước');
    await userEvent.click(out);
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(rowOf('Giấy A4')).getByRole('button', { name: 'Thao tác khác cho Giấy A4' }));
    expect(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Xuất lẻ' })).not.toHaveAttribute('aria-disabled');
  });

  it('1280: "Nhập mua" là nút nhỏ trên hàng, không lặp trong ⋯', async () => {
    await open();
    expect(within(rowOf('Giấy A4')).getByRole('button', { name: 'Nhập mua' })).toBeVisible();
    await userEvent.click(within(rowOf('Giấy A4')).getByRole('button', { name: 'Thao tác khác cho Giấy A4' }));
    expect(within(screen.getByRole('menu')).queryByRole('menuitem', { name: 'Nhập mua' })).toBeNull();
  });

  it('390: không có nút "Nhập mua" trên hàng; "Nhập mua" là mục đầu của ⋯ và mở hộp nhập mua', async () => {
    await open('/admin/stock', 'Giấy A4', 390);
    expect(within(rowOf('Giấy A4')).queryByRole('button', { name: 'Nhập mua' })).toBeNull();
    await userEvent.click(within(rowOf('Giấy A4')).getByRole('button', { name: 'Thao tác khác cho Giấy A4' }));
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Nhập mua', 'Kiểm kê', 'Xuất lẻ', 'Sổ cái']);
    await userEvent.click(items[0]);
    expect(await screen.findByRole('dialog', { name: 'Nhập mua Giấy A4' })).toBeInTheDocument();
  });

  it('menu ⋯ dùng được bằng bàn phím: Enter mở và focus "Kiểm kê", ↓ sang "Xuất lẻ", Esc đóng và trả focus về nút; Enter trên "Kiểm kê" mở hộp "Kiểm kê Bút bi xanh"', async () => {
    await open();
    const more = within(rowOf('Bút bi xanh')).getByRole('button', { name: 'Thao tác khác cho Bút bi xanh' });
    expect(more).toHaveAttribute('aria-haspopup', 'menu');
    more.focus();
    await userEvent.keyboard('{Enter}');
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Kiểm kê' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Xuất lẻ' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Sổ cái' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Kiểm kê' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(more).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: 'Kiểm kê Bút bi xanh' })).toBeInTheDocument();
  });

  it('bấm ⋯ → "Xuất lẻ" mở hộp "Xuất lẻ Bút bi xanh"; ⋯ → "Sổ cái" và bấm tên món đều mở sổ cái', async () => {
    await open();
    await userEvent.click(within(rowOf('Bút bi xanh')).getByRole('button', { name: 'Thao tác khác cho Bút bi xanh' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Xuất lẻ' }));
    expect(await screen.findByRole('dialog', { name: 'Xuất lẻ Bút bi xanh' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(rowOf('Giấy A4')).getByRole('button', { name: 'Thao tác khác cho Giấy A4' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sổ cái' }));
    expect(await screen.findByRole('dialog', { name: 'Sổ cái Giấy A4' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Mở sổ cái Giấy A4' }));
    expect(await screen.findByRole('dialog', { name: 'Sổ cái Giấy A4' })).toBeInTheDocument();
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

  describe('Xem thêm (50 món một lần)', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => item({ id: `m-${i}`, name: `Món ${String(i + 1).padStart(3, '0')}` }));
    async function openMany(n: number) {
      mockViewport(1280);
      stubStockApi((url) => (url === '/api/admin/items' ? jsonResponse(200, many(n)) : undefined));
      renderApp(makeMe('admin'), '/admin/stock');
      await screen.findByText('Món 001');
    }

    it('50 món: hiện đủ 50, không có "Xem thêm"', async () => {
      await openMany(50);
      expect(screen.getByText('Món 050')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Xem thêm/ })).toBeNull();
    });

    it('51 món: hiện 50 + "Xem thêm (1 món nữa)"; bấm thì hiện món 51 và nút biến mất', async () => {
      await openMany(51);
      expect(screen.getByText('Món 050')).toBeInTheDocument();
      expect(screen.queryByText('Món 051')).toBeNull();
      expect(screen.getByText('Đang hiện 50/51 món')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Xem thêm (1 món nữa)' }));
      expect(screen.getByText('Món 051')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Xem thêm/ })).toBeNull();
    });

    it('tìm kiếm chạy trên mọi món, kể cả món chưa hiện (Món 051)', async () => {
      await openMany(51);
      await userEvent.click(screen.getByRole('searchbox', { name: 'Tìm theo tên món' }));
      await userEvent.paste('Món 051');
      expect(await screen.findByText('Món 051', {}, { timeout: 3000 })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Xem thêm/ })).toBeNull();
    });
  });
});
