import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import i18n from '@/lib/i18n';
import { ISSUE, reportFixture, snapshotRow } from './reports-fixtures';
import { captureDownloads, postsOf, stubReports } from './reports-test-stub';

function openPage(path = '/admin/reports') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
}

const region = (name: string) => screen.findByRole('region', { name });
const orderCell = (name: string) => screen.findByRole('spinbutton', { name: `Đặt mua ${name}` });

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await i18n.changeLanguage('vi');
});

describe('ReportsPage — tháng, chi tiết, xuất lẻ, bản chốt', () => {
  it('MonthSwitcher: lên tới kỳ đang mở (11/2026) rồi "Tháng sau" vô hiệu; ?ym vượt kỳ mở → về kỳ khóa gần nhất', async () => {
    stubReports();
    openPage();
    await orderCell('Bút bi xanh');
    await userEvent.click(screen.getByRole('button', { name: 'Tháng sau' }));
    expect(screen.getByTestId('location-search')).toHaveTextContent('?ym=2026-11');
    expect(screen.getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
  });

  it('?ym=2026-12 (vượt kỳ mở) → hiện tháng 10/2026', async () => {
    const f = stubReports();
    openPage('/admin/reports?ym=2026-12');
    await orderCell('Bút bi xanh');
    expect(screen.getByText('Tháng 10/2026')).toBeInTheDocument();
    expect(f.mock.calls.some((c) => c[0] === '/api/admin/reports/2026-12')).toBe(false);
  });

  it('đổi tháng khi có ô đã sửa → hỏi "Bỏ số Đặt mua đã sửa?"; "Ở lại" giữ; đồng ý thì nháp kỳ cũ bị xóa', async () => {
    stubReports();
    openPage();
    const pen = await orderCell('Bút bi xanh');
    await userEvent.clear(pen);
    await userEvent.type(pen, '7');
    await userEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));
    const ask = await screen.findByRole('dialog', { name: 'Bỏ số Đặt mua đã sửa?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Ở lại' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('location-search')).not.toHaveTextContent('ym=');
    expect(await orderCell('Bút bi xanh')).toHaveValue(7);
    await userEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Bỏ số đã sửa' }));
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?ym=2026-09'));
    await screen.findByText('Tháng 9/2026');
    await userEvent.click(screen.getByRole('button', { name: 'Tháng sau' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await screen.findByText('Tháng 10/2026');
    expect(await orderCell('Bút bi xanh')).toHaveValue(10);
  });

  it('không sửa ô nào → đổi tháng không hỏi', async () => {
    stubReports();
    openPage();
    await orderCell('Bút bi xanh');
    await userEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?ym=2026-09'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Phần 2: phòng ban → người → món · SL; phòng ban trống → "Chưa có phòng ban"', async () => {
    stubReports();
    openPage();
    const detail = await region('Phần 2 · Chi tiết theo phòng ban');
    expect(within(detail).getByRole('rowheader', { name: 'Tổ Giám sát' })).toBeInTheDocument();
    expect(within(detail).getByRole('rowheader', { name: 'Chưa có phòng ban' })).toBeInTheDocument();
    const duc = within(detail).getByRole('row', { name: /Phạm Văn Đức/ });
    expect(within(duc).getByText('Bút bi xanh')).toBeInTheDocument();
    expect(within(duc).getByText('12')).toBeInTheDocument();
  });

  it('issues rỗng → không có bảng "Xuất lẻ trong kỳ"', async () => {
    stubReports();
    openPage();
    await orderCell('Bút bi xanh');
    expect(screen.queryByRole('region', { name: 'Xuất lẻ trong kỳ' })).toBeNull();
  });

  it('có xuất lẻ → bảng phụ: món, người nhận "Dùng chung", SL, lý do', async () => {
    stubReports({ reports: { '2026-10': reportFixture({ issues: [ISSUE, { ...ISSUE, recipient_sub: 'u-duc', recipient_name: 'Phạm Văn Đức', qty: 1, reason: 'Thay bút hỏng' }] }) } });
    openPage();
    const issues = await region('Xuất lẻ trong kỳ');
    const shared = within(issues).getByRole('row', { name: /Họp giao ban/ });
    for (const text of ['Giấy A4', 'Dùng chung', '2']) expect(within(shared).getByText(text)).toBeInTheDocument();
    expect(within(within(issues).getByRole('row', { name: /Thay bút hỏng/ })).getByText('Phạm Văn Đức')).toBeInTheDocument();
  });

  it('danh sách bản chốt: giờ, người lập, loại; "Tải lại" tải đúng bản, không gọi POST', async () => {
    const f = stubReports({ snapshots: [snapshotRow()] });
    const downloads = captureDownloads();
    openPage();
    const list = await region('Bản chốt');
    const row = await within(list).findByRole('row', { name: /Trần Thị Bình/ });
    expect(within(row).getByText('Excel')).toBeInTheDocument();
    expect(within(row).getByText('09:30 28/10/26')).toBeInTheDocument();
    await userEvent.click(within(row).getByRole('button', { name: /^Tải lại/ }));
    expect(downloads).toEqual(['/api/admin/reports/snapshots/snap-old/export.xlsx?lang=vi']);
    expect(postsOf(f)).toEqual([]);
  });

  it('"In lại" mở trang in của bản cũ, không gọi POST', async () => {
    const f = stubReports({ snapshots: [snapshotRow({ id: 'snap-p', kind: 'print' })] });
    openPage();
    const row = await within(await region('Bản chốt')).findByRole('row', { name: /Trần Thị Bình/ });
    await userEvent.click(within(row).getByRole('button', { name: /^In lại/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/reports/snapshots/snap-p/print');
    expect(postsOf(f)).toEqual([]);
  });

  it('chưa có bản chốt → "Chưa có bản chốt nào cho tháng này."; Xuất xong → bản mới hiện trong danh sách', async () => {
    stubReports();
    captureDownloads();
    openPage();
    const list = await region('Bản chốt');
    expect(await within(list).findByText('Chưa có bản chốt nào cho tháng này.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    expect(await within(list).findByRole('row', { name: /Nguyễn Văn An/ })).toBeInTheDocument();
  });

  it('giao diện tiếng Anh → tải export.xlsx?lang=en', async () => {
    stubReports({ snapshots: [snapshotRow()] });
    const downloads = captureDownloads();
    await i18n.changeLanguage('en');
    openPage();
    const row = await within(await region('Snapshots')).findByRole('row', { name: /Trần Thị Bình/ });
    await userEvent.click(within(row).getByRole('button', { name: /^Download again/ }));
    await waitFor(() => expect(downloads).toEqual(['/api/admin/reports/snapshots/snap-old/export.xlsx?lang=en']));
  });
});
