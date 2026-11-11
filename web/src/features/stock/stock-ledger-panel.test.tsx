import { describe, expect, it } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubStockApi } from './stock-fixtures';

const search = () => screen.getByTestId('location-search').textContent ?? '';

async function open(path: string, width = 1280) {
  mockViewport(width);
  stubStockApi((url) => (url.startsWith('/api/me/notifications') ? jsonResponse(200, { items: [], next_cursor: null, unread_count: 0 }) : undefined));
  renderApp(makeMe('admin'), path);
}

describe('Tủ / Kho — lịch sử nhập xuất là panel phủ ?item=', () => {
  it('bấm tên món → ?item=<id>, panel có bộ đếm; Đóng gỡ tham số', async () => {
    await open('/admin/stock');
    await userEvent.click(await screen.findByRole('button', { name: 'Xem lịch sử nhập xuất Giấy A4' }));
    const panel = await screen.findByRole('dialog', { name: 'Lịch sử nhập xuất Giấy A4' });
    expect(search()).toContain('item=i-1');
    expect(within(panel).getByText(/^\d+\/\d+$/)).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(search()).not.toContain('item='));
  });

  it('F5 với ?item=i-1 → mở đúng lịch sử nhập xuất', async () => {
    await open('/admin/stock?item=i-1');
    expect(await screen.findByRole('dialog', { name: 'Lịch sử nhập xuất Giấy A4' })).toBeInTheDocument();
  });

  it('?item=<id lạ> → không mở panel, gỡ tham số, giữ tham số khác', async () => {
    await open('/admin/stock?item=rac&q=a');
    await screen.findByText('Giấy A4');
    await waitFor(() => expect(search()).toBe('?q=a'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Xuất lẻ" ở chân panel mở hộp trên panel; đóng hộp thì panel vẫn mở', async () => {
    await open('/admin/stock?item=i-1');
    const panel = await screen.findByRole('dialog', { name: 'Lịch sử nhập xuất Giấy A4' });
    expect(within(panel).queryByRole('button', { name: 'Kiểm kê' })).toBeNull();
    await userEvent.click(within(panel).getByRole('button', { name: 'Xuất lẻ' }));
    expect(await screen.findByRole('dialog', { name: 'Xuất lẻ Giấy A4' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Xuất lẻ Giấy A4' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Lịch sử nhập xuất Giấy A4' })).toBeInTheDocument();
    expect(search()).toContain('item=i-1');
  });
});
