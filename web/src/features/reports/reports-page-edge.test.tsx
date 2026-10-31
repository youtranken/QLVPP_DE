import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { reportFixture } from './reports-fixtures';
import { errorResponse, postsOf, stubReports } from './reports-test-stub';

function openPage(path = '/admin/reports') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
}

const orderCell = (name: string) => screen.findByRole('textbox', { name: `Đặt mua ${name}` });
const periodCalls = (f: ReturnType<typeof stubReports>) => f.mock.calls.filter((c) => c[0] === '/api/periods/current').length;
const invalidPeriod = () => jsonResponse(400, { code: 'INVALID_PERIOD', message: 'x' });

async function typeInto(cell: HTMLElement, text: string) {
  await userEvent.clear(cell);
  await userEvent.type(cell, text);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ReportsPage — INVALID_PERIOD khi chốt', () => {
  it('đang xem tháng khác mặc định → về kỳ khóa gần nhất và tải lại kỳ hiện tại, không POST thêm', async () => {
    const f = stubReports({ post: invalidPeriod });
    openPage('/admin/reports?ym=2026-11');
    await orderCell('Bút bi xanh');
    const before = periodCalls(f);
    await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?ym=2026-10'));
    await waitFor(() => expect(periodCalls(f)).toBeGreaterThan(before));
    expect(postsOf(f)).toHaveLength(1);
  });

  it('đang ở tháng mặc định → khối "Tháng này chưa tới, chưa lập báo cáo được." và tải lại kỳ hiện tại', async () => {
    const f = stubReports({ post: invalidPeriod });
    openPage();
    await orderCell('Bút bi xanh');
    const before = periodCalls(f);
    await userEvent.click(screen.getByRole('button', { name: 'In trình ký' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tháng này chưa tới, chưa lập báo cáo được.');
    await waitFor(() => expect(periodCalls(f)).toBeGreaterThan(before));
  });
});

describe('ReportsPage — Phần 1 khi thiếu nhóm, lọc Cần mua', () => {
  it('admin/items lỗi → báo nhỏ trên Phần 1 + "Thử lại", số vẫn hiện; thử lại được thì hết báo', async () => {
    let fail = true;
    const f = stubReports();
    const base = f.getMockImplementation()!;
    f.mockImplementation(async (url: string, init?: RequestInit) => (url === '/api/admin/items' && fail ? errorResponse(500, 'INTERNAL') : base(url, init)));
    openPage();
    const part1 = await screen.findByRole('region', { name: 'Phần 1 · Tổng hợp theo món' });
    expect(await within(part1).findByText('Chưa tải được nhóm món — các món tạm nằm ở "Chưa xếp nhóm".', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(await orderCell('Bút bi xanh')).toHaveValue('10');
    fail = false;
    await userEvent.click(within(part1).getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(within(part1).queryByText(/Chưa tải được nhóm món/)).toBeNull());
    expect(await within(part1).findByRole('rowheader', { name: /Bút viết/ })).toBeInTheDocument();
  });

  it('"Chỉ món cần mua" vẫn giữ hàng Cần mua 0 đã sửa hoặc đang lỗi', async () => {
    stubReports({
      reports: {
        '2026-10': reportFixture({
          byItem: [...reportFixture().byItem, { key: 'item-clip', item_id: 'item-clip', name: 'Kẹp giấy', name_en: null, unit: 'hop', requested: 0, backlog_prev: 0, stock: 4, need: 0 }],
        }),
      },
    });
    openPage();
    await typeInto(await orderCell('Hồ dán'), '3');
    await typeInto(await orderCell('Kẹp giấy'), 'x');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chỉ món cần mua' }));
    expect(await orderCell('Hồ dán')).toHaveValue('3');
    expect(await orderCell('Kẹp giấy')).toHaveAttribute('aria-invalid', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Về Cần mua (0) Hồ dán' }));
    expect(screen.queryByRole('textbox', { name: 'Đặt mua Hồ dán' })).toBeNull();
  });
});

describe('ReportsPage — hộp món chờ', () => {
  const pending = () => stubReports({ reports: { '2026-10': reportFixture({ pending_custom_count: 2 }) } });

  it('đóng bằng nút X hoặc Esc → không POST', async () => {
    const f = pending();
    openPage();
    await orderCell('Bút bi xanh');
    await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Còn 2 món ngoài danh mục chưa xem' })).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'In trình ký' }));
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(postsOf(f)).toEqual([]);
  });

  it('"Xem món chờ" khi có ô sửa → hỏi như đổi tháng; "Tiếp tục sửa" ở lại giữ số; "Bỏ thay đổi" sang Món ngoài danh mục', async () => {
    const f = pending();
    openPage();
    const pen = await orderCell('Bút bi xanh');
    await typeInto(pen, '7');
    const review = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
      await userEvent.click(within(await screen.findByRole('dialog', { name: 'Còn 2 món ngoài danh mục chưa xem' })).getByRole('button', { name: 'Xem món chờ' }));
      return screen.findByRole('dialog', { name: 'Bỏ số Đặt mua đã sửa?' });
    };
    await userEvent.click(within(await review()).getByRole('button', { name: 'Tiếp tục sửa' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/admin\/reports$/);
    expect(await orderCell('Bút bi xanh')).toHaveValue('7');
    await userEvent.click(within(await review()).getByRole('button', { name: 'Bỏ thay đổi' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/admin/review'));
    expect(postsOf(f)).toEqual([]);
  });
});
