import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubSummaryApi } from './summary-fixtures';
import { adminRequest } from './adjust-fixtures';

const search = () => screen.getByTestId('location-search').textContent ?? '';
const open = (path: string) => {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
};

afterEach(() => vi.unstubAllGlobals());

describe('SummaryPage — panel phủ điều chỉnh phiếu ?request=', () => {
  it('panel phủ: mở đẩy một mục lịch sử, ↓ thay tại chỗ → đóng một lần là về đúng URL trước khi mở; bộ đếm theo thứ tự bảng', async () => {
    stubSummaryApi((url) => (url === '/api/admin/requests/r-3' ? jsonResponse(200, adminRequest({ id: 'r-3', full_name: 'Trần Bình' })) : undefined));
    open('/admin/summary?ym=2026-10');
    await userEvent.click(await screen.findByText('Võ Thị Lan'));
    const drawer = await screen.findByRole('dialog', { name: 'Điều chỉnh phiếu Võ Thị Lan' });
    expect(await within(drawer).findByText('2/3')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Phiếu trước' })).toBeEnabled();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Phiếu sau' }));
    await waitFor(() => expect(search()).toContain('request=r-3'));
    const next = await screen.findByRole('dialog', { name: 'Điều chỉnh phiếu Trần Bình' });
    expect(within(next).getByText('3/3')).toBeInTheDocument();
    expect(within(next).getByRole('button', { name: 'Phiếu sau' })).toBeDisabled();
    await userEvent.click(within(next).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(search()).toBe('?ym=2026-10'));
  });
});
