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
  deliverAll?: () => Response;
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
    '/api/admin/requests/r-a/deliver-all': () => s.deliverAll?.() ?? jsonResponse(200, { delivered: [{ line_id: 'la', qty: 3 }], failed: [] }),
    '/api/admin/lines/lc/deliver': () => s.deliver?.('lc') ?? jsonResponse(200, { request_complete: true }),
  });
}

const callsTo = (f: ReturnType<typeof stub>, url: string) => f.mock.calls.filter(([u]) => u === url);
const search = () => screen.getByTestId('location-search').textContent ?? '';
const card = (name: string) => screen.getByRole('heading', { level: 3, name }).closest('article') as HTMLElement;

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
    await screen.findByRole('heading', { level: 3, name: 'Nguyễn Văn An' });
    expect(callsTo(f, PEOPLE_URL)).toHaveLength(1);
  });

  it('số trên tab đúng: Chưa nhận 2, Còn nợ 1, Đã nhận 1, Tất cả 4; mặc định tab Chưa nhận chỉ có A và B', async () => {
    stub();
    open();
    await screen.findByRole('heading', { level: 3, name: 'Nguyễn Văn An' });
    for (const name of ['Chưa nhận, 2', 'Còn nợ, 1', 'Đã nhận, 1', 'Tất cả, 4']) expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Chưa nhận, 2' })).toBeChecked();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Nguyễn Văn An', 'Lê Thị Bình']);
  });

  it('người chỉ có nợ (không phiếu kỳ này) có ở tab Còn nợ với dòng cam "Nợ tháng 9: 1 món"; đổi tab ghi ?tab=debt', async () => {
    stub();
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Còn nợ, 1' }));
    expect(search()).toContain('tab=debt');
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Trần Minh Khoa']);
    expect(within(card('Trần Minh Khoa')).getByText('Nợ tháng 9: 1 món')).toBeInTheDocument();
  });

  it('?tab=done mở thẳng tab Đã nhận; nút thẻ đã nhận là "Đã giao" và vô hiệu', async () => {
    stub();
    open('/admin/delivery?tab=done');
    expect(await screen.findByRole('heading', { level: 3, name: 'Đỗ Mai Linh' })).toBeInTheDocument();
    expect(within(card('Đỗ Mai Linh')).getByRole('button', { name: /^Đã giao/ })).toBeDisabled();
  });

  it('từ khóa bỏ dấu "binh" tìm trên mọi tab và ghi ?q=; xóa từ khóa trả về tab', async () => {
    stub();
    open('/admin/delivery?tab=done');
    await screen.findByRole('heading', { level: 3, name: 'Đỗ Mai Linh' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm tên hoặc phòng ban' }), 'binh');
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Lê Thị Bình']);
    expect(search()).toContain('q=binh');
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Tìm tên hoặc phòng ban' }));
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Đỗ Mai Linh']);
  });

  it('không ai khớp → câu rỗng, không vỡ', async () => {
    stub();
    open('/admin/delivery?q=zzz');
    expect(await screen.findByText('Không có ai trong mục này.')).toBeInTheDocument();
  });
});

describe('DeliveryPeoplePage — tiến độ trên thẻ', () => {
  it('đã giao một phần (7/10) → "Đã giao 7/10"; chưa giao gì → không có dòng tiến độ; trừ phần hủy khỏi mẫu số', async () => {
    const partial = person({ user_sub: 'u-p', full_name: 'Phan Văn Phần', lines: [pLine({ line_id: 'lp', qty: 10, delivered_qty: 7, remaining_qty: 3, stock_qty: 0 })] });
    const cancelled = person({ user_sub: 'u-x', full_name: 'Xuân Hủy', lines: [pLine({ line_id: 'lx', qty: 10, delivered_qty: 4, cancelled_qty: 2, remaining_qty: 4, stock_qty: 9 })] });
    stub({ people: [partial, cancelled, A] });
    open();
    await screen.findByRole('heading', { level: 3, name: 'Phan Văn Phần' });
    expect(within(card('Phan Văn Phần')).getByText('Đã giao 7/10')).toBeInTheDocument();
    expect(within(card('Xuân Hủy')).getByText('Đã giao 4/8')).toBeInTheDocument();
    expect(within(card('Nguyễn Văn An')).queryByText(/^Đã giao \d/)).toBeNull();
  });
});

describe('DeliveryPeoplePage — nút nhanh trên thẻ', () => {
  it('thẻ đủ hàng: "Giao đủ" gọi deliverAll đúng 1 lần cho phiếu của A, không gọi deliver từng dòng', async () => {
    const f = stub();
    open();
    await screen.findByRole('heading', { level: 3, name: 'Nguyễn Văn An' });
    await userEvent.click(within(card('Nguyễn Văn An')).getByRole('button', { name: /^Giao đủ/ }));
    await waitFor(() => expect(callsTo(f, '/api/admin/requests/r-a/deliver-all')).toHaveLength(1));
    expect(f.mock.calls.some(([u]) => String(u).endsWith('/deliver'))).toBe(false);
    expect(await screen.findByText('Đã giao cho Nguyễn Văn An')).toBeInTheDocument();
  });

  it('thẻ thiếu hàng: nút là "Giao 9/12", bấm mở panel (?person=u-b) và không giao gì', async () => {
    const f = stub();
    open();
    await screen.findByRole('heading', { level: 3, name: 'Lê Thị Bình' });
    await userEvent.click(within(card('Lê Thị Bình')).getByRole('button', { name: /^Giao 9\/12/ }));
    expect(search()).toContain('person=u-b');
    expect(await screen.findByText('Giao 7, còn nợ 3')).toBeInTheDocument();
    expect(f.mock.calls.some(([u]) => /\/deliver(-all)?$/.test(String(u)))).toBe(false);
  });

  it('biên: tủ vừa đúng cần → "Giao đủ"; tủ thiếu 1 → "Giao x/y"', async () => {
    stub({ people: [person({ lines: [pLine({ remaining_qty: 3, stock_qty: 3 })] }), person({ user_sub: 'u-z', full_name: 'Zed', request_id: 'r-z', lines: [pLine({ line_id: 'lz', remaining_qty: 3, stock_qty: 2 })] })] });
    open();
    await screen.findByRole('heading', { level: 3, name: 'Zed' });
    expect(within(card('Nguyễn Văn An')).getByRole('button', { name: /^Giao đủ/ })).toBeInTheDocument();
    expect(within(card('Zed')).getByRole('button', { name: /^Giao 2\/3/ })).toBeInTheDocument();
  });

  it('người chỉ có nợ, đủ hàng: Giao đủ gọi deliver cho dòng nợ với remaining, không gọi deliver-all', async () => {
    const f = stub();
    open('/admin/delivery?tab=debt');
    await screen.findByRole('heading', { level: 3, name: 'Trần Minh Khoa' });
    await userEvent.click(within(card('Trần Minh Khoa')).getByRole('button', { name: /^Giao đủ/ }));
    await waitFor(() => expect(callsTo(f, '/api/admin/lines/lc/deliver')).toHaveLength(1));
    expect(JSON.parse(String(callsTo(f, '/api/admin/lines/lc/deliver')[0][1]?.body))).toEqual({ qty: 1, expected_delivered_qty: 0 });
    expect(f.mock.calls.some(([u]) => String(u).includes('deliver-all'))).toBe(false);
  });

  it('deliverAll báo dòng lỗi → toast "Chưa giao hết…" và mở panel người đó', async () => {
    stub({ deliverAll: () => jsonResponse(200, { delivered: [], failed: [{ line_id: 'la', code: 'STOCK_INSUFFICIENT', available: 1 }] }) });
    open();
    await screen.findByRole('heading', { level: 3, name: 'Nguyễn Văn An' });
    await userEvent.click(within(card('Nguyễn Văn An')).getByRole('button', { name: /^Giao đủ/ }));
    expect(await screen.findByText('Chưa giao hết cho Nguyễn Văn An — xem lại từng dòng.')).toBeInTheDocument();
    await waitFor(() => expect(search()).toContain('person=u-a'));
  });

  it('thẻ chỉ có dòng chờ duyệt: nút vô hiệu "Chờ duyệt"', async () => {
    stub({ people: [person({ lines: [pLine({ review_status: 'pending', item_id: null })] })] });
    open();
    expect(await screen.findByRole('button', { name: /^Chờ duyệt/ })).toBeDisabled();
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
    await userEvent.click(screen.getByRole('button', { name: 'Giao' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Người tiếp theo' }));
    expect(search()).toContain('person=u-b');
  });

  it('?person= không có trong danh sách → không panel, không lỗi', async () => {
    stub();
    open('/admin/delivery?person=u-nobody');
    await screen.findByRole('heading', { level: 3, name: 'Nguyễn Văn An' });
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(screen.getByText('Chọn một người bên trái để giao hàng.')).toBeInTheDocument();
  });

  it('390 px: "Xem" mở ngăn kéo (hộp thoại) có tên người; đóng bỏ ?person=', async () => {
    stub();
    open('/admin/delivery', 390);
    await userEvent.click(await screen.findByRole('button', { name: 'Xem Lê Thị Bình' }));
    const dlg = await screen.findByRole('dialog', { name: 'Lê Thị Bình' });
    expect(within(dlg).getByRole('button', { name: 'Giao' })).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(search()).not.toContain('person='));
  });
});

describe('DeliveryPeoplePage — kỳ chưa khóa và lỗi', () => {
  it('409 PERIOD_NOT_LOCKED → "Kỳ tháng 10 chưa khóa sổ. Giao được từ 11/10.", không thẻ, không nút Giao', async () => {
    stub({ locked: false });
    open();
    expect(await screen.findByText('Kỳ tháng 10 chưa khóa sổ. Giao được từ 11/10.')).toBeInTheDocument();
    expect(screen.queryByRole('article')).toBeNull();
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
