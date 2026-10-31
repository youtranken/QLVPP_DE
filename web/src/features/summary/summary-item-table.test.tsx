import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, within } from '@/test/test-utils';
import { SummaryItemTable } from './summary-item-table';
import { stubSummaryApi } from './summary-fixtures';

function renderTable(props: { q?: string; lowOnly?: boolean } = {}) {
  renderWithI18n(
    <MemoryRouter>
      <SummaryItemTable ym="2026-11" q={props.q ?? ''} lowOnly={props.lowOnly ?? false} />
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

  it('lowOnly: chỉ món trong admin/stock/low hoặc stock_state=out', async () => {
    stubSummaryApi();
    renderTable({ lowOnly: true });
    expect(await screen.findByText('Giấy A4')).toBeInTheDocument();
    expect(screen.getByText('Bút bi xanh')).toBeInTheDocument();
    expect(screen.queryByText('Giấy note')).toBeNull();
    expect(screen.queryByText('Băng keo 2 mặt')).toBeNull();
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
});
