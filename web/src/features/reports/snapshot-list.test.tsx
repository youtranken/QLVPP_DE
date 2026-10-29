import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import i18n from '@/lib/i18n';
import { handleSessionExpired } from '@/lib/session-relogin';
import { snapshotRow } from './reports-fixtures';
import { captureDownloads, errorResponse, exportsOf, postsOf, stubReports } from './reports-test-stub';

vi.mock('@/lib/session-relogin', () => ({ handleSessionExpired: vi.fn() }));

function openPage() {
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/reports');
}

const oldRow = async (list = 'Bản chốt') => within(await screen.findByRole('region', { name: list })).findByRole('row', { name: /Trần Thị Bình/ });

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(handleSessionExpired).mockClear();
  await i18n.changeLanguage('vi');
});

describe('SnapshotList — tải lại / in lại bản chốt cũ', () => {
  it('hàng có giờ, người lập, loại; "Tải lại" lưu tệp tên từ server, không gọi POST', async () => {
    const f = stubReports({ snapshots: [snapshotRow()] });
    const downloads = captureDownloads();
    openPage();
    const row = await oldRow();
    expect(within(row).getByText('Excel')).toBeInTheDocument();
    expect(within(row).getByText('09:30 28/10/26')).toBeInTheDocument();
    await userEvent.click(within(row).getByRole('button', { name: /^Tải lại/ }));
    await waitFor(() => expect(downloads.map((d) => d.name)).toEqual(['vpp-bao-cao-2026-10.xlsx']));
    expect(exportsOf(f)).toEqual(['/api/admin/reports/snapshots/snap-old/export.xlsx?lang=vi']);
    expect(postsOf(f)).toEqual([]);
  });

  it('server không gửi Content-Disposition → tên dự phòng vpp-bao-cao-<tháng>.xlsx', async () => {
    stubReports({ snapshots: [snapshotRow()], exportFile: () => new Response('x', { status: 200 }) });
    const downloads = captureDownloads();
    openPage();
    await userEvent.click(within(await oldRow()).getByRole('button', { name: /^Tải lại/ }));
    await waitFor(() => expect(downloads.map((d) => d.name)).toEqual(['vpp-bao-cao-2026-10.xlsx']));
  });

  it('hết phiên (401) → đăng nhập lại tập trung, không lưu tệp', async () => {
    stubReports({ snapshots: [snapshotRow()], exportFile: () => errorResponse(401, 'UNAUTHENTICATED') });
    const downloads = captureDownloads();
    openPage();
    await userEvent.click(within(await oldRow()).getByRole('button', { name: /^Tải lại/ }));
    await waitFor(() => expect(handleSessionExpired).toHaveBeenCalledTimes(1));
    expect(downloads).toEqual([]);
  });

  it('404 SNAPSHOT_NOT_FOUND → báo "Không tìm thấy bản chốt này…", không lưu tệp', async () => {
    stubReports({ snapshots: [snapshotRow()], exportFile: () => errorResponse(404, 'SNAPSHOT_NOT_FOUND') });
    const downloads = captureDownloads();
    openPage();
    await userEvent.click(within(await oldRow()).getByRole('button', { name: /^Tải lại/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy bản chốt này, tải lại trang để xem danh sách mới.');
    expect(downloads).toEqual([]);
    expect(handleSessionExpired).not.toHaveBeenCalled();
  });

  it('500 → báo "Chưa tải được tệp, thử lại sau.", không lưu tệp', async () => {
    stubReports({ snapshots: [snapshotRow()], exportFile: () => errorResponse(500, 'INTERNAL') });
    const downloads = captureDownloads();
    openPage();
    await userEvent.click(within(await oldRow()).getByRole('button', { name: /^Tải lại/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa tải được tệp, thử lại sau.');
    expect(downloads).toEqual([]);
  });

  it('"In lại" mở trang in của bản cũ, không gọi POST', async () => {
    const f = stubReports({ snapshots: [snapshotRow({ id: 'snap-p', kind: 'print' })] });
    openPage();
    await userEvent.click(within(await oldRow()).getByRole('button', { name: /^In lại/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/reports/snapshots/snap-p/print');
    expect(postsOf(f)).toEqual([]);
  });

  it('giao diện tiếng Anh → tải export.xlsx?lang=en', async () => {
    const f = stubReports({ snapshots: [snapshotRow()] });
    const downloads = captureDownloads();
    await i18n.changeLanguage('en');
    openPage();
    await userEvent.click(within(await oldRow('Snapshots')).getByRole('button', { name: /^Download again/ }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(exportsOf(f)).toEqual(['/api/admin/reports/snapshots/snap-old/export.xlsx?lang=en']);
  });
});
