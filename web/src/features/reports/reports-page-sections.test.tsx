import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { adminItem } from '@/features/summary/adjust-fixtures';
import { ISSUE, REPORT_ITEMS, reportFixture } from './reports-fixtures';
import { errorResponse, stubReports } from './reports-test-stub';

function openPage(path = '/admin/reports') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
}

const region = (name: string) => screen.findByRole('region', { name });
const orderCell = (name: string) => screen.findByRole('textbox', { name: `Đặt mua ${name}` });
const PART1 = 'Phần 1 · Tổng hợp theo món';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ReportsPage — tháng', () => {
  it('cột "Số người" chỉ hiện khi Phần 1 có hàng ngoài danh mục; không có thì ẩn hẳn cột', async () => {
    stubReports({ reports: { '2026-10': reportFixture({ custom: [] }) } });
    openPage();
    await orderCell('Bút bi xanh');
    expect(within(await region(PART1)).queryByRole('columnheader', { name: 'Số người' })).toBeNull();
  });

  it('Xuất Excel / In trình ký ở đầu trang (phụ trước chính); bộ chọn tháng ở thanh công cụ dưới; chân Phần 1 đếm "3 món"', async () => {
    stubReports();
    openPage();
    await orderCell('Bút bi xanh');
    const actions = screen.getByRole('group', { name: 'Thao tác trang' });
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Xuất Excel', 'In trình ký']);
    const month = screen.getByRole('group', { name: 'Chọn tháng báo cáo' });
    expect(actions.contains(month)).toBe(false);
    expect(actions.compareDocumentPosition(month) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Số cần mua trong tháng, xuất Excel và in giấy trình ký.')).toBeInTheDocument();
    expect(within(await region(PART1)).getByText('3 món', { selector: 'p' })).toBeInTheDocument();
    expect(within(await region(PART1)).getByRole('columnheader', { name: 'Số người' })).toBeInTheDocument();
  });

  it('lên tới kỳ đang mở (11/2026) rồi "Tháng sau" vô hiệu; badge "Đã khóa" → "Đang mở · hạn 10/11"', async () => {
    stubReports();
    openPage();
    await orderCell('Bút bi xanh');
    const month = screen.getByRole('group', { name: 'Chọn tháng báo cáo' });
    expect(within(month).getByText('Đã khóa')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tháng sau' }));
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?ym=2026-11'));
    expect(await screen.findByRole('button', { name: 'Tháng sau' })).toBeDisabled();
    expect(await within(screen.getByRole('group', { name: 'Chọn tháng báo cáo' })).findByText('Đang mở · hạn 10/11')).toBeInTheDocument();
  });

  it.each(['abc', '2026-13', '1999-12', '2026-1', '2026-12', '2099-01'])('?ym=%s sai hoặc vượt kỳ mở → thay URL bằng kỳ khóa gần nhất, không gọi API với tháng sai', async (bad) => {
    const f = stubReports();
    openPage(`/admin/reports?ym=${bad}`);
    await orderCell('Bút bi xanh');
    expect(screen.getByText('Tháng 10/2026')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?ym=2026-10'));
    expect(f.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith('/api/admin/reports/') && !u.includes('2026-10'))).toEqual([]);
  });

  it('đổi tháng khi có ô sửa → hỏi "Bỏ số Đặt mua đã sửa?"; "Tiếp tục sửa" giữ tháng và số; "Bỏ thay đổi" sang tháng trước, quay lại thì số về Cần mua', async () => {
    stubReports();
    openPage();
    const pen = await orderCell('Bút bi xanh');
    await userEvent.clear(pen);
    await userEvent.type(pen, '7');
    await userEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));
    const ask = await screen.findByRole('dialog', { name: 'Bỏ số Đặt mua đã sửa?' });
    expect(within(ask).getByText('Bạn đã sửa 1 ô Đặt mua của tháng 10 nhưng chưa chốt. Sang tháng khác sẽ bỏ các số này.')).toBeInTheDocument();
    await userEvent.click(within(ask).getByRole('button', { name: 'Tiếp tục sửa' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Tháng 10/2026')).toBeInTheDocument();
    expect(await orderCell('Bút bi xanh')).toHaveValue('7');
    await userEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Bỏ thay đổi' }));
    await screen.findByText('Tháng 9/2026');
    await userEvent.click(screen.getByRole('button', { name: 'Tháng sau' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await screen.findByText('Tháng 10/2026');
    expect(await orderCell('Bút bi xanh')).toHaveValue('10');
  });

  it('không sửa ô nào → đổi tháng không hỏi', async () => {
    stubReports();
    openPage();
    await orderCell('Bút bi xanh');
    await userEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?ym=2026-09'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('báo cáo lỗi 500 → "Không tải được dữ liệu — thử lại." + "Thử lại"', async () => {
    const f = stubReports();
    const base = f.getMockImplementation()!;
    f.mockImplementation(async (url: string, init?: RequestInit) => (url === '/api/admin/reports/2026-10' ? errorResponse(500, 'INTERNAL') : base(url, init)));
    openPage();
    expect(await screen.findByText('Không tải được dữ liệu — thử lại.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });
});

describe('ReportsPage — Phần 1 nhóm theo danh mục', () => {
  it('nhóm theo thứ tự nhóm món, món không nhóm hoặc category_id lạ → "Chưa xếp nhóm", ngoài DM cuối cùng; Tồn ngoài DM "—", Số người chỉ ở ngoài DM', async () => {
    const report = reportFixture({
      byItem: [
        ...reportFixture().byItem,
        { key: 'item-x', item_id: 'item-x', name: 'Kẹp lạ', name_en: null, unit: 'hop', requested: 1, backlog_prev: 0, stock: 0, need: 1 },
        { key: 'item-gone', item_id: 'item-gone', name: 'Món đã xóa', name_en: null, unit: 'hop', requested: 1, backlog_prev: 0, stock: 0, need: 1 },
        { key: 'item-none', item_id: 'item-none', name: 'Món không nhóm', name_en: null, unit: 'hop', requested: 1, backlog_prev: 0, stock: 0, need: 1 },
      ],
    });
    const items = [...REPORT_ITEMS, adminItem({ id: 'item-x', name: 'Kẹp lạ', category_id: 'c-deleted' }), adminItem({ id: 'item-none', name: 'Món không nhóm', category_id: null })];
    stubReports({ reports: { '2026-10': report }, items });
    openPage();
    const part1 = await region(PART1);
    await within(part1).findByRole('rowheader', { name: /Bút viết/ });
    const headers = within(part1).getAllByRole('rowheader').map((h) => h.textContent ?? '');
    expect(headers).toEqual([
      expect.stringMatching(/^Bút viết/),
      expect.stringMatching(/^Keo dán/),
      expect.stringMatching(/^Chưa xếp nhóm/),
      expect.stringMatching(/^Ngoài danh mục \(đã chấp nhận\)/),
    ]);
    const rows = within(part1).getAllByRole('row').map((r) => r.textContent ?? '');
    const at = (text: string) => rows.findIndex((r) => r.includes(text));
    expect(at('Chưa xếp nhóm')).toBeLessThan(at('Kẹp lạ'));
    expect(at('Chưa xếp nhóm')).toBeLessThan(at('Món đã xóa'));
    expect(at('Chưa xếp nhóm')).toBeLessThan(at('Món không nhóm'));
    expect(at('Món không nhóm')).toBeLessThan(at('Ngoài danh mục'));
    const tape = (await orderCell('Băng keo 2 mặt')).closest('tr')!;
    expect(within(tape).getByText('—')).toBeInTheDocument();
    expect(within(tape).getByText('2')).toBeInTheDocument();
    expect(within((await orderCell('Bút bi xanh')).closest('tr')!).getByText('Box of 20')).toBeInTheDocument();
    expect(within(part1).getByText('6 món')).toBeInTheDocument();
  });

  it('danh sách nhóm rỗng → mọi món về "Chưa xếp nhóm", không lỗi', async () => {
    stubReports({ categories: [] });
    openPage();
    const part1 = await region(PART1);
    expect(await within(part1).findByRole('rowheader', { name: /Chưa xếp nhóm/ })).toBeInTheDocument();
    expect(within(part1).queryByRole('rowheader', { name: /Bút viết/ })).toBeNull();
  });

  it('"Chỉ món cần mua" → ẩn hàng Cần mua 0 (Hồ dán), bỏ bật thì hiện lại', async () => {
    stubReports();
    openPage();
    await orderCell('Hồ dán');
    const only = screen.getByRole('checkbox', { name: 'Chỉ món cần mua' });
    await userEvent.click(only);
    expect(screen.queryByRole('textbox', { name: 'Đặt mua Hồ dán' })).toBeNull();
    expect(await orderCell('Bút bi xanh')).toBeInTheDocument();
    await userEvent.click(only);
    expect(await orderCell('Hồ dán')).toBeInTheDocument();
  });

  it('tiêu đề cột Phần 1 đúng thứ tự SPEC', async () => {
    stubReports();
    openPage();
    const part1 = await region(PART1);
    await orderCell('Bút bi xanh');
    expect(within(part1).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Món', 'ĐVT', 'Chưa giao kỳ này', 'Nợ kỳ trước', 'Tồn', 'Cần mua', 'Đặt mua', 'Số người']);
    expect(within((await orderCell('Bút bi xanh')).closest('tr')!).getAllByRole('cell')[5]).toHaveTextContent('10');
  });
});

describe('ReportsPage — Xuất lẻ, Phần 2, Cách tính', () => {
  it('issues rỗng → không có mục "Xuất lẻ trong kỳ"', async () => {
    stubReports();
    openPage();
    await orderCell('Bút bi xanh');
    expect(screen.queryByRole('region', { name: 'Xuất lẻ trong kỳ' })).toBeNull();
  });

  it('có xuất lẻ → mô tả + "Mở Kho"; hàng: món, "Dùng chung"/tên người nhận, SL, lý do', async () => {
    stubReports({ reports: { '2026-10': reportFixture({ issues: [ISSUE, { ...ISSUE, recipient_sub: 'u-duc', recipient_name: 'Phạm Văn Đức', qty: 1, reason: 'Thay bút hỏng' }] }) } });
    openPage();
    const issues = await region('Xuất lẻ trong kỳ');
    expect(within(issues).getByText('Xuất ngoài phiếu tháng, đã trừ tồn ở Kho. In kèm trong bản chốt.')).toBeInTheDocument();
    expect(within(issues).getByRole('link', { name: 'Mở Kho' })).toHaveAttribute('href', '/admin/stock');
    const shared = within(issues).getByRole('row', { name: /Họp giao ban/ });
    for (const text of ['Giấy A4', 'Dùng chung', '2']) expect(within(shared).getByText(text)).toBeInTheDocument();
    expect(within(within(issues).getByRole('row', { name: /Thay bút hỏng/ })).getByText('Phạm Văn Đức')).toBeInTheDocument();
  });

  it('Phần 2: chip phòng ban kèm số người + "Tất cả"; hàng người: "Bút bi xanh 12" · Tổng; không cột Đã giao', async () => {
    const report = reportFixture();
    report.byDepartment[0].people[0].lines.push({ name: 'Hồ dán', name_en: null, unit: 'lo', qty: 2 });
    stubReports({ reports: { '2026-10': report } });
    openPage();
    const detail = await region('Phần 2 · Chi tiết theo phòng ban');
    expect(within(detail).getByText('Theo phòng ban ghi trên phiếu lúc lưu.')).toBeInTheDocument();
    expect(within(detail).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Người', 'Món đăng ký', 'Tổng']);
    const duc = within(detail).getByRole('row', { name: /Phạm Văn Đức/ });
    expect(duc).toHaveTextContent('Bút bi xanh 12 · Hồ dán 2');
    expect(within(duc).getByText('14')).toBeInTheDocument();
    expect(within(detail).getByRole('radio', { name: 'Tất cả' })).toBeChecked();
    await userEvent.click(within(detail).getByRole('radio', { name: 'Tổ Giám sát · 1' }));
    expect(within(detail).queryByRole('row', { name: /Võ Thị Lan/ })).toBeNull();
    await userEvent.click(within(detail).getByRole('radio', { name: 'Chưa có phòng ban · 1' }));
    expect(within(detail).getByRole('row', { name: /Võ Thị Lan/ })).toBeInTheDocument();
    expect(within(detail).queryByRole('row', { name: /Phạm Văn Đức/ })).toBeNull();
  });

  it('"Cách tính Cần mua" là nút (i) ở đầu cột Cần mua, bấm mới hiện công thức; không còn khối riêng cuối trang', async () => {
    stubReports();
    openPage();
    const part1 = await region(PART1);
    await orderCell('Bút bi xanh');
    expect(screen.queryByRole('region', { name: 'Cách tính Cần mua' })).toBeNull();
    const head = within(part1).getByRole('columnheader', { name: /^Cần mua/ });
    await userEvent.click(within(head).getByRole('button', { name: 'Cách tính Cần mua' }));
    expect(screen.getByRole('dialog', { name: 'Cách tính Cần mua' })).toHaveTextContent('Cần mua = Chưa giao kỳ này + Nợ kỳ trước − Tồn (không âm).');
  });

  it('390: không có đầu cột → nút (i) "Cách tính Cần mua" nằm ở công cụ Phần 1, chạm mở công thức; ô Cần mua giữ nhãn', async () => {
    stubReports();
    mockViewport(390);
    renderApp(makeMe('admin'), '/admin/reports');
    const part1 = await region(PART1);
    const pen = (await orderCell('Bút bi xanh')).closest('tr')!;
    expect(within(pen).getAllByRole('cell')[5]).toHaveAttribute('data-label', 'Cần mua');
    const tips = within(part1).getAllByRole('button', { name: 'Cách tính Cần mua' });
    expect(tips).toHaveLength(1);
    expect(tips[0].closest('th')).toBeNull();
    await userEvent.click(tips[0]);
    expect(screen.getByRole('dialog', { name: 'Cách tính Cần mua' })).toHaveTextContent('Đặt mua mặc định bằng Cần mua.');
  });

  it('câu về bản chốt nằm ở mục "Bản chốt", không ở mô tả đầu trang', async () => {
    stubReports();
    openPage();
    const snaps = await region('Bản chốt');
    expect(within(snaps).getByText(/Excel và bản in luôn lấy từ một bản chốt/)).toBeInTheDocument();
    expect(screen.queryByText(/Excel và bản in luôn lấy từ một bản chốt/, { selector: '.page-head__desc' })).toBeNull();
  });
});
