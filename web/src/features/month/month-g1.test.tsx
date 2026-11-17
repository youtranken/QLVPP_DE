import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { person } from '@/features/summary/summary-fixtures';
import { PEOPLE, stubMonthApi } from './month-fixtures';

afterEach(() => vi.unstubAllGlobals());

const open = (path = '/admin/month?ym=2026-10') => {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
};
const table = async () => within(await screen.findByRole('table'));
const search = () => screen.getByTestId('location-search').textContent ?? '';
const rowOf = async (name: string) => (await table()).getByText(name).closest('tr')!;

const UNREG = { items: [{ sub: 'u-x', full_name: 'Lê Chưa Đặt', email: null, department: 'Phòng Test' }] };
const unregRoute = (url: string) => (url === '/api/admin/periods/2026-10/unregistered' ? jsonResponse(200, UNREG) : undefined);

describe('G1 Kỳ tháng — theo người', () => {
  it('bước đầu "Đã đặt 4/5"; nút "Chép DS 1 người chưa đặt" chép đúng tên người chưa đặt', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    stubMonthApi(unregRoute);
    open();
    await table();
    const steps = within(screen.getByRole('list', { name: 'Các bước của tháng' })).getAllByRole('listitem');
    expect(steps[0]).toHaveTextContent('Đã đặt4/5');
    await userEvent.click(await screen.findByRole('button', { name: 'Chép DS 1 người chưa đặt' }));
    expect(writeText).toHaveBeenCalledWith('Lê Chưa Đặt');
    expect(await screen.findByText('Đã chép 1 tên')).toBeInTheDocument();
  });

  it('kỳ đang đăng ký cũng có nút chép người chưa đặt (lúc cần nhắc nhất)', async () => {
    stubMonthApi((url) => (url === '/api/admin/periods/2026-11/unregistered' ? jsonResponse(200, UNREG) : undefined));
    open('/admin/month?ym=2026-11');
    expect(await screen.findByRole('button', { name: 'Chép DS 1 người chưa đặt' })).toBeInTheDocument();
  });

  it('chỉ người đã đặt có dòng: người chưa đặt không có trong bảng', async () => {
    stubMonthApi(unregRoute);
    open();
    const t = await table();
    expect(t.getByText('Nhân viên A')).toBeInTheDocument();
    expect(t.queryByText('Lê Chưa Đặt')).toBeNull();
  });

  it('cột Người · Đặt hàng · Tủ · Ghi chú · Trạng thái; dòng phụ "Phòng Test · Team Test · lưu 07/10"; bỏ cột Nhóm, Lưu lúc', async () => {
    stubMonthApi();
    open();
    const t = await table();
    const heads = t.getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads.slice(0, 5)).toEqual(['Người', 'Đặt hàng', 'Tủ', 'Ghi chú', 'Trạng thái']);
    expect(heads).not.toContain('Nhóm');
    expect(heads).not.toContain('Lưu lúc');
    expect(within(await rowOf('Nhân viên A')).getByText('Phòng Test · Team Test · lưu 07/10')).toBeInTheDocument();
  });

  it('Đặt hàng "8 món · 36 SL"; người có món ngoài DM chờ duyệt thêm nhãn "1 chờ duyệt"', async () => {
    stubMonthApi();
    open();
    expect(within(await rowOf('Nhân viên A')).getByText('8 món · 36 SL')).toBeInTheDocument();
    expect(within(await rowOf('Nguyễn Văn An')).getByText('1 chờ duyệt')).toBeInTheDocument();
  });

  it('Tủ: short_items rỗng → "Đủ"; có món → "Thiếu: Bút bi, Giấy A4"', async () => {
    const people = PEOPLE.map((p) => (p.request_id === 'r-c' ? { ...p, short_items: ['Bút bi', 'Giấy A4'] } : p));
    stubMonthApi(undefined, people);
    open();
    expect(within(await rowOf('Nhân viên A')).getByText('Đủ')).toBeInTheDocument();
    expect(within(await rowOf('Nhân viên C')).getByText('Thiếu: Bút bi, Giấy A4')).toBeInTheDocument();
  });

  it('⋯ của một người có "Xem phiếu" và "Điều chỉnh phiếu"; bấm hàng cũng mở Xem phiếu', async () => {
    stubMonthApi();
    open();
    await userEvent.click(within(await rowOf('Nhân viên A')).getByRole('button', { name: 'Thao tác cho Nhân viên A' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Xem phiếu', 'Điều chỉnh phiếu', 'Lịch sử đặt hàng']);
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Điều chỉnh phiếu' }));
    await waitFor(() => expect(search()).toContain('request=r-a'));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(await rowOf('Nhân viên B')).getByText('6 món · 6 SL'));
    expect(await screen.findByRole('dialog', { name: 'Phiếu của Nhân viên B' })).toBeInTheDocument();
  });
});

describe('G3 Kỳ tháng — Lịch sử đặt hàng', () => {
  it('⋯ → "Lịch sử đặt hàng" mở hộp lịch sử của người đó', async () => {
    stubMonthApi();
    open();
    await userEvent.click(within(await rowOf('Nhân viên A')).getByRole('button', { name: 'Thao tác cho Nhân viên A' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Lịch sử đặt hàng' }));
    expect(await screen.findByRole('dialog', { name: 'Lịch sử đặt hàng · Nhân viên A' })).toBeInTheDocument();
  });
});

describe('G1 Kỳ tháng — lọc khu', () => {
  const AREA_PEOPLE = [
    person({ request_id: 'r-1', user_sub: 'u-1', full_name: 'Người A1', department: 'Phòng A' }),
    person({ request_id: 'r-2', user_sub: 'u-2', full_name: 'Người A2', department: 'Phòng A' }),
    person({ request_id: 'r-3', user_sub: 'u-3', full_name: 'Người B1', department: 'Phòng B' }),
    person({ request_id: 'r-4', user_sub: 'u-4', full_name: 'Người C1', department: 'Phòng C' }),
    person({ request_id: 'r-5', user_sub: 'u-5', full_name: 'Người C2', department: 'Phòng C' }),
  ];

  it('chọn 2 khu → chỉ người thuộc 2 phòng, "Đang hiện 3/5 người · 2 khu", URL area= lặp; bỏ một chip khu → còn 1 khu', async () => {
    stubMonthApi(undefined, AREA_PEOPLE);
    open();
    await table();
    await userEvent.click(screen.getByRole('button', { name: '+ Thêm khu' }));
    const dialog = await screen.findByRole('dialog', { name: 'Chọn khu' });
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Phòng A' }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Phòng B' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Áp dụng' }));
    const t = await table();
    await waitFor(() => expect(t.queryByText('Người C1')).toBeNull());
    expect(t.getByText('Người A1')).toBeInTheDocument();
    expect(t.getByText('Người B1')).toBeInTheDocument();
    expect(screen.getByText('Đang hiện 3/5 người · 2 khu')).toBeInTheDocument();
    expect(new URLSearchParams(search()).getAll('area')).toEqual(['Phòng A', 'Phòng B']);
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ khu Phòng B' }));
    await waitFor(() => expect(t.queryByText('Người B1')).toBeNull());
    expect(screen.getByText('Đang hiện 2/5 người · 1 khu')).toBeInTheDocument();
  });

  it('"Chọn tất cả" tick mọi khu; mặc định không chọn khu nào = mọi khu, không có dòng "· khu"', async () => {
    stubMonthApi(undefined, AREA_PEOPLE);
    open();
    await table();
    expect(screen.getByText('Đang hiện 5/5 người')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '+ Thêm khu' }));
    const dialog = await screen.findByRole('dialog', { name: 'Chọn khu' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Chọn tất cả' }));
    expect(within(dialog).getAllByRole('checkbox').every((c) => (c as HTMLInputElement).checked)).toBe(true);
  });
});

describe('G1 Kỳ tháng — theo món', () => {
  const BY_ITEM = { items: [{ key: 'i-pen', item_id: 'i-pen', name: 'Bút bi xanh', unit: 'cay', requested_qty: 12, people: 4, max_qty: 10, over_max: false }] };
  const REPORT = { ym: '2026-10', byItem: [{ key: 'i-pen', item_id: 'i-pen', name: 'Bút bi xanh', name_en: null, unit: 'cay', requested: 12, backlog_prev: 3, stock: 14, need: 1 }], custom: [], byDepartment: [], issues: [], pending_custom_count: 0 };
  const route = (url: string) =>
    url === '/api/admin/periods/2026-10/requests?by=item' ? jsonResponse(200, BY_ITEM) : url === '/api/admin/reports/2026-10' ? jsonResponse(200, REPORT) : undefined;

  it('"Theo món" → ?view=items; cột Món · ĐVT · Số người đặt · Đặt · Tủ · Cần mua; Cần mua lấy số của Báo cáo (12 + 3 − 14 = 1)', async () => {
    stubMonthApi(route);
    open();
    await table();
    await userEvent.click(screen.getByRole('radio', { name: 'Theo món' }));
    await waitFor(() => expect(search()).toContain('view=items'));
    const t = within(await screen.findByRole('table', { name: 'Theo món' }));
    expect(t.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Món', 'ĐVT', 'Số người đặt', 'Đặt', 'Tủ', 'Cần mua']);
    const row = t.getByText('Bút bi xanh').closest('tr')!;
    expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Bút bi xanh', 'cây', '4', '12', '14', '1']);
  });
});
