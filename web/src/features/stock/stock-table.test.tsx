import { describe, expect, it } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { facts, STOCK, stubStockApi } from './stock-fixtures';

async function open(width = 1280, stock = STOCK) {
  mockViewport(width);
  stubStockApi((url) => (url === '/api/admin/stock' ? jsonResponse(200, stock) : undefined));
  renderApp(makeMe('admin'), '/admin/stock');
  await screen.findByText('Giấy A4');
}

const rowOf = (name: string) => screen.getByText(name).closest('tr')!;
const cells = (name: string) => within(rowOf(name)).getAllByRole('cell').map((c) => c.textContent);

describe('StockTable — Tủ/Kho theo người đang chờ', () => {
  it('G5: cột Trong tủ · Mức đặt lại · Tình trạng · Cần thêm; không còn Đang giữ / Còn trống / Còn nợ', async () => {
    await open();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(expect.arrayContaining(['Trong tủ', 'Mức đặt lại', 'Tình trạng', 'Cần thêm']));
    for (const gone of ['Đang giữ cho người chờ', 'Còn trống', 'Còn nợ']) expect(headers).not.toContain(gone);
    expect(cells('Giấy A4')).toEqual(expect.arrayContaining(['6', '30', 'Sắp hết']));
    expect(within(rowOf('Ghim bấm')).getAllByRole('cell').some((c) => /^—/.test(c.textContent ?? ''))).toBe(true);
  });

  it('G5 Cần thêm = phần thiếu sau khi trừ hàng đang về: Bìa còng 3; Bút chì (về đủ bù) "—"', async () => {
    await open();
    expect(cells('Bìa còng')).toEqual(expect.arrayContaining(['3']));
    expect(cells('Bút chì').at(-2)).toMatch(/^—/);
  });

  it('tình trạng: Thiếu kỳ này 3 · Thiếu kỳ này 5 (title "Hàng đang về 5") · Hết · Không theo dõi · Còn 7; không chữ "Đủ dùng"', async () => {
    await open();
    expect(within(rowOf('Bìa còng')).getByText('Thiếu kỳ này 3')).toHaveAttribute('title', 'Thiếu 3 cho người chờ');
    expect(within(rowOf('Bút chì')).getByText('Thiếu kỳ này 5')).toHaveAttribute('title', 'Hàng đang về 5');
    expect(within(rowOf('Kẹp giấy')).getByText('Hết')).toBeInTheDocument();
    expect(within(rowOf('Ghim bấm')).getByText('Không theo dõi')).toBeInTheDocument();
    expect(within(rowOf('Bút bi xanh')).getByText('Còn 7')).toBeInTheDocument();
    expect(screen.queryByText('Đủ dùng')).toBeNull();
    expect(screen.queryByText('Hết hàng')).toBeNull();
  });

  it('"Thiếu kỳ này n" luôn đỏ, kể cả khi hàng NCC về đủ bù; tủ 0 không ai cần không đỏ', async () => {
    await open();
    const red = document.querySelectorAll('tbody .tag--danger');
    expect([...red].map((t) => t.textContent)).toEqual(expect.arrayContaining(['Thiếu kỳ này 3', 'Thiếu kỳ này 5']));
    expect([...red].every((t) => t.textContent?.startsWith('Thiếu kỳ này'))).toBe(true);
  });

  it('dòng không có nút "Nhập mua"; ⋯ = Xuất lẻ · Lịch sử nhập xuất · Nhập ngoài kỳ (tự mua lẻ) (không còn Kiểm kê) và mở hộp cùng tiêu đề', async () => {
    await open();
    expect(screen.queryByRole('button', { name: 'Nhập mua' })).toBeNull();
    await userEvent.click(within(rowOf('Giấy A4')).getByRole('button', { name: 'Thao tác khác cho Giấy A4' }));
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Xuất lẻ', 'Lịch sử nhập xuất', 'Nhập ngoài kỳ (tự mua lẻ)']);
    await userEvent.click(items[2]);
    expect(await screen.findByRole('dialog', { name: 'Nhập ngoài kỳ (tự mua lẻ) Giấy A4' })).toBeInTheDocument();
  });

  it('390: cùng menu ⋯, không nút nào khác trên hàng', async () => {
    await open(390);
    expect(within(rowOf('Giấy A4')).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Xem lịch sử nhập xuất Giấy A4',
      'Thao tác khác cho Giấy A4',
    ]);
  });

  it('"Xuất lẻ" trong ⋯ vô hiệu khi tủ 0 (lý do "Hết hàng — nhập mua trước" hiện dưới mục), bật khi tủ 6', async () => {
    await open();
    await userEvent.click(within(rowOf('Kẹp giấy')).getByRole('button', { name: 'Thao tác khác cho Kẹp giấy' }));
    const out = within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Xuất lẻ' });
    expect(out).toHaveAttribute('aria-disabled', 'true');
    expect(out).toHaveAccessibleDescription('Hết hàng — nhập mua trước');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(rowOf('Giấy A4')).getByRole('button', { name: 'Thao tác khác cho Giấy A4' }));
    expect(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Xuất lẻ' })).not.toHaveAttribute('aria-disabled');
  });

  it('món tạm ngưng còn tủ 2 vẫn hiện, tình trạng "Tạm ngưng" (không nhãn ngừng trùng ở tên)', async () => {
    await open(1280, STOCK.map((f) => (f.item_id === 'i-3' ? facts('i-3', { stock_qty: 2, free: 2 }) : f)));
    expect(within(rowOf('Bút xóa cũ')).getByText('Tạm ngưng')).toHaveClass('tag');
    expect(within(rowOf('Bút xóa cũ')).queryByText('Ngừng riêng')).toBeNull();
  });

  it('món tạm ngưng còn người chờ: "Thiếu kỳ này 2" đỏ (NCC không giao thêm) kèm nhãn trung tính "Tạm ngưng"', async () => {
    await open(1280, STOCK.map((f) => (f.item_id === 'i-3' ? facts('i-3', { stock_qty: 0, free: 0, held: 2, awaiting: 2, waiting: 1, stock_state: 'incoming' }) : f)));
    const row = within(rowOf('Bút xóa cũ'));
    expect(row.getByText('Thiếu kỳ này 2')).toHaveClass('tag--danger');
    expect(row.getByText('Tạm ngưng')).toHaveClass('tag', 'tag--outline');
  });
});
