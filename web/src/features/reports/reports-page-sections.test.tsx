import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { ISSUE, reportFixture } from './reports-fixtures';
import { captureDownloads, stubReports } from './reports-test-stub';

function openPage(path = '/admin/reports') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
}

const region = (name: string) => screen.findByRole('region', { name });
const orderCell = (name: string) => screen.findByRole('spinbutton', { name: `Đặt mua ${name}` });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  it.each(['abc', '2026-13', '1999-12', '2026-1'])('?ym=%s sai định dạng → hiện kỳ khóa gần nhất (tháng 10/2026), không gọi báo cáo của giá trị lạ', async (bad) => {
    const f = stubReports();
    openPage(`/admin/reports?ym=${bad}`);
    await orderCell('Bút bi xanh');
    expect(screen.getByText('Tháng 10/2026')).toBeInTheDocument();
    expect(f.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith('/api/admin/reports/') && !u.includes('2026-10'))).toEqual([]);
  });

  it('nhãn trạng thái kỳ ở đầu trang: tháng 10 "Đã khóa"; kỳ đang mở 11 "Đang mở · hạn 10/11"', async () => {
    stubReports();
    openPage();
    await orderCell('Bút bi xanh');
    const head = screen.getByRole('group', { name: 'Chọn tháng báo cáo' }).parentElement!;
    expect(within(head).getByText('Đã khóa')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tháng sau' }));
    await screen.findByText('Tháng 11/2026');
    const head2 = screen.getByRole('group', { name: 'Chọn tháng báo cáo' }).parentElement!;
    expect(await within(head2).findByText('Đang mở · hạn 10/11')).toBeInTheDocument();
    expect(within(head2).queryByText('Đã khóa')).toBeNull();
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

  it('chưa có bản chốt → "Chưa có bản chốt nào cho tháng này."; Xuất xong → bản mới hiện trong danh sách', async () => {
    stubReports();
    captureDownloads();
    openPage();
    const list = await region('Bản chốt');
    expect(await within(list).findByText('Chưa có bản chốt nào cho tháng này.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    expect(await within(list).findByRole('row', { name: /Nguyễn Văn An/ })).toBeInTheDocument();
  });

});
