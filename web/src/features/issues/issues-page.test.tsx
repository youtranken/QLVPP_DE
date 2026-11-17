import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { STOCK, callsTo, stubStockApi } from '@/features/stock/stock-fixtures';
import type { IssueRow } from '@/features/stock/stock.api';

const issue = (over: Partial<IssueRow>): IssueRow => ({
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
  actor_name: 'Lê Hành Chính',
  created_at: '2026-11-03T03:00:00.000Z',
  ...over,
});

const NOVEMBER = [
  issue({ id: 'm-1', qty: 1 }),
  issue({ id: 'm-2', qty: 3, item_name: 'Bút bi', unit: 'cay', recipient_sub: 'u-khoa', recipient_name: 'Trần Minh Khoa', note: 'Khách họp' }),
  issue({ id: 'm-3', qty: 2, recipient_sub: null, recipient_name: null }),
  issue({ id: 'm-4', qty: 3, item_name: 'Kẹp giấy', unit: 'hop' }),
];

const issuesApi = (url: string) => {
  if (url.startsWith('/api/admin/issues')) return jsonResponse(200, url.endsWith('2026-10') ? [] : NOVEMBER);
  if (url === '/api/periods/current') return jsonResponse(200, { ym: '2026-11' });
  return undefined;
};

async function open(path = '/admin/issues?ym=2026-11') {
  mockViewport(1280);
  const f = stubStockApi(issuesApi);
  renderApp(makeMe('admin'), path);
  await screen.findByText(/^Đang hiện/);
  return f;
}

describe('IssuesPage — trang Xuất lẻ riêng (G6)', () => {
  it('h1 "Xuất lẻ", kỳ 2026-11 có 4 lần → "Đang hiện 4 lần xuất · 9 đơn vị"; cột Ngày · Món · Số lượng · Người nhận · Lý do · Người xuất', async () => {
    await open();
    expect(screen.getByRole('heading', { level: 1, name: 'Xuất lẻ' })).toBeInTheDocument();
    expect(screen.getByText('Đang hiện 4 lần xuất · 9 đơn vị')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Ngày', 'Món', 'Số lượng', 'Người nhận', 'Lý do', 'Người xuất']);
    expect(screen.getAllByText('Lê Hành Chính').length).toBeGreaterThan(0);
  });

  it('tìm "Khoa" → 1 dòng, "Đang hiện 1/4 lần xuất · 3 đơn vị", q lên URL', async () => {
    await open();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm món, người nhận' }), 'khoa');
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2));
    expect(screen.getByText('Trần Minh Khoa')).toBeInTheDocument();
    expect(screen.getByText('Đang hiện 1/4 lần xuất · 3 đơn vị')).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent('q=khoa');
  });

  it('kỳ rỗng → "Tháng này chưa xuất lẻ món nào."', async () => {
    mockViewport(1280);
    stubStockApi(issuesApi);
    renderApp(makeMe('admin'), '/admin/issues?ym=2026-10');
    expect(await screen.findByText('Tháng này chưa xuất lẻ món nào.')).toBeInTheDocument();
  });

  it('?ym=2026-10 → API gọi đúng ym=2026-10', async () => {
    mockViewport(1280);
    const f = stubStockApi(issuesApi);
    renderApp(makeMe('admin'), '/admin/issues?ym=2026-10');
    await screen.findByText('Tháng này chưa xuất lẻ món nào.');
    expect(callsTo(f, '/api/admin/issues?ym=2026-10')).toHaveLength(1);
  });

  it('thiếu ym → tháng lịch hiện tại (giờ VN), không phải kỳ đăng ký đang mở: 25/11 với kỳ mở 2026-12 → ym=2026-11', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-25T03:00:00Z') });
    try {
      const f = stubStockApi((url) => (url === '/api/periods/current' ? jsonResponse(200, { ym: '2026-12', registration_last_day: 10 }) : issuesApi(url)));
      mockViewport(1280);
      renderApp(makeMe('admin'), '/admin/issues');
      await screen.findByText(/^Đang hiện/);
      expect(callsTo(f, '/api/admin/issues?ym=2026-11')).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('nút chính "Xuất lẻ một món" → hộp chọn món, chọn Giấy A4 thì hiện "Tủ: 6 ram"', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Xuất lẻ một món' }));
    const dialog = await screen.findByRole('dialog', { name: /^Xuất lẻ/ });
    const list = within(dialog).getByRole('list', { name: 'Món còn trong tủ' });
    expect(within(list).queryByText('Kẹp giấy')).toBeNull();
    await userEvent.click(within(list).getByRole('button', { name: /^Giấy A4/ }));
    expect(within(dialog).getByText('Tủ: 6 ram')).toBeInTheDocument();
  });

  it('tủ trống mọi món → "Xuất lẻ một món" khóa, lý do "Tủ đang trống"', async () => {
    mockViewport(1280);
    const empty = STOCK.map((r) => ({ ...r, stock_qty: 0, free: 0, held: 0 }));
    stubStockApi((url) => (url.split('?')[0] === '/api/admin/stock' ? jsonResponse(200, empty) : issuesApi(url)));
    renderApp(makeMe('admin'), '/admin/issues?ym=2026-11');
    await screen.findByText(/^Đang hiện/);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Xuất lẻ một món' })).toHaveAccessibleDescription('Tủ đang trống'));
    expect(screen.getByRole('button', { name: 'Xuất lẻ một món' })).toBeDisabled();
  });
});
