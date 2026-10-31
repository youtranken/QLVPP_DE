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

const list = (name = 'Bản chốt') => screen.findByRole('region', { name });
const oldItem = async (name?: string) => within(await list(name)).findByRole('listitem', { name: /Trần Thị Bình/ });
const reload = () => screen.findByRole('button', { name: 'Tải lại Excel lập 09:30 28/10' });

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(handleSessionExpired).mockClear();
  await i18n.changeLanguage('vi');
});

describe('Bản chốt — danh sách, tải lại, in lại', () => {
  it('rỗng → "Chưa có bản chốt nào."; mô tả mục; Xuất xong → bản mới có badge "Mới"', async () => {
    stubReports();
    captureDownloads();
    openPage();
    const region = await list();
    expect(within(region).getByText('Mỗi lần Xuất Excel hoặc In trình ký tạo một bản chốt.')).toBeInTheDocument();
    expect(await within(region).findByText('Chưa có bản chốt nào.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    const fresh = await within(region).findByRole('listitem', { name: /Nguyễn Văn An/ });
    expect(within(fresh).getByText('Mới')).toBeInTheDocument();
  });

  it('bản cũ: "Excel", "Lập 09:30 28/10/2026 · Trần Thị Bình", không badge "Mới"; "Tải lại" lưu tệp từ server, không POST', async () => {
    const f = stubReports({ snapshots: [snapshotRow()] });
    const downloads = captureDownloads();
    openPage();
    const item = await oldItem();
    expect(within(item).getByText('Excel')).toBeInTheDocument();
    expect(within(item).getByText('Lập 09:30 28/10/2026 · Trần Thị Bình')).toBeInTheDocument();
    expect(within(item).queryByText('Mới')).toBeNull();
    await userEvent.click(await reload());
    await waitFor(() => expect(downloads.map((d) => d.name)).toEqual(['vpp-bao-cao-2026-10.xlsx']));
    expect(exportsOf(f)).toEqual(['/api/admin/reports/snapshots/snap-old/export.xlsx?lang=vi']);
    expect(postsOf(f)).toEqual([]);
    expect(f.mock.calls.filter((c) => c[0] === '/api/admin/reports/2026-10/snapshots')).toHaveLength(1);
  });

  it('không có Content-Disposition → tên dự phòng vpp-bao-cao-<tháng>.xlsx', async () => {
    stubReports({ snapshots: [snapshotRow()], exportFile: () => new Response('x', { status: 200 }) });
    const downloads = captureDownloads();
    openPage();
    await userEvent.click(await reload());
    await waitFor(() => expect(downloads.map((d) => d.name)).toEqual(['vpp-bao-cao-2026-10.xlsx']));
  });

  it('tải lỗi 500 → khối "Không tải được tệp — thử lại." trong mục Bản chốt; "Thử lại" tải lại đúng bản, không POST', async () => {
    let fail = true;
    const f = stubReports({ snapshots: [snapshotRow()], exportFile: () => (fail ? errorResponse(500, 'INTERNAL') : new Response('x', { status: 200 })) });
    const downloads = captureDownloads();
    openPage();
    await userEvent.click(await reload());
    const region = await list();
    expect(await within(region).findByRole('alert')).toHaveTextContent('Không tải được tệp — thử lại.');
    expect(downloads).toEqual([]);
    fail = false;
    await userEvent.click(within(region).getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(within(region).queryByRole('alert')).toBeNull();
    expect(exportsOf(f)).toHaveLength(2);
    expect(postsOf(f)).toEqual([]);
  });

  it('POST chốt xong nhưng tải 500 → khối lỗi trong mục Bản chốt, bản mới vẫn vào danh sách, không toast thành công', async () => {
    const f = stubReports({ exportFile: () => errorResponse(500, 'INTERNAL') });
    captureDownloads();
    openPage();
    await screen.findByRole('textbox', { name: 'Đặt mua Bút bi xanh' });
    await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    const region = await list();
    expect(await within(region).findByRole('alert')).toHaveTextContent('Không tải được tệp — thử lại.');
    expect(postsOf(f)).toHaveLength(1);
    expect(await within(region).findByRole('listitem', { name: /Nguyễn Văn An/ })).toBeInTheDocument();
    expect(screen.queryByText(/^Đã xuất Excel/)).toBeNull();
  });

  it('404 SNAPSHOT_NOT_FOUND → "Không tìm thấy bản chốt này…" trong mục Bản chốt', async () => {
    stubReports({ snapshots: [snapshotRow()], exportFile: () => errorResponse(404, 'SNAPSHOT_NOT_FOUND') });
    captureDownloads();
    openPage();
    await userEvent.click(await reload());
    expect(await within(await list()).findByRole('alert')).toHaveTextContent('Không tìm thấy bản chốt này, tải lại trang để xem danh sách mới.');
  });

  it('hết phiên (401) → đăng nhập lại tập trung, không lưu tệp, không báo lỗi', async () => {
    stubReports({ snapshots: [snapshotRow()], exportFile: () => errorResponse(401, 'UNAUTHENTICATED') });
    const downloads = captureDownloads();
    openPage();
    await userEvent.click(await reload());
    await waitFor(() => expect(handleSessionExpired).toHaveBeenCalledTimes(1));
    expect(downloads).toEqual([]);
    expect(within(await list()).queryByRole('alert')).toBeNull();
  });

  it('bản in: liên kết "In lại bản lập …" mở trang in ở tab mới, không POST', async () => {
    const f = stubReports({ snapshots: [snapshotRow({ id: 'snap-p', kind: 'print' })] });
    openPage();
    const item = await oldItem();
    expect(within(item).getByText('Bản in')).toBeInTheDocument();
    const link = within(item).getByRole('link', { name: 'In lại bản lập 09:30 28/10' });
    expect(link).toHaveAttribute('href', '/admin/reports/snapshots/snap-p/print');
    expect(link).toHaveAttribute('target', '_blank');
    expect(within(item).queryByRole('button', { name: /^Tải lại/ })).toBeNull();
    expect(postsOf(f)).toEqual([]);
  });

  it('giao diện tiếng Anh → tải export.xlsx?lang=en', async () => {
    const f = stubReports({ snapshots: [snapshotRow()] });
    const downloads = captureDownloads();
    await i18n.changeLanguage('en');
    openPage();
    await userEvent.click(within(await oldItem('Snapshots')).getByRole('button', { name: /^Download Excel again/ }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(exportsOf(f)).toEqual(['/api/admin/reports/snapshots/snap-old/export.xlsx?lang=en']);
  });
});
