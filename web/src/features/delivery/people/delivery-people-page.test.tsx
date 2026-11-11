import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';
import type { DeliveryPerson } from './delivery-people.api';
import { A, B, C, D, PEOPLE, person, pLine } from './people-fixtures';

const PEOPLE_URL = '/api/admin/periods/2026-10/delivery-people';
const SUMMARY = { lines_pending_delivery: 4, deadline: '2026-10-10T17:00:00.000Z' };

interface Stub {
  people?: DeliveryPerson[] | (() => DeliveryPerson[]);
  deliver?: (url: string) => Response;
  locked?: boolean;
}

function stub(s: Stub = {}) {
  const people = s.people ?? PEOPLE;
  return stubShellApi({
    '/api/admin/periods/2026-10/summary': () => jsonResponse(200, SUMMARY),
    [PEOPLE_URL]: () =>
      s.locked === false
        ? jsonResponse(409, { code: 'PERIOD_NOT_LOCKED' })
        : jsonResponse(200, { ym: '2026-10', people: typeof people === 'function' ? people() : people }),
    '/api/admin/lines/la/deliver': () => s.deliver?.('la') ?? jsonResponse(200, { request_complete: true }),
    '/api/admin/lines/lb/deliver': () => s.deliver?.('lb') ?? jsonResponse(200, { request_complete: true }),
    '/api/admin/lines/lc/deliver': () => s.deliver?.('lc') ?? jsonResponse(200, { request_complete: true }),
  });
}

const callsTo = (f: ReturnType<typeof stub>, url: string) => f.mock.calls.filter(([u]) => u === url);
const search = () => screen.getByTestId('location-search').textContent ?? '';
const card = (name: string) => screen.getByText(name, { selector: '.pt-person b' }).closest('tr') as HTMLElement;
const names = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getByRole('checkbox').getAttribute('aria-label')?.replace('Chọn ', ''));

function open(path = '/admin/delivery', width = 1280) {
  mockViewport(width);
  renderApp(makeMe('admin'), path);
}

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

  it('số trên tab đúng (B ở cả hai tab): Chưa nhận 2, Còn nợ 2, Đã nhận 1, Tất cả 4; mặc định tab Chưa nhận chỉ có A và B', async () => {
    stub();
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    for (const name of ['Chưa nhận, 2', 'Còn nợ, 2', 'Đã nhận, 1', 'Tất cả, 4']) expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Chưa nhận, 2' })).toBeChecked();
    expect(names()).toEqual(['Nguyễn Văn An', 'Lê Thị Bình']);
  });

  it('người chỉ có nợ (không phiếu kỳ này) có ở tab Còn nợ với dòng cam "Nợ tháng 9: 1 món"; đổi tab ghi ?tab=debt', async () => {
    stub();
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Còn nợ, 2' }));
    expect(search()).toContain('tab=debt');
    expect(names()).toEqual(['Lê Thị Bình', 'Trần Minh Khoa']);
    expect(within(card('Trần Minh Khoa')).getByText('Nợ tháng 9: 1 món')).toBeInTheDocument();
  });

  it('?tab=done mở thẳng tab Đã nhận; nút thẻ đã nhận là "Đã giao" và vô hiệu', async () => {
    stub();
    open('/admin/delivery?tab=done');
    expect(await screen.findByText('Đỗ Mai Linh', { selector: '.pt-person b' })).toBeInTheDocument();
    expect(within(card('Đỗ Mai Linh')).getByRole('button', { name: /^Đã giao/ })).toBeDisabled();
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

  it('không ai khớp → câu rỗng, không vỡ', async () => {
    stub();
    open('/admin/delivery?q=zzz');
    expect(await screen.findByText('Không có ai trong mục này.')).toBeInTheDocument();
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

  it('người đã nhận một phần tháng đang giao vẫn ở "Chưa nhận", không ở "Còn nợ"', async () => {
    stub({ people: [served, A] });
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    expect(screen.getByRole('radio', { name: 'Chưa nhận, 2' })).toBeChecked();
    expect(screen.getByText('Sơn Giao Thiếu', { selector: '.pt-person b' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Còn nợ, 0' }));
    expect(screen.queryByText('Sơn Giao Thiếu', { selector: '.pt-person b' })).toBeNull();
  });

  it('tủ 0 → nút chính vô hiệu "Tủ chưa có hàng"; tủ 0 nhưng có dòng NCC hết hàng → bật "Giao…"; tủ 1 → "Giao…"', async () => {
    const none = person({ user_sub: 'u-n', full_name: 'Nam Hết Hàng', lines: [pLine({ line_id: 'ln', stock_qty: 0 })] });
    const adm = person({ user_sub: 'u-m', full_name: 'Minh NCC Hết', lines: [pLine({ line_id: 'lm', item_id: 'i-clip', stock_qty: 0, adm_out: true })] });
    const one = person({ user_sub: 'u-o', full_name: 'Oanh Còn Một', lines: [pLine({ line_id: 'lo', item_id: 'i-a4', stock_qty: 1 })] });
    stub({ people: [none, adm, one] });
    open();
    await screen.findByText('Nam Hết Hàng', { selector: '.pt-person b' });
    expect(within(card('Nam Hết Hàng')).getByRole('button', { name: /^Tủ chưa có hàng/ })).toBeDisabled();
    expect(within(card('Minh NCC Hết')).getByRole('button', { name: /^Giao…/ })).toBeEnabled();
    expect(within(card('Oanh Còn Một')).getByRole('button', { name: /^Giao…/ })).toBeEnabled();
  });
});

describe('DeliveryPeoplePage — tiến độ trên thẻ', () => {
  it('đã giao một phần (7/10) → "Đã giao 7/10"; chưa giao gì → không có dòng tiến độ; trừ phần hủy khỏi mẫu số', async () => {
    const partial = person({ user_sub: 'u-p', full_name: 'Phan Văn Phần', status: 'debt', lines: [pLine({ line_id: 'lp', qty: 10, delivered_qty: 7, remaining_qty: 3, stock_qty: 0 })] });
    const cancelled = person({ user_sub: 'u-x', full_name: 'Xuân Hủy', status: 'debt', lines: [pLine({ line_id: 'lx', qty: 10, delivered_qty: 4, cancelled_qty: 2, remaining_qty: 4, stock_qty: 9 })] });
    stub({ people: [partial, cancelled, A] });
    open('/admin/delivery?tab=all');
    await screen.findByText('Phan Văn Phần', { selector: '.pt-person b' });
    expect(within(card('Phan Văn Phần')).getByText('Đã giao 7/10')).toBeInTheDocument();
    expect(within(card('Xuân Hủy')).getByText('Đã giao 4/8')).toBeInTheDocument();
    expect(within(card('Nguyễn Văn An')).queryByText(/^Đã giao \d/)).toBeNull();
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
    open('/admin/delivery?tab=debt');
    await screen.findByText('Trần Minh Khoa', { selector: '.pt-person b' });
    await userEvent.click(within(card('Trần Minh Khoa')).getByRole('button', { name: /^Giao…/ }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Xác nhận giao' }));
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Mở chi tiết người' }));
    await waitFor(() => expect(search()).toContain('person=u-c'));
    expect(screen.queryByRole('dialog', { name: /^Giao cho/ })).toBeNull();
  });

  it('thẻ chỉ có dòng chờ duyệt: nút vô hiệu "Chờ duyệt"', async () => {
    stub({ people: [person({ lines: [pLine({ review_status: 'pending', item_id: null })] })] });
    open();
    expect(await screen.findByRole('button', { name: /^Chờ duyệt/ })).toBeDisabled();
  });

  it('use-quick-deliver chỉ tính đề xuất: không import API ghi', () => {
    const src = readFileSync(resolve(__dirname, 'use-quick-deliver.ts'), 'utf8');
    expect(src).not.toMatch(/delivery\.api|backlog\.api|deliverLine|deliverAll|deliverSelected|cancelRemaining|apiFetch/);
  });
});

describe('DeliveryPeoplePage — tủ thiếu', () => {
  it('tủ bút 7 < A + B chờ 13 → chip "Tủ thiếu 1 món" ở dòng của A và B; không còn banner đầu trang, không có "Xem ở Tủ / Kho"', async () => {
    stub();
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    expect(within(card('Nguyễn Văn An')).getByText('Tủ thiếu 1 món')).toBeInTheDocument();
    expect(within(card('Lê Thị Bình')).getByText('Tủ thiếu 1 món')).toBeInTheDocument();
    expect(screen.queryByText(/chưa đủ tủ cho người/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Xem ở Tủ / Kho' })).toBeNull();
  });

  it('đủ tủ → không có chip', async () => {
    stub({ people: [A] });
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    expect(screen.queryByText(/Tủ thiếu/)).toBeNull();
  });
});

describe('DeliveryPeoplePage — panel và Người tiếp theo', () => {
  it('?person=u-b mở panel với nợ trước, tháng sau', async () => {
    stub();
    open('/admin/delivery?person=u-b');
    expect(await screen.findByRole('heading', { level: 2, name: 'Lê Thị Bình' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(expect.arrayContaining(['Nợ kỳ trước', 'Tháng 10']));
  });

  it('Giao ở panel A rồi "Người tiếp theo" chuyển sang người kế trong danh sách đang lọc (tab Chưa nhận: B)', async () => {
    stub();
    open('/admin/delivery?person=u-a');
    await screen.findByRole('heading', { level: 2, name: 'Nguyễn Văn An' });
    await userEvent.click(screen.getByRole('button', { name: 'Giao…' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Xác nhận giao' }));
    // Giao hết từ panel: đóng cả hộp lẫn panel
    await waitFor(() => expect(search()).not.toContain('person='));
    await userEvent.click(await screen.findByRole('button', { name: 'Người tiếp theo' }));
    expect(search()).toContain('person=u-b');
  });

  it('?person= không có trong danh sách → không panel, không lỗi, tham số bị gỡ', async () => {
    stub();
    open('/admin/delivery?person=u-nobody&tab=all');
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    await waitFor(() => expect(search()).toBe('?tab=all'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([390, 1280])('%i px: không còn cột bên; "Xem" mở panel phủ có tên người, bộ đếm, ↓ sang người kế; đóng bỏ ?person=', async (width) => {
    stub();
    open('/admin/delivery', width);
    await userEvent.click(await screen.findByRole('button', { name: 'Xem Nguyễn Văn An' }));
    const dlg = await screen.findByRole('dialog', { name: 'Nguyễn Văn An' });
    expect(within(dlg).getByRole('button', { name: 'Giao…' })).toBeInTheDocument();
    expect(within(dlg).getByText('1/2')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Nguyễn Văn An', hidden: true })).toBeNull();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Người sau' }));
    expect(await screen.findByRole('dialog', { name: 'Lê Thị Bình' })).toBeInTheDocument();
    const close = width === 390 ? '← Đóng' : 'Đóng';
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Lê Thị Bình' })).getByRole('button', { name: close }));
    await waitFor(() => expect(search()).not.toContain('person='));
  });

  it('"Giao…" trong panel mở hộp giao trên panel; giao có lỗi → hộp và panel đều ở lại', async () => {
    stub({ deliver: () => jsonResponse(409, { code: 'INSUFFICIENT_STOCK', available: 0 }) });
    open('/admin/delivery?person=u-a');
    const dlg = await screen.findByRole('dialog', { name: 'Nguyễn Văn An' });
    await userEvent.click(within(dlg).getByRole('button', { name: 'Giao…' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Giao cho Nguyễn Văn An?' })).getByRole('button', { name: 'Xác nhận giao' }));
    expect(await screen.findByRole('button', { name: 'Mở chi tiết người' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Nguyễn Văn An', hidden: true })).toBeInTheDocument();
    expect(search()).toContain('person=u-a');
  });
});

describe('DeliveryPeoplePage — kỳ chưa khóa và lỗi', () => {
  it('409 PERIOD_NOT_LOCKED → "Kỳ tháng 10 chưa khóa sổ — xem được từ 00:00 ngày 11/10.", không thẻ, không nút Giao', async () => {
    stub({ locked: false });
    open();
    expect(await screen.findByText('Kỳ tháng 10 chưa khóa sổ — xem được từ 00:00 ngày 11/10.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Giao/ })).toBeNull();
  });

  it('lỗi 500 khác → LoadError có nút Thử lại, không nhầm thành "chưa khóa sổ"', async () => {
    stubShellApi({ [PEOPLE_URL]: () => jsonResponse(500, null) });
    open();
    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(screen.queryByText(/chưa khóa sổ/)).toBeNull();
  });

  it('kỳ khóa nhưng không ai cần giao → câu rỗng cho cả kỳ', async () => {
    stub({ people: [] });
    open();
    expect(await screen.findByText('Tháng 10 chưa có ai cần nhận hàng.')).toBeInTheDocument();
  });
});

describe('fixtures khớp', () => {
  it('đủ 4 người', () => {
    expect([A, B, C, D]).toHaveLength(4);
  });
});
