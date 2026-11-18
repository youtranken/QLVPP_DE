import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubStockApi } from './stock-fixtures';

afterEach(() => vi.unstubAllGlobals());

const row = (id: string, over: Record<string, unknown>) => ({
  id,
  item_id: 'i-1',
  item_name: 'Giấy A4',
  item_name_en: null,
  unit: 'ram',
  delta: 1,
  reason: 'purchase',
  note: null,
  actor_sub: 'u-hc',
  actor_name: 'Phạm Hành Chính',
  recipient_sub: null,
  recipient_name: null,
  receipt_ym: null,
  created_at: '2026-11-12T03:15:00.000Z',
  ...over,
});
const ALL = {
  items: [row('m3', { delta: -40, reason: 'issue', note: 'phòng họp', recipient_name: 'Trần Thị Bình' }), row('m2', { delta: 50 }), row('m1', { delta: 12, created_at: '2026-11-02T03:15:00.000Z' })],
  next_cursor: null,
  totals: { in: 62, out: -40 },
};
const PURCHASE = { items: ALL.items.slice(1), next_cursor: null, totals: { in: 62, out: 0 } };

const ISSUES = { items: [ALL.items[0], row('m4', { delta: -2, reason: 'issue', note: null, recipient_sub: null, recipient_name: null, actor_name: 'sa:local' })], next_cursor: null, totals: { in: 0, out: -42 } };

function open(path = '/admin/stock?tab=history&ym=2026-11') {
  const f = stubStockApi((url) =>
    url.startsWith('/api/admin/stock/movements?') ? jsonResponse(200, url.includes('kind=purchase') ? PURCHASE : url.includes('kind=issue') ? ISSUES : ALL) : undefined,
  );
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
  return f;
}
const search = () => screen.getByTestId('location-search').textContent ?? '';

describe('Tủ / Kho — tab Lịch sử nhập xuất (G5)', () => {
  it('tab "Lịch sử nhập xuất" chọn sẵn từ ?tab=history; gọi movements?ym=2026-11; tổng "Nhập +62 · Ra −40"; dòng ghi ±số và người', async () => {
    const f = open();
    expect(await screen.findByRole('radio', { name: 'Lịch sử nhập xuất' })).toBeChecked();
    expect(await screen.findByText('Nhập +62 · Ra −40')).toBeInTheDocument();
    expect(f.mock.calls.some(([u]) => String(u) === '/api/admin/stock/movements?ym=2026-11')).toBe(true);
    const table = within(screen.getByRole('table', { name: 'Lịch sử nhập xuất' }));
    const issue = table.getByText('Xuất lẻ').closest('tr')!;
    expect(within(issue).getByText('−40')).toBeInTheDocument();
    expect(within(issue).getByText('Trần Thị Bình')).toBeInTheDocument();
    expect(table.getAllByText('+50')).toHaveLength(1);
  });

  it('lọc "Nhập" → ?kind=purchase, gọi kind=purchase, chỉ còn dòng nhập', async () => {
    const f = open();
    await screen.findByText('Nhập +62 · Ra −40');
    await userEvent.click(screen.getByRole('radio', { name: 'Nhập' }));
    await waitFor(() => expect(search()).toContain('kind=purchase'));
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u) === '/api/admin/stock/movements?ym=2026-11&kind=purchase')).toBe(true));
    const table = within(await screen.findByRole('table', { name: 'Lịch sử nhập xuất' }));
    await waitFor(() => expect(table.queryByText('Xuất lẻ')).toBeNull());
    expect(screen.getByText('Nhập +62 · Ra 0')).toBeInTheDocument();
  });

  it('tab "Trong tủ" (mặc định) vẫn là bảng tồn; bấm "Lịch sử nhập xuất" ghi ?tab=history', async () => {
    open('/admin/stock');
    expect(await screen.findByText('Giấy A4')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Trong tủ' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Lịch sử nhập xuất' }));
    await waitFor(() => expect(search()).toContain('tab=history'));
  });

  it('link cũ ?tab=ledger vẫn mở tab Lịch sử', async () => {
    open('/admin/stock?tab=ledger&ym=2026-11');
    expect(await screen.findByRole('radio', { name: 'Lịch sử nhập xuất' })).toBeChecked();
  });

  it('AD-38: lọc "Xuất lẻ" (?kind=issue) có cột "Người nhận" và "Người xuất" (không cột Loại); không người nhận → "Dùng chung"', async () => {
    open('/admin/stock?tab=history&kind=issue&ym=2026-11');
    const table = within(await screen.findByRole('table', { name: 'Lịch sử nhập xuất' }));
    expect(await table.findByText('sa:local')).toBeInTheDocument();
    const headers = table.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Thời gian', 'Món', 'Số lượng', 'Người nhận', 'Người xuất', 'Ghi chú']);
    const first = table.getByText('Trần Thị Bình').closest('tr')!;
    expect(within(first).getByText('Phạm Hành Chính')).toBeInTheDocument();
    expect(within(table.getByText('sa:local').closest('tr')!).getByText('Dùng chung')).toBeInTheDocument();
  });

  it('AD-38/39: đầu trang Tủ / Kho có nút chính "Xuất lẻ một món" mở hộp xuất lẻ; không nút "Tủ / Kho"', async () => {
    open('/admin/stock?tab=history&kind=issue&ym=2026-11');
    const main = within(screen.getByRole('main'));
    const primary = await main.findByRole('button', { name: 'Xuất lẻ một món' });
    await waitFor(() => expect(primary).toBeEnabled());
    expect(main.queryByRole('link', { name: 'Tủ / Kho' })).toBeNull();
    await userEvent.click(primary);
    expect(await screen.findByRole('dialog', { name: /^Xuất lẻ/ })).toBeInTheDocument();
  });
});
