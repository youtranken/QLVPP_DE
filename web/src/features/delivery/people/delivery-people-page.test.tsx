import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { expectFixedColumns } from '@/test/fixed-columns';
import { A, B, C, D, person, pLine } from './people-fixtures';

import { PEOPLE_URL, callsTo, card, names, open, search, stub } from './delivery-page-fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('DeliveryPeoplePage — đầu trang và tab', () => {
  it('tiêu đề "Giao hàng kỳ tháng 10", gọi delivery-people của kỳ khóa gần nhất (tháng hiện tại 11 − 1)', async () => {
    const f = stub();
    open();
    expect(await screen.findByRole('heading', { level: 1, name: 'Giao hàng kỳ tháng 10' })).toBeInTheDocument();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    // Cùng khóa với huy hiệu sidebar (QueryClient của test staleTime 0 nên có thể tải hai lần); chỉ kỳ khóa gần nhất
    expect(callsTo(f, PEOPLE_URL).length).toBeGreaterThan(0);
    expect(f.mock.calls.filter(([u]) => String(u).includes('delivery-people') && u !== PEOPLE_URL)).toHaveLength(0);
    expect(screen.queryByText(/đang mở, xem được từ/)).toBeNull();
  });

  const statTab = (label: string) => screen.getByRole('tab', { name: new RegExp(`^${label}`) });
  const value = (label: string) => statTab(label).querySelector('.stat-card__v')?.textContent;

  it('TC-04 năm thẻ số là bộ lọc: Chưa nhận 3 · Giao được ngay 2 · Giao một phần 1 · Đã nhận đủ 1 · Người đã nghỉ 0; mặc định Chưa nhận có A, B, C', async () => {
    stub();
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    expect(within(screen.getByRole('tablist', { name: 'Lọc theo trạng thái' })).getAllByRole('tab')).toHaveLength(5);
    expect(['Chưa nhận', 'Giao được ngay', 'Giao một phần', 'Đã nhận đủ', 'Người đã nghỉ'].map(value)).toEqual(['3', '2', '1', '1', '0']);
    expect(statTab('Chưa nhận')).toHaveAttribute('aria-selected', 'true');
    expect(statTab('Chưa nhận')).toHaveTextContent('trong đó 2 giao được ngay');
    expect(names()).toEqual(['Nguyễn Văn An', 'Lê Thị Bình', 'Trần Minh Khoa']);
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('bấm thẻ Giao một phần → ?tab=partial, bảng chỉ B (số dòng = số trên thẻ); bấm Chưa nhận → bỏ ?tab', async () => {
    stub();
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    await userEvent.click(statTab('Giao một phần'));
    expect(search()).toContain('tab=partial');
    expect(names()).toEqual(['Lê Thị Bình']);
    expect(statTab('Giao một phần')).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(statTab('Chưa nhận'));
    expect(search()).not.toContain('tab=');
  });

  it('người đã nghỉ còn phần: thẻ Người đã nghỉ 1 nền đỏ nhạt, bấm → chỉ người đó', async () => {
    stub({ people: [A, person({ user_sub: 'u-x', full_name: 'Đặng Thị Mỹ Duyên', user_status: 'locked', request_id: 'r-x', lines: [pLine({ line_id: 'lx', request_id: 'r-x' })] })] });
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    expect(value('Người đã nghỉ')).toBe('1');
    expect(statTab('Người đã nghỉ')).toHaveClass('stat-card--danger');
    await userEvent.click(statTab('Người đã nghỉ'));
    expect(names()).toEqual(['Đặng Thị Mỹ Duyên']);
  });

  it('?tab=done mở thẳng thẻ Đã nhận đủ; nút vẫn ghi "Giao…" ở trạng thái tắt, lý do "Đã giao" qua aria-describedby (AD-28)', async () => {
    stub();
    open('/admin/delivery?tab=done');
    expect(await screen.findByText('Đỗ Mai Linh', { selector: '.pt-person b' })).toBeInTheDocument();
    const btn = within(card('Đỗ Mai Linh')).getByRole('button', { name: 'Giao…, Đỗ Mai Linh' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/^Giao…$/);
    expect(btn).toHaveAccessibleDescription('Đã giao');
    expect(btn).toHaveAttribute('title', 'Đã giao');
  });

  it('?tab=debt / ?tab=all cũ → thẻ Chưa nhận', async () => {
    stub();
    open('/admin/delivery?tab=debt');
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    expect(statTab('Chưa nhận')).toHaveAttribute('aria-selected', 'true');
  });

  it('từ khóa bỏ dấu "binh" tìm trên mọi tab và ghi ?q=; xóa từ khóa trả về tab', async () => {
    stub();
    open('/admin/delivery?tab=done');
    await screen.findByText('Đỗ Mai Linh', { selector: '.pt-person b' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm tên hoặc phòng ban' }), 'binh');
    expect(names()).toEqual(['Lê Thị Bình']);
    expect(search()).toContain('q=binh');
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Tìm tên hoặc phòng ban' }));
    expect(names()).toEqual(['Đỗ Mai Linh']);
  });

  it('cột cố định bề rộng (đổi tab không dời cột); nút giao và ⋯ chung một khối ô Thao tác (G4)', async () => {
    stub();
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    expectFixedColumns(screen.getByRole('table'));
    const acts = card('Nguyễn Văn An').querySelector('td.pt-acts > .pt-acts__in');
    expect(acts?.children).toHaveLength(2);
    expect(acts?.firstElementChild).toHaveAccessibleName(/, Nguyễn Văn An$/);
    expect(acts?.lastElementChild).toHaveAccessibleName('Thao tác cho Nguyễn Văn An');
  });

  it('tìm "zzzz" không ai khớp → "Không có ai khớp" + nút "Xóa lọc" (bỏ ?q=, hiện lại danh sách); thẻ đang chọn giữ nguyên', async () => {
    stub();
    open('/admin/delivery?q=zzzz');
    expect(await screen.findByText('Không có ai khớp')).toBeInTheDocument();
    expect(screen.queryByText('Không có ai trong mục này.')).toBeNull();
    expect(screen.getByRole('tab', { name: /^Chưa nhận/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    expect(search()).not.toContain('q=');
    expect(await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' })).toBeInTheDocument();
  });
});

describe('DeliveryPeoplePage — trang Giao hàng bản cũ đã gỡ', () => {
  it('/admin/delivery/classic?ym=2026-12 → /admin/delivery?ym=2026-12 (thay thế, không thêm lịch sử)', async () => {
    stub();
    open('/admin/delivery/classic?ym=2026-12&request=r-1');
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/admin\/delivery$/);
    expect(search()).toBe('?ym=2026-12');
  });

  it('menu không còn "Giao hàng (bản cũ)"; mã nguồn không còn trang cũ', async () => {
    stub();
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    expect(screen.queryByRole('link', { name: 'Giao hàng (bản cũ)' })).toBeNull();
    const routes = readFileSync(resolve(__dirname, '../../../shell/app-routes.tsx'), 'utf8');
    expect(routes).not.toMatch(/delivery-page'/);
    expect(existsSync(resolve(__dirname, '../delivery-page.tsx'))).toBe(false);
  });

  it('?request=… cũ (không có person) ở lại trang Giao hàng', async () => {
    stub();
    open('/admin/delivery?person=u-a&request=r-1');
    await screen.findByRole('dialog', { name: 'Nguyễn Văn An' });
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/admin\/delivery$/);
  });
});

describe('DeliveryPeoplePage — giao thiếu và tủ trống', () => {
  const served = person({ user_sub: 'u-s1', full_name: 'Sơn Giao Thiếu', lines: [pLine({ line_id: 'ls', qty: 10, delivered_qty: 7, remaining_qty: 3, stock_qty: 9 })] });

  it('người đã nhận một phần tháng đang giao vẫn ở "Chưa nhận"; tủ đủ phần còn lại → cũng ở "Giao được ngay"', async () => {
    stub({ people: [served, A] });
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    expect(screen.getByRole('tab', { name: /^Chưa nhận/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Sơn Giao Thiếu', { selector: '.pt-person b' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /^Giao được ngay/ }));
    expect(screen.getByText('Sơn Giao Thiếu', { selector: '.pt-person b' })).toBeInTheDocument();
  });

  it('tủ 0 → nút "Giao…" tắt, lý do "Tủ chưa có hàng"; tủ 0 nhưng có dòng NCC hết hàng → bật "Giao…"; tủ 1 → "Giao…"', async () => {
    const none = person({ user_sub: 'u-n', full_name: 'Nam Hết Hàng', lines: [pLine({ line_id: 'ln', stock_qty: 0 })] });
    const adm = person({ user_sub: 'u-m', full_name: 'Minh NCC Hết', lines: [pLine({ line_id: 'lm', item_id: 'i-clip', stock_qty: 0, adm_out: true })] });
    const one = person({ user_sub: 'u-o', full_name: 'Oanh Còn Một', lines: [pLine({ line_id: 'lo', item_id: 'i-a4', stock_qty: 1 })] });
    stub({ people: [none, adm, one] });
    open();
    await screen.findByText('Nam Hết Hàng', { selector: '.pt-person b' });
    const none0 = within(card('Nam Hết Hàng')).getByRole('button', { name: /^Giao…/ });
    expect(none0).toBeDisabled();
    expect(none0).toHaveAccessibleDescription('Tủ chưa có hàng');
    expect(within(card('Minh NCC Hết')).getByRole('button', { name: /^Giao…/ })).toBeEnabled();
    expect(within(card('Oanh Còn Một')).getByRole('button', { name: /^Giao…/ })).toBeEnabled();
  });

  it('chỉ còn món ngoài DM đã duyệt chưa về hàng (deliver_cap 0) → nút chính vô hiệu như tủ trống; đã về 1 → "Giao…"', async () => {
    const wait = person({ user_sub: 'u-w', full_name: 'Vy Chờ Hàng', lines: [pLine({ line_id: 'lw', item_id: null, stock_qty: null, name: 'Bìa còng', review_status: 'accepted', deliver_cap: 0 })] });
    const got = person({ user_sub: 'u-g', full_name: 'Giang Có Hàng', lines: [pLine({ line_id: 'lg', item_id: null, stock_qty: null, name: 'Bìa còng', review_status: 'accepted', deliver_cap: 1 })] });
    stub({ people: [wait, got] });
    open();
    await screen.findByText('Vy Chờ Hàng', { selector: '.pt-person b' });
    expect(within(card('Vy Chờ Hàng')).getByRole('button', { name: /^Giao…/ })).toHaveAccessibleDescription('Tủ chưa có hàng');
    expect(within(card('Vy Chờ Hàng')).getByRole('button', { name: /^Giao…/ })).toBeDisabled();
    expect(within(card('Giang Có Hàng')).getByRole('button', { name: /^Giao…/ })).toBeEnabled();
  });
});

describe('DeliveryPeoplePage — tiến độ trên thẻ', () => {
  it('Tiến độ giao (G4): đã giao 7/10 → "7/10"; chưa giao → "0/3"; trừ phần hủy khỏi mẫu số → "4/8"', async () => {
    const partial = person({ user_sub: 'u-p', full_name: 'Phan Văn Phần', status: 'debt', lines: [pLine({ line_id: 'lp', qty: 10, delivered_qty: 7, remaining_qty: 3, stock_qty: 0 })] });
    const cancelled = person({ user_sub: 'u-x', full_name: 'Xuân Hủy', status: 'debt', lines: [pLine({ line_id: 'lx', qty: 10, delivered_qty: 4, cancelled_qty: 2, remaining_qty: 4, stock_qty: 9 })] });
    stub({ people: [partial, cancelled, A] });
    open();
    await screen.findByText('Phan Văn Phần', { selector: '.pt-person b' });
    expect(within(card('Phan Văn Phần')).getByText('7/10')).toBeInTheDocument();
    expect(within(card('Xuân Hủy')).getByText('4/8')).toBeInTheDocument();
    expect(within(card('Nguyễn Văn An')).getByText('0/3')).toBeInTheDocument();
  });
});

const SHARED = person({
  user_sub: 'u-s',
  full_name: 'Sử Chung Món',
  request_id: 'r-s',
  lines: [
    pLine({ line_id: 'ls0', request_id: 'r-s0', period_ym: '2026-09', is_debt: true, item_id: 'i-a4', name: 'Giấy A4', qty: 3, remaining_qty: 3, stock_qty: 6 }),
    pLine({ line_id: 'ls1', request_id: 'r-s', item_id: 'i-a4', name: 'Giấy A4', qty: 5, remaining_qty: 5, stock_qty: 6 }),
  ],
});
const writes = (f: ReturnType<typeof stub>) => f.mock.calls.filter(([, i]) => i?.method === 'POST').map(([u]) => String(u));

describe('DeliveryPeoplePage — nút chính trên thẻ mở hộp giao', () => {
  it('trước đây "Giao đủ" giao thẳng: nay "Giao…" mở hộp, 0 request deliver/deliver-all, URL không đổi', async () => {
    const f = stub();
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    const btn = within(card('Nguyễn Văn An')).getByRole('button', { name: 'Giao…, Nguyễn Văn An' });
    await userEvent.click(btn);
    expect(await screen.findByRole('dialog', { name: 'Giao cho Nguyễn Văn An?' })).toBeInTheDocument();
    expect(writes(f)).toEqual([]);
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/admin\/delivery$/);
    expect(search()).toBe('');
  });

  it('thẻ thiếu hàng (B cần 10, tủ 7, A trước 3) → hộp (không mở panel), đề xuất = tủ còn sau người trước (4)', async () => {
    const f = stub();
    open();
    await screen.findByText('Lê Thị Bình', { selector: '.pt-person b' });
    await userEvent.click(within(card('Lê Thị Bình')).getByRole('button', { name: /^Giao…/ }));
    const dlg = await screen.findByRole('dialog', { name: 'Giao cho Lê Thị Bình?' });
    expect((within(dlg).getByRole('spinbutton', { name: 'Giao lần này: Bút bi xanh' }) as HTMLInputElement).value).toBe('4');
    expect(within(dlg).getByText('Giữ 3 cho 1 người đăng ký trước')).toBeInTheDocument();
    expect(search()).not.toContain('person=');
    expect(writes(f)).toEqual([]);
  });

  it('cùng món ở hai dòng (nợ 3 + kỳ này 5, tủ 6) → hộp với 3 rồi 3', async () => {
    stub({ people: [SHARED] });
    open();
    await screen.findByText('Sử Chung Món', { selector: '.pt-person b' });
    await userEvent.click(within(card('Sử Chung Món')).getByRole('button', { name: /^Giao…/ }));
    const dlg = await screen.findByRole('dialog');
    expect((within(dlg).getAllByRole('spinbutton') as HTMLInputElement[]).map((i) => i.value)).toEqual(['3', '3']);
  });

  it('Xác nhận → deliver từng dòng (không deliver-all), toast, hộp đóng, focus về ô tìm với chữ đã chọn', async () => {
    const f = stub();
    open('/admin/delivery?q=An');
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    await userEvent.click(within(card('Nguyễn Văn An')).getByRole('button', { name: /^Giao…/ }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Xác nhận giao' }));
    expect(await screen.findByText('Đã giao cho Nguyễn Văn An')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes(f)).toEqual(['/api/admin/lines/la/deliver']);
    const input = screen.getByRole('searchbox', { name: 'Tìm tên hoặc phòng ban' }) as HTMLInputElement;
    await waitFor(() => expect(input).toHaveFocus());
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, input.value.length]);
  });

  it('lỗi một dòng → "Mở chi tiết người" đóng hộp và mở panel người đó', async () => {
    stub({ deliver: () => jsonResponse(409, { code: 'STOCK_INSUFFICIENT', available: 0 }) });
    open();
    await screen.findByText('Trần Minh Khoa', { selector: '.pt-person b' });
    await userEvent.click(within(card('Trần Minh Khoa')).getByRole('button', { name: /^Giao…/ }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Xác nhận giao' }));
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Mở chi tiết người' }));
    await waitFor(() => expect(search()).toContain('person=u-c'));
    expect(screen.queryByRole('dialog', { name: /^Giao cho/ })).toBeNull();
  });

  it('thẻ chỉ có dòng chờ duyệt: nút "Giao…" tắt, lý do "Chờ duyệt"', async () => {
    stub({ people: [person({ lines: [pLine({ review_status: 'pending', item_id: null })] })] });
    open();
    const btn = await screen.findByRole('button', { name: /^Giao…/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibleDescription('Chờ duyệt');
  });

  it('use-quick-deliver chỉ tính đề xuất: không import API ghi', () => {
    const src = readFileSync(resolve(__dirname, 'use-quick-deliver.ts'), 'utf8');
    expect(src).not.toMatch(/delivery\.api|backlog\.api|deliverLine|deliverAll|deliverSelected|cancelRemaining|apiFetch/);
  });
});

describe('DeliveryPeoplePage — tủ thiếu', () => {
  it('tủ bút 7 < A + B chờ 13 → cột Tủ "Thiếu: Bút bi xanh" ở dòng của A và B; không còn banner đầu trang, không có "Xem ở Tủ / Kho"', async () => {
    stub();
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    expect(within(card('Nguyễn Văn An')).getByText('Thiếu: Bút bi xanh')).toBeInTheDocument();
    expect(within(card('Lê Thị Bình')).getByText('Thiếu: Bút bi xanh')).toBeInTheDocument();
    expect(screen.queryByText(/chưa đủ tủ cho người/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Xem ở Tủ / Kho' })).toBeNull();
  });

  it('đủ tủ → cột Tủ "Đủ", không có "Thiếu:"', async () => {
    stub({ people: [A] });
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    expect(within(card('Nguyễn Văn An')).getByText('Đủ')).toBeInTheDocument();
    expect(screen.queryByText(/^Thiếu:/)).toBeNull();
  });
});

describe('fixtures khớp', () => {
  it('đủ 4 người', () => {
    expect([A, B, C, D]).toHaveLength(4);
  });
});
