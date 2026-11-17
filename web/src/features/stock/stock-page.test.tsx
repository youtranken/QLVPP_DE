import { describe, expect, it } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { callsTo, facts, item, stubStockApi } from './stock-fixtures';
import { expectFixedColumns } from '@/test/fixed-columns';

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
  it('tải tồn lỗi → báo lỗi kèm "Thử lại", trang vẫn giữ tiêu đề Tủ / Kho', async () => {
    mockViewport(1280);
    stubStockApi((url) => (url.split('?')[0] === '/api/admin/stock' ? jsonResponse(500, { code: 'X', message: 'x' }) : undefined));
    renderApp(makeMe('admin'), '/admin/stock');
    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Tủ / Kho' })).toBeInTheDocument();
  });

  it('đúng một h1 "Tủ / Kho" + liên kết "Sản phẩm"; không còn liên kết "Hàng NCC về? → Hàng về"', async () => {
    await open();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Tủ / Kho' })).toBeInTheDocument();
    const main = within(screen.getByRole('main'));
    expect(screen.queryByRole('link', { name: /Hàng ADM về/ })).toBeNull();
    expect(main.getByRole('link', { name: 'Sản phẩm' })).toHaveAttribute('href', '/admin/catalog');
  });

  it('một hàng chip lọc có số (G5): Tất cả 6 (ẩn món ngừng tủ 0), Thiếu kỳ này 2, Sắp hết 1, Hết 1', async () => {
    await open();
    expect(screen.getByRole('radio', { name: /Tất cả/ })).toHaveTextContent('6');
    expect(screen.queryByRole('button', { name: /Thiếu cho người chờ/ })).toBeNull();
    expect(screen.getByRole('radio', { name: /Thiếu kỳ này/ })).toHaveTextContent('2');
    expect(screen.getByRole('radio', { name: /Sắp hết/ })).toHaveTextContent('1');
    expect(screen.getByRole('radio', { name: /^Hết/ })).toHaveTextContent('1');
    expect(screen.queryByText('Bút xóa cũ')).toBeNull();
    expect(within(screen.getByRole('radiogroup', { name: 'Lọc theo tình trạng tồn' })).getAllByRole('radio')).toHaveLength(4);
  });

  it('bấm "Sắp hết" → ?filter=low, lựa chọn aria-checked; bấm "Tất cả" → bỏ lọc', async () => {
    await open();
    await userEvent.click(screen.getByRole('radio', { name: /Sắp hết/ }));
    expect(screen.getByTestId('location-search')).toHaveTextContent('?filter=low');
    expect(screen.getByRole('radio', { name: /Sắp hết/ })).toHaveAttribute('aria-checked', 'true');
    expectFixedColumns(screen.getByRole('table'));
    await userEvent.click(screen.getByRole('radio', { name: /Tất cả/ }));
    expect(screen.getByTestId('location-search')).toBeEmptyDOMElement();
    expect(screen.getByRole('radio', { name: /Sắp hết/ })).toHaveAttribute('aria-checked', 'false');
  });

  it('?filter=incoming chỉ còn món có người chờ mà tủ chưa đủ, thẻ bật; "Xóa lọc" trả đủ món', async () => {
    await open('/admin/stock?filter=incoming', 'Bìa còng');
    expect(screen.queryByText('Giấy A4')).toBeNull();
    expect(screen.getByText('Bút chì')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Thiếu kỳ này/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/Đang lọc: Thiếu kỳ này · 2/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    expect(await screen.findByText('Giấy A4')).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toBeEmptyDOMElement();
  });

  it('?filter=out (URL cũ "Hết hàng") → Tất cả, tham số bị gỡ (replace)', async () => {
    await open('/admin/stock?filter=out');
    expect(screen.getByText('Bìa còng')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Tất cả/ })).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(screen.getByTestId('location-search')).toBeEmptyDOMElement());
  });

  it('bấm thẻ Hết đặt URL ?filter=none; bấm "Tất cả" bỏ lọc', async () => {
    await open();
    await userEvent.click(screen.getByRole('radio', { name: /^Hết/ }));
    expect(screen.getByTestId('location-search')).toHaveTextContent('?filter=none');
    expect(screen.queryByText('Giấy A4')).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: /Tất cả/ }));
    expect(screen.getByTestId('location-search')).toBeEmptyDOMElement();
  });

  it('bấm thông báo sắp hết trên chuông khi đang ở /admin/stock → ?filter=low', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: /^Thông báo/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Giấy A4 sắp hết kho/ }));
    expect(screen.getByRole('radio', { name: /Sắp hết/ })).toHaveAttribute('aria-checked', 'true');
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

  it('menu ⋯ dùng được bằng bàn phím: Enter mở và focus "Xuất lẻ", ↓ sang "Lịch sử nhập xuất", Esc đóng và trả focus về nút; Enter trên "Xuất lẻ" mở hộp "Xuất lẻ Bút bi xanh"', async () => {
    await open();
    const more = within(rowOf('Bút bi xanh')).getByRole('button', { name: 'Thao tác khác cho Bút bi xanh' });
    expect(more).toHaveAttribute('aria-haspopup', 'menu');
    more.focus();
    await userEvent.keyboard('{Enter}');
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Xuất lẻ' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Lịch sử nhập xuất' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Nhập ngoài kỳ (tự mua lẻ)' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Xuất lẻ' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(more).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: 'Xuất lẻ Bút bi xanh' })).toBeInTheDocument();
  });

  it('bấm ⋯ → "Xuất lẻ" mở hộp "Xuất lẻ Bút bi xanh"; ⋯ → "Lịch sử nhập xuất" và bấm tên món đều mở lịch sử', async () => {
    await open();
    await userEvent.click(within(rowOf('Bút bi xanh')).getByRole('button', { name: 'Thao tác khác cho Bút bi xanh' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Xuất lẻ' }));
    expect(await screen.findByRole('dialog', { name: 'Xuất lẻ Bút bi xanh' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(rowOf('Giấy A4')).getByRole('button', { name: 'Thao tác khác cho Giấy A4' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Lịch sử nhập xuất' }));
    expect(await screen.findByRole('dialog', { name: 'Lịch sử nhập xuất Giấy A4' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Xem lịch sử nhập xuất Giấy A4' }));
    expect(await screen.findByRole('dialog', { name: 'Lịch sử nhập xuất Giấy A4' })).toBeInTheDocument();
  });

  it('lỗi tải Tủ/Kho → "Thử lại" gọi lại; thành công thì hiện bảng', async () => {
    mockViewport(1280);
    let fail = true;
    const f = stubStockApi((url) => (fail && url === '/api/admin/stock' ? jsonResponse(500, { code: 'X' }) : undefined));
    renderApp(makeMe('admin'), '/admin/stock');
    expect(await screen.findByText('Không tải được dữ liệu — thử lại.')).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Giấy A4')).toBeInTheDocument();
    await waitFor(() => expect(callsTo(f, '/api/admin/stock').length).toBeGreaterThan(1));
  });

  describe('Xem thêm (50 món một lần)', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => item({ id: `m-${i}`, name: `Món ${String(i + 1).padStart(3, '0')}` }));
    async function openMany(n: number) {
      mockViewport(1280);
      stubStockApi((url) =>
        url === '/api/admin/items'
          ? jsonResponse(200, many(n))
          : url === '/api/admin/stock'
            ? jsonResponse(200, many(n).map((m) => facts(m.id)))
            : undefined,
      );
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
  describe('G6: Xuất lẻ thành trang riêng', () => {
    it('không còn bộ chuyển "Trong tủ / Xuất lẻ" trên Tủ / Kho', async () => {
      await open();
      expect(screen.queryByRole('radio', { name: 'Xuất lẻ' })).toBeNull();
      expect(screen.queryByRole('radiogroup', { name: 'Chế độ xem Kho' })).toBeNull();
    });

    it('link cũ /admin/stock?tab=issues&ym=2026-10 → chuyển sang /admin/issues?ym=2026-10', async () => {
      mockViewport(1280);
      stubStockApi((url) => (url.startsWith('/api/admin/issues') ? jsonResponse(200, []) : undefined));
      renderApp(makeMe('admin'), '/admin/stock?tab=issues&ym=2026-10');
      expect(await screen.findByRole('heading', { level: 1, name: 'Xuất lẻ' })).toBeInTheDocument();
      expect(screen.getByTestId('location-search')).toHaveTextContent('?ym=2026-10');
    });
  });
});
