import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, within } from '@/test/test-utils';
import { SummaryItemTable } from './summary-item-table';
import { SUMMARY_ITEMS, stubSummaryApi } from './summary-fixtures';

function renderTable(props: { q?: string; lowOnly?: boolean; item?: string; onClearItem?: () => void } = {}) {
  renderWithI18n(
    <MemoryRouter>
      <SummaryItemTable ym="2026-11" q={props.q ?? ''} lowOnly={props.lowOnly ?? false} item={props.item ?? null} onClearItem={props.onClearItem ?? (() => undefined)} />
    </MemoryRouter>,
  );
}

const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr')!;
const rowTexts = () => screen.getAllByRole('row').map((r) => r.textContent ?? '');

afterEach(() => vi.unstubAllGlobals());

describe('SummaryItemTable — bảng theo món', () => {
  it('nhóm theo danh mục theo sort_order, "Ngoài danh mục" cuối; tiêu đề "{n} món · {k} sắp hết/hết hàng"', async () => {
    stubSummaryApi();
    renderTable();
    await screen.findByText('Giấy note');
    const rows = rowTexts();
    const at = (s: string) => rows.findIndex((r) => r.includes(s));
    expect(at('Bút & viết')).toBeLessThan(at('Bút bi xanh'));
    expect(at('Bút bi xanh')).toBeLessThan(at('Giấy'));
    expect(at('Giấy A4')).toBeLessThan(at('Ngoài danh mục'));
    expect(at('Ngoài danh mục')).toBeLessThan(at('Băng keo 2 mặt'));
    expect(screen.getByRole('rowheader', { name: /^Giấy/ })).toHaveTextContent('2 món · 1 sắp hết/hết hàng');
    expect(screen.getByRole('rowheader', { name: /^Bút & viết/ })).toHaveTextContent('1 món · 1 sắp hết/hết hàng');
  });

  it('trong nhóm theo thứ tự món chung (sort_order món), không theo thứ tự trả về: "Giấy note" (10) trước "Giấy A4" (20)', async () => {
    const items = SUMMARY_ITEMS.map((i) => ({ ...i, sort_order: i.id === 'i-note' ? 10 : 20 }));
    stubSummaryApi((url) => (url === '/api/admin/items' ? jsonResponse(200, items) : undefined));
    renderTable();
    await screen.findByText('Giấy note');
    const rows = rowTexts();
    expect(rows.findIndex((r) => r.includes('Giấy note'))).toBeLessThan(rows.findIndex((r) => r.includes('Giấy A4')));
  });

  it('liên kết "Xem số cần mua ở Báo cáo" → /admin/reports?ym=2026-11; không có cột "Cần mua thêm" (G4)', async () => {
    stubSummaryApi();
    renderTable();
    expect(await screen.findByRole('link', { name: 'Xem số cần mua ở Báo cáo' })).toHaveAttribute('href', '/admin/reports?ym=2026-11');
    expect(screen.queryByRole('columnheader', { name: /Cần mua/ })).toBeNull();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Món', 'ĐVT', 'SL đăng ký', 'Số người', 'Tồn kho']);
  });

  it('cột: SL đăng ký, số người, tồn + badge "Sắp hết"/"Hết hàng"; badge "Chỉ Hành chính"; ngoài DM tồn "—"', async () => {
    stubSummaryApi();
    renderTable();
    const a4 = await rowOf('Giấy A4');
    expect(a4).toHaveTextContent('25');
    expect(a4).toHaveTextContent('9');
    expect(within(a4).getByText('Sắp hết')).toBeInTheDocument();
    expect(within(a4).getByText('Chỉ Hành chính')).toBeInTheDocument();
    expect(within(await rowOf('Bút bi xanh')).getByText('Hết hàng')).toBeInTheDocument();
    const note = await rowOf('Giấy note');
    expect(within(note).queryByText(/Sắp hết|Hết hàng/)).toBeNull();
    expect(note).toHaveTextContent('50');
    const tape = await rowOf('Băng keo 2 mặt');
    expect(within(tape).getAllByRole('cell').at(-1)).toHaveTextContent('—');
  });

  it('Tủ "Chờ hàng về" (stock_state incoming) → nhãn "Chờ hàng về", không "Sắp hết"/"Hết hàng"; không vào lọc sắp hết/hết hàng', async () => {
    const items = SUMMARY_ITEMS.map((i) => (i.id === 'i-pen' ? { ...i, stock_state: 'incoming' as const } : i));
    stubSummaryApi((url) => (url === '/api/admin/items' ? jsonResponse(200, items) : undefined));
    renderTable();
    const pen = await rowOf('Bút bi xanh');
    expect(within(pen).getByText('Chờ hàng về')).toBeInTheDocument();
    expect(within(pen).queryByText(/Sắp hết|Hết hàng/)).toBeNull();
    expect(screen.getByRole('rowheader', { name: /^Bút & viết/ })).not.toHaveTextContent('sắp hết/hết hàng');
  });

  it('lowOnly: chỉ món dùng được có stock_state low hoặc out', async () => {
    stubSummaryApi();
    renderTable({ lowOnly: true });
    expect(await screen.findByText('Giấy A4')).toBeInTheDocument();
    expect(screen.getByText('Bút bi xanh')).toBeInTheDocument();
    expect(screen.queryByText('Giấy note')).toBeNull();
    expect(screen.queryByText('Băng keo 2 mặt')).toBeNull();
  });

  it('lowOnly khớp ô "Hết hàng / sắp hết": món thuộc nhóm đang ngừng (usable=false) không vào danh sách', async () => {
    const paused = SUMMARY_ITEMS.map((i) => (i.id === 'i-a4' || i.id === 'i-pen' ? { ...i, usable: false } : i));
    stubSummaryApi((url) => (url === '/api/admin/items' ? jsonResponse(200, paused) : undefined));
    renderTable({ lowOnly: true });
    expect(await screen.findByText('Không có món nào khớp')).toBeInTheDocument();
    expect(screen.queryByText('Giấy A4')).toBeNull();
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
  });

  it('tìm theo tên bỏ dấu ở phía trang: "giay" khớp "Giấy A4", "Giấy note"', async () => {
    stubSummaryApi();
    renderTable({ q: 'giay' });
    expect(await screen.findByText('Giấy A4')).toBeInTheDocument();
    expect(screen.getByText('Giấy note')).toBeInTheDocument();
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
  });

  it('món có category_id không còn trong danh sách nhóm → nhóm "Chưa xếp nhóm", không crash', async () => {
    stubSummaryApi((url) => (url === '/api/item-categories?all=1' ? jsonResponse(200, []) : undefined));
    renderTable();
    expect(await screen.findByRole('rowheader', { name: /^Chưa xếp nhóm/ })).toHaveTextContent('3 món');
  });

  it('?item= (từ Gửi ADM "Xem ai đăng ký"): chỉ hàng của món đó, kèm nút "Chỉ món: Giấy A4" đang bật; bấm → bỏ lọc', async () => {
    stubSummaryApi();
    const clear = vi.fn();
    renderTable({ item: 'i-a4', onClearItem: clear });
    expect(await screen.findByText('Giấy A4')).toBeInTheDocument();
    expect(screen.queryByText('Giấy note')).toBeNull();
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
    const chip = screen.getByRole('button', { name: 'Chỉ món: Giấy A4' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(chip);
    expect(clear).toHaveBeenCalledOnce();
  });

  it('?item= không khớp món nào của kỳ → bảng trống "Không có món nào khớp", vẫn có nút bỏ lọc', async () => {
    stubSummaryApi();
    renderTable({ item: 'i-gone' });
    expect(await screen.findByText('Không có món nào khớp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Chỉ món/ })).toBeInTheDocument();
  });
});
