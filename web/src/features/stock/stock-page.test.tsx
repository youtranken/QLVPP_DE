import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { callsTo, facts, item, stubStockApi } from './stock-fixtures';

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
  it('tải tồn lỗi: vẫn có bộ chuyển Tồn kho/Xuất lẻ (1280 và 390) để sang tab Xuất lẻ', async () => {
    for (const width of [1280, 390]) {
      mockViewport(width);
      stubStockApi((url) => {
        const path = url.split('?')[0];
        if (path === '/api/admin/stock') return jsonResponse(500, { code: 'X', message: 'x' });
        return path === '/api/admin/issues' ? jsonResponse(200, []) : undefined;
      });
      const { unmount } = renderApp(makeMe('admin'), '/admin/stock');
      expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('radio', { name: 'Xuất lẻ' }));
      expect(await screen.findByRole('button', { name: 'Xuất lẻ một món' })).toBeInTheDocument();
      unmount();
    }
  });

  it('đúng một h1 "Tủ / Kho" + liên kết "Sản phẩm"; không còn liên kết "Hàng NCC về? → Hàng về"', async () => {
    await open();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Tủ / Kho' })).toBeInTheDocument();
    const main = within(screen.getByRole('main'));
    expect(screen.queryByRole('link', { name: /Hàng ADM về/ })).toBeNull();
    expect(main.getByRole('link', { name: 'Sản phẩm' })).toHaveAttribute('href', '/admin/catalog');
  });

  it('một hàng chip lọc có số: Tất cả 6 (ẩn món ngừng tủ 0), Chờ hàng về 2 (gộp thiếu cho người chờ), Sắp hết 1, Không có 1', async () => {
    await open();
    expect(screen.getByRole('button', { name: /Tất cả/ })).toHaveTextContent('6');
    expect(screen.queryByRole('button', { name: /Thiếu cho người chờ/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Chờ hàng về/ })).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: /Sắp hết/ })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /Không có/ })).toHaveTextContent('1');
    expect(screen.queryByText('Bút xóa cũ')).toBeNull();
    expect(within(screen.getByRole('group', { name: 'Lọc theo tình trạng tồn' })).getAllByRole('button')).toHaveLength(4);
  });

  it('bấm "Sắp hết" → ?filter=low, chip aria-pressed; bấm lại → bỏ lọc', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: /Sắp hết/ }));
    expect(screen.getByTestId('location-search')).toHaveTextContent('?filter=low');
    expect(screen.getByRole('button', { name: /Sắp hết/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /Sắp hết/ }));
    expect(screen.getByTestId('location-search')).toBeEmptyDOMElement();
    expect(screen.getByRole('button', { name: /Sắp hết/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('?filter=incoming chỉ còn món có người chờ mà tủ chưa đủ, thẻ bật; "Bỏ lọc" trả đủ món', async () => {
    await open('/admin/stock?filter=incoming', 'Bìa còng');
    expect(screen.queryByText('Giấy A4')).toBeNull();
    expect(screen.getByText('Bút chì')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chờ hàng về/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Đang lọc: Chờ hàng về · 2/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc' }));
    expect(await screen.findByText('Giấy A4')).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toBeEmptyDOMElement();
  });

  it('?filter=out (URL cũ "Hết hàng") → Tất cả, tham số bị gỡ (replace)', async () => {
    await open('/admin/stock?filter=out');
    expect(screen.getByText('Bìa còng')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tất cả/ })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.getByTestId('location-search')).toBeEmptyDOMElement());
  });

  it('bấm thẻ Không có đặt URL ?filter=none; bấm "Tất cả" bỏ lọc', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: /Không có/ }));
    expect(screen.getByTestId('location-search')).toHaveTextContent('?filter=none');
    expect(screen.queryByText('Giấy A4')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Tất cả/ }));
    expect(screen.getByTestId('location-search')).toBeEmptyDOMElement();
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
  describe('tab Xuất lẻ', () => {
    const ISSUE = {
      id: 'm-1',
      item_id: 'i-1',
      item_name: 'Giấy A4',
      item_name_en: null,
      unit: 'ram',
      qty: 1,
      recipient_sub: 'u-binh',
      recipient_name: 'Trần Thị Bình',
      note: null,
      actor_sub: 'u-hc',
      created_at: '2026-11-03T03:00:00.000Z',
    };
    const issuesApi = (url: string) => {
      if (url.startsWith('/api/admin/issues')) return jsonResponse(200, url.endsWith('2026-10') ? [] : [ISSUE]);
      if (url === '/api/periods/current') return jsonResponse(200, { ym: '2026-11' });
      return undefined;
    };

    async function openIssues(path: string) {
      mockViewport(1280);
      const f = stubStockApi(issuesApi);
      renderApp(makeMe('admin'), path);
      await screen.findByText(/lần xuất/);
      return f;
    }

    it('tab Xuất lẻ đổi URL và hiện bảng xuất lẻ', async () => {
      mockViewport(1280);
      stubStockApi(issuesApi);
      renderApp(makeMe('admin'), '/admin/stock');
      await screen.findByText('Giấy A4');
      expect(screen.getByRole('radio', { name: 'Tồn kho' })).toBeChecked();
      await userEvent.click(screen.getByRole('radio', { name: 'Xuất lẻ' }));
      expect(screen.getByTestId('location-search')).toHaveTextContent('?tab=issues');
      expect(await screen.findByText('Trần Thị Bình')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Người nhận' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('radio', { name: 'Tồn kho' }));
      expect(screen.getByTestId('location-search')).toBeEmptyDOMElement();
      expect(await screen.findByText('Giấy A4')).toBeInTheDocument();
    });

    it('?tab=issues&ym=2026-10: radio Xuất lẻ đang chọn, API gọi với ym=2026-10', async () => {
      const f = await openIssues('/admin/stock?tab=issues&ym=2026-10');
      expect(screen.getByRole('radio', { name: 'Xuất lẻ' })).toBeChecked();
      expect(callsTo(f, '/api/admin/issues?ym=2026-10')).toHaveLength(1);
    });

    it('thiếu ym thì lấy THÁNG LỊCH hiện tại (giờ VN), không phải kỳ đăng ký đang mở: 25/11 với kỳ mở là 2026-12 → ym=2026-11', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-25T03:00:00Z') });
      try {
        const f = stubStockApi((url) => (url === '/api/periods/current' ? jsonResponse(200, { ym: '2026-12', registration_last_day: 10 }) : issuesApi(url)));
        mockViewport(1280);
        renderApp(makeMe('admin'), '/admin/stock?tab=issues');
        await screen.findByText(/lần xuất/);
        expect(callsTo(f, '/api/admin/issues?ym=2026-11')).toHaveLength(1);
        expect(callsTo(f, '/api/admin/issues?ym=2026-12')).toHaveLength(0);
        expect(screen.getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('tab Xuất lẻ có nút chính "Xuất lẻ một món" → hộp chọn món, chọn Giấy A4 thì hiện tồn 6 ram', async () => {
      await openIssues('/admin/stock?tab=issues');
      await userEvent.click(screen.getByRole('button', { name: 'Xuất lẻ một món' }));
      const dialog = await screen.findByRole('dialog', { name: /^Xuất lẻ/ });
      const pick = within(dialog).getByRole('combobox', { name: /^Món/ });
      expect(within(pick).queryByRole('option', { name: 'Kẹp giấy' })).toBeNull();
      await userEvent.selectOptions(pick, within(pick).getByRole('option', { name: 'Giấy A4' }));
      expect(within(dialog).getByText('Tồn hiện tại 6 ram')).toBeInTheDocument();
    });

    it('tab lạ rơi về Tồn kho', async () => {
      await open('/admin/stock?tab=zzz');
      expect(screen.getByRole('radio', { name: 'Tồn kho' })).toBeChecked();
    });
  });
});
