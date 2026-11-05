import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
import { IssuesPanel } from './issues-panel';
import type { IssueRow } from './stock.api';

const row = (over: Partial<IssueRow>): IssueRow => ({
  id: 'm-1',
  item_id: 'i-1',
  item_name: 'Bút bi FO-03',
  item_name_en: null,
  unit: 'cay',
  qty: 2,
  recipient_sub: 'u-khoa',
  recipient_name: 'Trần Minh Khoa',
  note: 'Khách đến họp',
  actor_sub: 'u-hc',
  created_at: '2026-10-05T03:15:00.000Z',
  ...over,
});

function stub(handler: (url: string) => Response) {
  const f = vi.fn((url: string) => Promise.resolve(handler(url)));
  vi.stubGlobal('fetch', f);
  return f;
}

const show = (ym = '2026-11', onYmChange = vi.fn()) => {
  renderWithI18n(<IssuesPanel ym={ym} onYmChange={onYmChange} />);
  return onYmChange;
};

describe('IssuesPanel', () => {
  it('liệt kê các lần xuất lẻ của tháng', async () => {
    const f = stub(() => jsonResponse(200, [row({}), row({ id: 'm-2', qty: 3, recipient_sub: null, recipient_name: null, note: null, created_at: '2026-10-31T16:59:00.000Z' })]));
    show();
    expect(await screen.findAllByText('Bút bi FO-03')).toHaveLength(2);
    expect(screen.getByText('2 cây')).toBeInTheDocument();
    expect(screen.getByText('Trần Minh Khoa')).toBeInTheDocument();
    expect(screen.getByText('Khách đến họp')).toBeInTheDocument();
    expect(screen.getByText('2 lần xuất, 5 đơn vị')).toBeInTheDocument();
    expect(screen.getByText('05/10 10:15')).toBeInTheDocument();
    expect(f).toHaveBeenCalledWith('/api/admin/issues?ym=2026-11', expect.anything());
  });

  it('giờ hiển thị theo giờ Việt Nam: 16:59Z ngày 31 là 23:59 ngày 31', async () => {
    stub(() => jsonResponse(200, [row({ created_at: '2026-10-31T16:59:00.000Z' })]));
    show();
    expect(await screen.findByText('31/10 23:59')).toBeInTheDocument();
  });

  it('người nhận trống (xuất dùng chung) hiện "Dùng chung", lý do trống hiện gạch ngang', async () => {
    stub(() => jsonResponse(200, [row({ recipient_sub: null, recipient_name: null, note: null })]));
    show();
    await screen.findByText('Bút bi FO-03');
    expect(screen.getByText('Dùng chung')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(1);
  });

  it('có recipient_sub nhưng thiếu tên trong danh bạ thì hiện gạch ngang', async () => {
    stub(() => jsonResponse(200, [row({ recipient_sub: 'u-gone', recipient_name: null, note: null })]));
    show();
    await screen.findByText('Bút bi FO-03');
    expect(screen.queryByText('Dùng chung')).toBeNull();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('tháng không có dòng', async () => {
    stub(() => jsonResponse(200, []));
    show();
    expect(await screen.findByText('Tháng này chưa xuất lẻ món nào.')).toBeInTheDocument();
    expect(screen.getByText('0 lần xuất, 0 đơn vị')).toBeInTheDocument();
  });

  it('lỗi tải có nút Thử lại', async () => {
    let fail = true;
    const f = stub(() => (fail ? jsonResponse(500, { code: 'X' }) : jsonResponse(200, [row({})])));
    show();
    const retry = await screen.findByRole('button', { name: 'Thử lại' });
    fail = false;
    await userEvent.click(retry);
    expect(await screen.findByText('Bút bi FO-03')).toBeInTheDocument();
    await waitFor(() => expect(f.mock.calls.length).toBeGreaterThan(1));
  });

  it('đổi tháng gọi onYmChange', async () => {
    stub(() => jsonResponse(200, []));
    const onYmChange = show();
    await userEvent.click(await screen.findByRole('button', { name: 'Tháng trước' }));
    expect(onYmChange).toHaveBeenCalledWith('2026-10');
  });

  it('mới nhất lên đầu (API trả cũ → mới, bảng đảo lại)', async () => {
    stub(() => jsonResponse(200, [row({ id: 'm-1', item_name: 'Cũ nhất' }), row({ id: 'm-2', item_name: 'Giữa' }), row({ id: 'm-3', item_name: 'Mới nhất' })]));
    show();
    await screen.findByText('Mới nhất');
    const names = screen.getAllByRole('row').slice(1).map((r) => r.textContent ?? '');
    expect(names.map((n) => ['Mới nhất', 'Giữa', 'Cũ nhất'].find((x) => n.includes(x)))).toEqual(['Mới nhất', 'Giữa', 'Cũ nhất']);
  });
});
