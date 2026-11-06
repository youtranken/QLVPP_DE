import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { itemRow, sendReport, setupSendAdm, YM } from './send-adm-fixtures';

const PEN = itemRow({ key: 'kA', name: 'Bút bi', requested: 5 });
const PAPER = itemRow({ key: 'kB', name: 'Giấy A4', requested: 3 });
const OWED = itemRow({ key: 'kD', name: 'Kẹp giấy', requested: 0, backlog_prev: 2 });

async function open() {
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/send-adm');
  return screen.findByRole('table', { name: /theo món$/ });
}

afterEach(() => vi.unstubAllGlobals());

describe('Gửi ADM — "Xem ai đăng ký (n người)"', () => {
  it('mỗi hàng có người đăng ký có liên kết đúng số người, mở Tổng hợp theo món lọc sẵn đúng món; món chỉ có nợ (0 người) không có liên kết', async () => {
    setupSendAdm({ report: sendReport([PEN, PAPER, OWED]), people: { kA: 3, kB: 1 } });
    const table = await open();
    const pen = within(table).getByRole('row', { name: /Bút bi/ });
    const link = await within(pen).findByRole('link', { name: 'Xem ai đăng ký (3 người)' });
    expect(link).toHaveAttribute('href', `/admin/summary?ym=${YM}&view=item&item=kA`);
    expect(within(within(table).getByRole('row', { name: /Giấy A4/ })).getByRole('link', { name: 'Xem ai đăng ký (1 người)' })).toHaveAttribute('href', `/admin/summary?ym=${YM}&view=item&item=kB`);
    expect(within(within(table).getByRole('row', { name: /Kẹp giấy/ })).queryByRole('link')).toBeNull();
    await userEvent.click(link);
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/summary');
    expect(screen.getByTestId('location-search')).toHaveTextContent(`?ym=${YM}&view=item&item=kA`);
  });
});
