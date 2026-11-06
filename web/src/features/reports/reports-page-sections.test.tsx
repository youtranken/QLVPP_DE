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
const rowOf = async (name: string) => within(await region(PART1)).findByRole('row', { name: new RegExp(name) });
const PART1 = 'Phần 1 · Tổng hợp theo món';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ReportsPage — tháng', () => {
  it('cột "Số người" chỉ hiện khi Phần 1 có hàng ngoài danh mục; không có thì ẩn hẳn cột', async () => {
    stubReports({ reports: { '2026-10': reportFixture({ custom: [] }) } });
    openPage();
    await rowOf('Bút bi xanh');
    expect(within(await region(PART1)).queryByRole('columnheader', { name: 'Số người' })).toBeNull();
  });

  it('đầu trang không còn nút chốt; bộ chọn tháng ở thanh công cụ; mô tả mới; chân Phần 1 đếm "3 món"', async () => {
    stubReports();
    openPage();
    await rowOf('Bút bi xanh');
    expect(screen.queryByRole('group', { name: 'Thao tác trang' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Chọn tháng báo cáo' })).toBeInTheDocument();
    expect(screen.getByText('Số đề nghị, hàng đã về và đã giao của tháng. In trình ký và xuất Excel ở Gửi ADM.')).toBeInTheDocument();
    expect(within(await region(PART1)).getByText('3 món', { selector: 'p' })).toBeInTheDocument();
    expect(within(await region(PART1)).getByRole('columnheader', { name: 'Số người' })).toBeInTheDocument();
  });

  it('trần là kỳ khóa gần nhất (10/2026): "Tháng sau" vô hiệu, badge "Đã khóa", kỳ mở hiện vô hiệu "Đang mở"', async () => {
    stubReports();
    openPage();
    await rowOf('Bút bi xanh');
    const month = screen.getByRole('group', { name: 'Chọn tháng báo cáo' });
    expect(within(month).getByText('Đã khóa')).toBeInTheDocument();
    expect(within(month).getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
    expect(within(month).getByRole('button', { name: /Đang mở/ })).toBeDisabled();
  });

  it.each(['abc', '2026-13', '1999-12', '2026-1', '2026-11', '2026-12', '2099-01'])('?ym=%s sai, là kỳ mở hoặc vượt kỳ mở → thay URL bằng kỳ khóa gần nhất, không gọi API với tháng sai', async (bad) => {
    const f = stubReports();
    openPage(`/admin/reports?ym=${bad}`);
    await rowOf('Bút bi xanh');
    expect(screen.getByText('Tháng 10/2026')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?ym=2026-10'));
    expect(f.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith('/api/admin/reports/') && !u.includes('2026-10'))).toEqual([]);
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
    const tape = await rowOf('Băng keo 2 mặt');
    expect(within(tape).getByText('—')).toBeInTheDocument();
    expect(within(tape).getAllByRole('cell').at(-1)).toHaveTextContent('2');
    expect(within(await rowOf('Bút bi xanh')).getByText('Box of 20')).toBeInTheDocument();
    expect(within(part1).getByText('6 món')).toBeInTheDocument();
  });

  it('danh sách nhóm rỗng → mọi món về "Chưa xếp nhóm", không lỗi', async () => {
    stubReports({ categories: [] });
    openPage();
    const part1 = await region(PART1);
    expect(await within(part1).findByRole('rowheader', { name: /Chưa xếp nhóm/ })).toBeInTheDocument();
    expect(within(part1).queryByRole('rowheader', { name: /Bút viết/ })).toBeNull();
  });

  it('"Chỉ món có Tổng cần" → ẩn hàng Tổng cần 0, giữ hàng Tổng cần 1 (hai phía); bỏ bật thì hiện lại', async () => {
    const base = reportFixture();
    const report = reportFixture({ byItem: [base.byItem[0], { ...base.byItem[1], requested: 0, backlog_prev: 0 }], custom: [{ ...base.custom[0], requested: 1, backlog_prev: 0 }] });
    stubReports({ reports: { '2026-10': report } });
    openPage();
    await rowOf('Hồ dán');
    const only = screen.getByRole('checkbox', { name: 'Chỉ món có Tổng cần' });
    await userEvent.click(only);
    expect(within(await region(PART1)).queryByRole('row', { name: /Hồ dán/ })).toBeNull();
    expect(await rowOf('Băng keo 2 mặt')).toBeInTheDocument();
    await userEvent.click(only);
    expect(await rowOf('Hồ dán')).toBeInTheDocument();
  });

  it('admin/items lỗi → báo nhỏ trên Phần 1 + "Thử lại", số vẫn hiện; thử lại được thì hết báo', async () => {
    let fail = true;
    const f = stubReports();
    const base = f.getMockImplementation()!;
    f.mockImplementation(async (url: string, init?: RequestInit) => (url === '/api/admin/items' && fail ? errorResponse(500, 'INTERNAL') : base(url, init)));
    openPage();
    const part1 = await region(PART1);
    expect(await within(part1).findByText('Chưa tải được nhóm món — các món tạm nằm ở "Chưa xếp nhóm".', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(within(await rowOf('Bút bi xanh')).getAllByRole('cell')[6]).toHaveTextContent('15');
    fail = false;
    await userEvent.click(within(part1).getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(within(part1).queryByText(/Chưa tải được nhóm món/)).toBeNull());
    expect(await within(part1).findByRole('rowheader', { name: /Bút viết/ })).toBeInTheDocument();
  });
});

describe('ReportsPage — Xuất lẻ, Phần 2, Cách tính', () => {
  it('issues rỗng → không có mục "Xuất lẻ trong kỳ"', async () => {
    stubReports();
    openPage();
    await rowOf('Bút bi xanh');
    expect(screen.queryByRole('region', { name: 'Xuất lẻ trong kỳ' })).toBeNull();
  });

  it('có xuất lẻ → mô tả + "Mở Tủ / Kho"; hàng: món, "Dùng chung"/tên người nhận, SL, lý do', async () => {
    stubReports({ reports: { '2026-10': reportFixture({ issues: [ISSUE, { ...ISSUE, recipient_sub: 'u-duc', recipient_name: 'Phạm Văn Đức', qty: 1, reason: 'Thay bút hỏng' }] }) } });
    openPage();
    const issues = await region('Xuất lẻ trong kỳ');
    expect(within(issues).getByText('Xuất ngoài phiếu tháng, đã trừ tồn ở Kho. In kèm trong bản chốt.')).toBeInTheDocument();
    expect(within(issues).getByRole('link', { name: 'Mở Tủ / Kho' })).toHaveAttribute('href', '/admin/stock');
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

  it('"Cách tính Tổng cần" là nút (i) ở đầu cột Tổng cần, bấm mới hiện công thức', async () => {
    stubReports();
    openPage();
    const part1 = await region(PART1);
    await rowOf('Bút bi xanh');
    const head = within(part1).getByRole('columnheader', { name: /^Tổng cần/ });
    await userEvent.click(within(head).getByRole('button', { name: 'Cách tính Tổng cần' }));
    expect(screen.getByRole('dialog', { name: 'Cách tính Tổng cần' })).toHaveTextContent('Đề nghị mặc định = Chưa giao kỳ này + Nợ kỳ trước. Tủ chỉ để tham khảo, không trừ. Muốn bớt thì sửa ô Đề nghị.');
  });

  it('390: không có đầu cột → nút (i) "Cách tính Tổng cần" ở công cụ Phần 1; ô Tổng cần và Đề nghị giữ nhãn', async () => {
    stubReports();
    mockViewport(390);
    renderApp(makeMe('admin'), '/admin/reports');
    const pen = await rowOf('Bút bi xanh');
    expect(within(pen).getAllByRole('cell')[5]).toHaveAttribute('data-label', 'Tổng cần');
    expect(within(pen).getAllByRole('cell')[6]).toHaveAttribute('data-label', 'Đề nghị');
    const tips = within(await region(PART1)).getAllByRole('button', { name: 'Cách tính Tổng cần' });
    expect(tips).toHaveLength(1);
    expect(tips[0].closest('th')).toBeNull();
  });

  it('câu về bản chốt nằm ở mục "Bản chốt", không ở mô tả đầu trang', async () => {
    stubReports();
    openPage();
    const snaps = await region('Bản chốt');
    expect(within(snaps).getByText(/Excel và bản in luôn lấy từ một bản chốt/)).toBeInTheDocument();
    expect(screen.queryByText(/Excel và bản in luôn lấy từ một bản chốt/, { selector: '.page-head__desc' })).toBeNull();
  });
});
