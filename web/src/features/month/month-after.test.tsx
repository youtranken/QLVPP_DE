import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within } from '@/test/test-utils';
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
const rowOf = async (name: string) => (await table()).getByText(name).closest('tr')!;
const search = () => screen.getByTestId('location-search').textContent ?? '';

const leftOwing = (i: number) =>
  person({ request_id: `r-l${i}`, user_sub: `u-l${i}`, full_name: `Người nghỉ ${i}`, user_status: 'locked', department: 'Phòng Test', total_qty: 3, delivered_qty: 0 });
const LEFT_DONE = person({ request_id: 'r-ld', user_sub: 'u-ld', full_name: 'Người nghỉ đã nhận', user_status: 'locked', department: 'Phòng Test', total_qty: 2, delivered_qty: 2 });

describe('TC-05 dải tiến trình 4 bước', () => {
  it('danh sách có thứ tự, bước hiện tại aria-current="step", không bước nào là nút hay link', async () => {
    stubMonthApi();
    open();
    await table();
    const steps = screen.getByRole('list', { name: 'Các bước của tháng' });
    expect(steps.tagName).toBe('OL');
    const items = within(steps).getAllByRole('listitem');
    expect(items.map((li) => li.getAttribute('aria-current'))).toEqual([null, null, 'step', null]);
    expect(within(steps).queryAllByRole('button')).toHaveLength(0);
    expect(within(steps).queryAllByRole('link')).toHaveLength(0);
  });
});

describe('AD-04 bộ chọn kỳ trên thanh công cụ', () => {
  it('nhóm "Chọn kỳ" nằm trong role=toolbar cùng ô tìm; đầu trang chỉ còn tiêu đề và nhãn kỳ', async () => {
    stubMonthApi();
    open();
    await table();
    const bar = screen.getByRole('toolbar', { name: 'Thanh công cụ Kỳ tháng' });
    expect(within(bar).getByRole('group', { name: 'Chọn kỳ' })).toBeInTheDocument();
    expect(within(bar).getByRole('searchbox', { name: 'Tìm người hoặc phòng' })).toBeInTheDocument();
    const head = screen.getByRole('heading', { level: 1, name: 'Kỳ tháng 10' }).parentElement!;
    expect(within(head).getByText('Đang giao')).toHaveClass('tag');
  });

  it('kỳ đăng ký bấm ‹ sang kỳ đang giao (thanh công cụ dựng lại): focus vẫn ở nút "Tháng trước"', async () => {
    stubMonthApi();
    open('/admin/month?ym=2026-11');
    await (await table()).findByText('Nhân viên B');
    await userEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));
    await waitFor(() => expect(search()).toContain('ym=2026-10'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Kỳ tháng 10' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tháng trước' })).toHaveFocus());
  });

  it('kỳ đang đăng ký cũng có bộ chọn kỳ trong thanh công cụ', async () => {
    stubMonthApi();
    open('/admin/month?ym=2026-11');
    await (await table()).findByText('Nhân viên B');
    expect(within(screen.getByRole('toolbar', { name: 'Thanh công cụ Kỳ tháng' })).getByRole('group', { name: 'Chọn kỳ' })).toBeInTheDocument();
  });
});

describe('AD-05 AD-06 AD-07 TC-08 người đã nghỉ', () => {
  const people = [...PEOPLE, leftOwing(1), leftOwing(2), LEFT_DONE];

  it('băng một dòng "2 người đã nghỉ còn phần chưa nhận." không kể tên, không có nút "Xem nợ tháng trước"', async () => {
    stubMonthApi(undefined, people);
    open();
    await table();
    const alert = await screen.findByText('2 người đã nghỉ còn phần chưa nhận.');
    const band = alert.closest('.alert')!;
    expect(band).not.toHaveTextContent('Người nghỉ 1');
    expect(screen.queryByRole('link', { name: 'Xem nợ tháng trước' })).toBeNull();
    expect(within(band as HTMLElement).getByRole('button', { name: 'Lọc 2 người này' })).toBeInTheDocument();
  });

  it('không ai đã nghỉ còn phần chưa nhận (chỉ người đã nhận đủ) → không có băng, không có chip "Người đã nghỉ"', async () => {
    stubMonthApi(undefined, [...PEOPLE, LEFT_DONE]);
    open();
    await table();
    expect(screen.queryByText(/người đã nghỉ còn phần chưa nhận/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Người đã nghỉ/ })).toBeNull();
  });

  it('"Lọc 2 người này" bật chip "Người đã nghỉ 2" (aria-pressed) và bảng còn đúng 2 dòng; "Đang hiện 2/8 người"', async () => {
    stubMonthApi(undefined, people);
    open();
    const t = await table();
    const chip = await screen.findByRole('button', { name: /^Người đã nghỉ/ });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(chip).toHaveTextContent('2');
    await userEvent.click(screen.getByRole('button', { name: 'Lọc 2 người này' }));
    await waitFor(() => expect(search()).toContain('left=1'));
    expect(screen.getByRole('button', { name: /^Người đã nghỉ/ })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(t.getAllByRole('row')).toHaveLength(3));
    expect(t.getByText('Người nghỉ 1')).toBeInTheDocument();
    expect(t.queryByText('Người nghỉ đã nhận')).toBeNull();
    expect(screen.getByText('Đang hiện 2/8 người')).toBeInTheDocument();
  });

  it('bấm lại chip "Người đã nghỉ" thì bỏ lọc', async () => {
    stubMonthApi(undefined, people);
    open('/admin/month?ym=2026-10&left=1');
    const t = await table();
    await userEvent.click(await screen.findByRole('button', { name: /^Người đã nghỉ/ }));
    await waitFor(() => expect(search()).not.toContain('left=1'));
    expect(await t.findByText('Nhân viên A')).toBeInTheDocument();
  });

  it('TC-08 dòng người đã nghỉ có lớp row--attn-warn, dòng người còn làm thì không', async () => {
    stubMonthApi(undefined, people);
    open();
    expect(await rowOf('Người nghỉ 1')).toHaveClass('row--attn-warn');
    expect(await rowOf('Nhân viên A')).not.toHaveClass('row--attn-warn');
  });
});

describe('AD-08 Lọc phòng', () => {
  const AREA = [
    person({ request_id: 'r-1', user_sub: 'u-1', full_name: 'Người A1', department: 'Phòng A' }),
    person({ request_id: 'r-2', user_sub: 'u-2', full_name: 'Người B1', department: 'Phòng B' }),
    person({ request_id: 'r-3', user_sub: 'u-3', full_name: 'Người C1', department: 'Phòng C' }),
  ];

  it('nút "Lọc phòng" nằm trong thanh công cụ; chọn Phòng A → nút ghi "Lọc phòng: Phòng A", hàng Đang lọc có chip gỡ được', async () => {
    stubMonthApi(undefined, AREA);
    open();
    const t = await table();
    const bar = screen.getByRole('toolbar', { name: 'Thanh công cụ Kỳ tháng' });
    expect(within(bar).queryByRole('button', { name: '+ Thêm khu' })).toBeNull();
    await userEvent.click(within(bar).getByRole('button', { name: 'Lọc phòng' }));
    const dialog = await screen.findByRole('dialog', { name: 'Lọc phòng' });
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Phòng A' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Áp dụng' }));
    await waitFor(() => expect(t.queryByText('Người B1')).toBeNull());
    expect(within(bar).getByRole('button', { name: 'Lọc phòng: Phòng A' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc Phòng A' }));
    expect(await t.findByText('Người B1')).toBeInTheDocument();
  });
});

describe('AD-09 "Đang hiện" chỉ khi lọc', () => {
  it('không lọc không tìm → không có "Đang hiện"; chip Có ghi chú (4/5) → "Đang hiện 4/5 người"', async () => {
    stubMonthApi();
    open();
    await table();
    expect(screen.queryByText(/^Đang hiện/)).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: /^Có ghi chú/ }));
    expect(await screen.findByText('Đang hiện 4/5 người')).toBeInTheDocument();
  });

  it('tìm khớp cả 3/3 → không hiện; tìm còn 2/3 → "Đang hiện 2/3 người"', async () => {
    const all = [1, 2, 3].map((i) => person({ request_id: `r-${i}`, user_sub: `u-${i}`, full_name: i < 3 ? `Người số ${i}` : 'Khác hẳn', department: 'Phòng Chung' }));
    stubMonthApi(undefined, all);
    open('/admin/month?ym=2026-10&q=ph%C3%B2ng+chung');
    const t = await table();
    await t.findByText('Khác hẳn');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/^Đang hiện/)).toBeNull();
    const box = screen.getByRole('searchbox', { name: 'Tìm người hoặc phòng' });
    await userEvent.clear(box);
    await userEvent.type(box, 'người số');
    expect(await screen.findByText('Đang hiện 2/3 người')).toBeInTheDocument();
  });
});

describe('AD-10 AD-11 bảng người', () => {
  it('không có ô chữ cái trên tên người', async () => {
    stubMonthApi();
    open();
    const row = await rowOf('Nhân viên A');
    expect(row.querySelector('.sm-avatar')).toBeNull();
    expect(within(row).queryByText('N', { exact: true })).toBeNull();
  });

  it('cột Trạng thái là nhãn màu: "Chưa giao" tag, "Đã giao 2/6" tag--info, "Đã nhận đủ" tag--ok', async () => {
    stubMonthApi();
    open();
    expect(within(await rowOf('Nhân viên A')).getByText('Chưa giao')).toHaveClass('tag');
    expect(within(await rowOf('Nhân viên B')).getByText('Đã giao 2/6')).toHaveClass('tag', 'tag--info');
    expect(within(await rowOf('Nhân viên E')).getByText('Đã nhận đủ')).toHaveClass('tag', 'tag--ok');
  });
});

describe('AD-12 kỳ đang đăng ký dùng chung bảng', () => {
  it('cột Người · Đặt hàng · Ghi chú · Trạng thái; không còn nút chữ "Xem"; bấm dòng mở phiếu; ⋯ có "Xem phiếu"', async () => {
    stubMonthApi();
    open('/admin/month?ym=2026-11');
    const t = await table();
    await t.findByText('Nhân viên B');
    expect(t.getAllByRole('columnheader').map((h) => h.textContent).slice(0, 4)).toEqual(['Người', 'Đặt hàng', 'Ghi chú', 'Trạng thái']);
    expect(t.queryByRole('button', { name: /^Xem phiếu của/ })).toBeNull();
    const row = t.getByText('Nhân viên B').closest('tr')!;
    expect(within(row).getByText('Đã lưu')).toHaveClass('tag');
    await userEvent.click(within(row).getByText('Nhân viên B'));
    expect(await screen.findByRole('dialog', { name: 'Phiếu của Nhân viên B' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(row).getByRole('button', { name: 'Thao tác cho Nhân viên B' }));
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Xem phiếu']);
  });
});

describe('AD-13 ngăn Phiếu của …', () => {
  it('chỉ có nút đóng ✕ ở đầu, không có nút "Đóng" ở chân', async () => {
    stubMonthApi();
    open();
    await userEvent.click(within(await rowOf('Nhân viên A')).getByText('8 món · 36 SL'));
    const dialog = await screen.findByRole('dialog', { name: 'Phiếu của Nhân viên A' });
    expect(within(dialog).getAllByRole('button', { name: 'Đóng' })).toHaveLength(1);
    expect(dialog.querySelector('.ovp-foot')).toBeNull();
  });
});
