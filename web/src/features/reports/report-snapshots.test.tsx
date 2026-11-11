import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import i18n from '@/lib/i18n';
import { handleSessionExpired } from '@/lib/session-relogin';
import { itemRow, sendReport, setupSendAdm } from '@/features/send-adm/send-adm-fixtures';
import { snapshotRow } from './reports-fixtures';
import { captureDownloads, errorResponse, exportsOf, postsOf } from './reports-test-stub';

const REPORT = sendReport([itemRow({ key: 'kA', name: 'Bút bi', requested: 5, need: 5 })]);
const stubReports = (opts: Parameters<typeof import('./reports-test-stub').stubReports>[0] = {}) => setupSendAdm({ report: REPORT, snapshots: opts.snapshots, stub: opts });

vi.mock('@/lib/session-relogin', () => ({ handleSessionExpired: vi.fn() }));

function openPage() {
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/reports');
}

// Hộp "Các bản đã in / xuất" gập sẵn: mở ra rồi mới thao tác
async function list(title = /^Các bản đã in \/ xuất|^Printed \/ exported copies/) {
  const summary = await screen.findByText(title);
  const box = summary.closest('details')!;
  if (!box.hasAttribute('open')) await userEvent.click(summary);
  return box;
}
const reload = async (title?: RegExp) => within(await list(title)).findByRole('button', { name: /^(Tải lại Excel lập 09:30 28\/10|Download Excel again)/ });

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(handleSessionExpired).mockClear();
  await i18n.changeLanguage('vi');
});

describe('Bản chốt — danh sách, tải lại, in lại', () => {
  it('rỗng → "Chưa có bản chốt nào."; mô tả mục', async () => {
    stubReports();
    openPage();
    const region = await list();
    expect(within(region).getByText('Mỗi lần In hay Xuất Excel, app lưu lại số lúc đó để đối chiếu với NCC. Số chưa đổi thì dùng lại bản cũ.')).toBeInTheDocument();
    expect(await within(region).findByText('Chưa có bản chốt nào.')).toBeInTheDocument();
  });

  it('bản rỗng cũ (has_items false) → nhãn xám "Không có món", vẫn có "In lại"; bản có hàng → không nhãn', async () => {
    stubReports({ snapshots: [snapshotRow({ id: 'snap-e', kind: 'print', has_items: false }), snapshotRow({ id: 'snap-f', kind: 'print', created_at: '2026-10-27T02:30:00Z', has_items: true })] });
    openPage();
    const [empty, full] = within(await list()).getAllByRole('row').slice(1);
    expect(within(empty).getByText('Không có món')).toBeInTheDocument();
    expect(within(empty).getByRole('link', { name: /^In lại bản lập/ })).toHaveAttribute('href', '/admin/reports/snapshots/snap-e/print');
    expect(within(full).queryByText('Không có món')).toBeNull();
  });

  it('bản cũ: "Excel", "Lập 09:30 28/10/2026 · Trần Thị Bình"; "Tải lại" lưu tệp từ server, không POST', async () => {
    const f = stubReports({ snapshots: [snapshotRow()] });
    const downloads = captureDownloads();
    openPage();
    const [item] = within(await list()).getAllByRole('row').slice(1);
    expect(within(item!).getByText('Excel')).toBeInTheDocument();
    expect(within(item!).getByText('09:30 28/10/2026')).toBeInTheDocument();
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

  it('bản in: liên kết "In lại bản lập …" mở trang in riêng cùng tab không POST, không gọi print', async () => {
    const f = stubReports({ snapshots: [snapshotRow({ id: 'snap-p', kind: 'print' })] });
    const print = vi.spyOn(window, 'print');
    openPage();
    const [item] = within(await list()).getAllByRole('row').slice(1);
    expect(within(item!).getByText('Bản in')).toBeInTheDocument();
    const link = within(item!).getByRole('link', { name: 'In lại bản lập 09:30 28/10' });
    expect(link).toHaveAttribute('href', '/admin/reports/snapshots/snap-p/print');
    expect(link).not.toHaveAttribute('target');
    expect(within(item!).queryByRole('button', { name: /^Tải lại/ })).toBeNull();
    await userEvent.click(link);
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/reports/snapshots/snap-p/print');
        expect(print).not.toHaveBeenCalled();
    expect(postsOf(f)).toEqual([]);
  });

  it('giao diện tiếng Anh → tải export.xlsx?lang=en', async () => {
    const f = stubReports({ snapshots: [snapshotRow()] });
    const downloads = captureDownloads();
    await i18n.changeLanguage('en');
    openPage();
    await userEvent.click(await reload(/^Printed \/ exported copies/));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(exportsOf(f)).toEqual(['/api/admin/reports/snapshots/snap-old/export.xlsx?lang=en']);
  });
});
