import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { PERIOD } from '@/test/request-api-stub';
import { SummaryPage } from './summary-page';
import type { PeriodSummary, PersonRow } from './summary.api';

const OPEN: PeriodSummary = {
  ym: '2026-11',
  deadline: '2026-11-10T17:00:00.000Z',
  is_open: true,
  registered: 32,
  headcount: 40,
  headcount_source: 'live',
  unregistered: 8,
  lines_pending_delivery: 118,
  custom_pending: 3,
  low_stock: 4,
};
const LOCKED: PeriodSummary = { ...OPEN, ym: '2026-10', is_open: false, headcount_source: 'snapshot', registered: 30, headcount: 38 };

const person = (over: Partial<PersonRow>): PersonRow => ({
  request_id: 'r-x',
  user_sub: 'u-x',
  full_name: 'Người',
  email: 'x@pmh.com.vn',
  department: 'Phòng Công trình',
  user_status: 'active',
  line_count: 3,
  total_qty: 7,
  delivered_qty: 0,
  custom_pending: 0,
  updated_at: '2026-11-05T07:20:00.000Z',
  ...over,
});
const PEOPLE = [
  person({ request_id: 'r-1', full_name: 'Phạm Văn Đức', delivered_qty: 4, custom_pending: 1 }),
  person({ request_id: 'r-2', full_name: 'Võ Thị Lan', user_status: 'locked', line_count: 2, total_qty: 4 }),
  person({ request_id: 'r-3', full_name: 'Trần Bình', department: null, line_count: 1, total_qty: 2 }),
];
const ITEMS = [{ key: 'i-1', item_id: 'i-1', name: 'Giấy A4', unit: 'ram', requested_qty: 25, people: 9 }];

function stub() {
  const fetchMock = vi.fn((url: string) => {
    if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
    const m = /^\/api\/admin\/periods\/(\d{4}-\d{2})\/(\w+)/.exec(url);
    if (m?.[2] === 'summary') return Promise.resolve(jsonResponse(200, m[1] === '2026-11' ? OPEN : LOCKED));
    if (m?.[2] === 'requests') {
      const body = url.includes('by=item') ? { items: ITEMS } : { items: PEOPLE, next_cursor: null };
      return Promise.resolve(jsonResponse(200, body));
    }
    return Promise.resolve(jsonResponse(200, { items: [] }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const requestUrls = (f: ReturnType<typeof stub>) =>
  f.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('/requests?'));

afterEach(() => vi.unstubAllGlobals());

describe('SummaryPage — Tổng hợp kỳ', () => {
  it('KPI "Phiếu đã đăng ký 32/40" tính hiện tại, nhãn "Đang mở · hạn 10/11", kỳ đang mở khóa nút tháng sau', async () => {
    mockViewport(1280);
    stub();
    renderApp(makeMe('admin'), '/admin/summary');
    const kpi = await screen.findByRole('button', { name: /Phiếu đã đăng ký/ });
    expect(kpi).toHaveTextContent('32/40');
    expect(kpi).toHaveTextContent('tính hiện tại · 8 chưa đăng ký');
    expect(screen.getByText('Đang mở · hạn 10/11')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tháng trước' })).toBeEnabled();
    expect(screen.getByText('Tháng 11/2026')).toBeInTheDocument();
  });

  it('bấm KPI "Dòng chờ giao" → gọi API filter=pending_delivery, ô được chọn, "Bỏ lọc" trả về tất cả', async () => {
    mockViewport(1280);
    const f = stub();
    renderApp(makeMe('admin'), '/admin/summary');
    const tile = await screen.findByRole('button', { name: /Dòng chờ giao/ });
    expect(tile).toHaveTextContent('118');
    expect(tile).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(tile);
    expect(tile).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(requestUrls(f).some((u) => u.includes('filter=pending_delivery'))).toBe(true));
    expect(screen.getByText('Đang lọc: Dòng chờ giao')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc' }));
    expect(tile).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Phiếu đã đăng ký/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('KPI món ngoài danh mục → /admin/review, món sắp hết → /admin/stock?filter=low', async () => {
    mockViewport(1280);
    stub();
    renderApp(makeMe('admin'), '/admin/summary');
    expect(await screen.findByRole('link', { name: /Món ngoài danh mục chờ xem/ })).toHaveAttribute('href', '/admin/review');
    const low = screen.getByRole('link', { name: /Món sắp hết/ });
    expect(low).toHaveAttribute('href', '/admin/stock?filter=low');
    expect(low).toHaveTextContent('4');
  });

  it('bảng theo người nhóm theo phòng ban, "Chưa có phòng ban" cuối; nhãn người đã nghỉ, món ngoài DM chờ xem; tiến độ giao', async () => {
    mockViewport(1280);
    stub();
    renderApp(makeMe('admin'), '/admin/summary');
    await screen.findByText('Phạm Văn Đức');
    const rows = screen.getAllByRole('row').map((r) => r.textContent ?? '');
    const at = (s: string) => rows.findIndex((r) => r.includes(s));
    expect(at('Phòng Công trình')).toBeLessThan(at('Phạm Văn Đức'));
    expect(at('Võ Thị Lan')).toBeLessThan(at('Chưa có phòng ban'));
    expect(at('Chưa có phòng ban')).toBeLessThan(at('Trần Bình'));
    const an = screen.getByText('Phạm Văn Đức').closest('tr')!;
    expect(within(an).getByText('1 món ngoài DM chờ xem')).toBeInTheDocument();
    expect(within(an).getByRole('progressbar', { name: 'Đã giao 4/7' })).toBeInTheDocument();
    const lan = screen.getByText('Võ Thị Lan').closest('tr')!;
    expect(within(lan).getByText('Người đã nghỉ')).toBeInTheDocument();
    expect(within(an).queryByText('Người đã nghỉ')).toBeNull();
  });

  it('tìm theo tên/email gửi q lên API', async () => {
    mockViewport(1280);
    const f = stub();
    renderApp(makeMe('admin'), '/admin/summary');
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Tìm người, email…' }), 'lan');
    await waitFor(() => expect(requestUrls(f).some((u) => u.includes('q=lan'))).toBe(true));
  });

  it('"Theo món" → bảng món với tổng số lượng và số người', async () => {
    mockViewport(1280);
    stub();
    renderApp(makeMe('admin'), '/admin/summary');
    await screen.findByText('Phạm Văn Đức');
    await userEvent.click(screen.getByRole('radio', { name: 'Theo món' }));
    const row = (await screen.findByText('Giấy A4')).closest('tr')!;
    expect(row).toHaveTextContent('25');
    expect(row).toHaveTextContent('9');
    expect(screen.queryByText('Phạm Văn Đức')).toBeNull();
  });

  it('kỳ đã khóa: nhãn "Đã khóa", mẫu số "tính tại lúc khóa"; › sang kỳ đang mở rồi bị khóa', async () => {
    mockViewport(1280);
    stub();
    renderApp(makeMe('admin'), '/admin/summary?ym=2026-10');
    const kpi = await screen.findByRole('button', { name: /Phiếu đã đăng ký/ });
    expect(kpi).toHaveTextContent('30/38');
    expect(kpi).toHaveTextContent('tính tại lúc khóa');
    expect(screen.getByText('Đã khóa')).toBeInTheDocument();
    const next = screen.getByRole('button', { name: 'Tháng sau' });
    expect(next).toBeEnabled();
    await userEvent.click(next);
    expect(await screen.findByText('Tháng 11/2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
  });

  it('nút "Điều chỉnh" gọi onAdjust với request_id', async () => {
    mockViewport(1280);
    stub();
    const onAdjust = vi.fn();
    renderWithI18n(
      <MemoryRouter initialEntries={['/admin/summary']}>
        <SummaryPage onAdjust={onAdjust} />
      </MemoryRouter>,
    );
    const lan = (await screen.findByText('Võ Thị Lan')).closest('tr')!;
    await userEvent.click(within(lan).getByRole('button', { name: 'Điều chỉnh' }));
    expect(onAdjust).toHaveBeenCalledWith('r-2');
  });
});
