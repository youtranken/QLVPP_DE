import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';
import type { DeliveryPerson } from './delivery-people.api';
import { PEOPLE } from './people-fixtures';

const PEOPLE_URL = '/api/admin/periods/2026-10/delivery-people';
const BULK_URL = '/api/admin/deliveries/bulk';

interface Stub {
  people?: DeliveryPerson[];
  bulk?: (body: unknown) => Response;
}

function stub(s: Stub = {}) {
  return stubShellApi({
    '/api/admin/periods/2026-10/summary': () => jsonResponse(200, { lines_pending_delivery: 4, deadline: '2026-10-10T17:00:00.000Z' }),
    [PEOPLE_URL]: () => jsonResponse(200, { ym: '2026-10', people: s.people ?? PEOPLE }),
    [BULK_URL]: (init) => (s.bulk ?? (() => jsonResponse(200, { results: [] })))(JSON.parse(String(init?.body))),
  });
}

const bodiesOf = (f: ReturnType<typeof stub>, url: string) => f.mock.calls.filter(([u]) => u === url).map(([, i]) => JSON.parse(String((i as RequestInit).body)));
const callsTo = (f: ReturnType<typeof stub>, url: string) => f.mock.calls.filter(([u]) => u === url);
const card = (name: string) => screen.getByText(name, { selector: '.pt-person b' }).closest('tr') as HTMLElement;

function open(path = '/admin/delivery', width = 1280) {
  mockViewport(width);
  renderApp(makeMe('admin'), path);
}

afterEach(() => vi.unstubAllGlobals());

const pick = (name: string) => userEvent.click(screen.getByRole('checkbox', { name: `Chọn ${name}` }));
const ok = (body: unknown) => ({ results: (body as { requests: { request_id: string }[] }).requests.map((r) => ({ request_id: r.request_id, ok: true, delivered_units: 1, request_complete: false })) });

describe('DeliveryPeoplePage — bảng và giao nhiều phiếu', () => {
  it('bảng kẻ ô: ☐ · Người · Phòng · Kỳ · Số món · Đơn vị · Tình trạng · Thao tác; mỗi dòng có Xem và Giao…; tab Chưa nhận 2 · Còn nợ 2 · Đã nhận 1 · Tất cả 4', async () => {
    stub();
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['', 'Người', 'Phòng', 'Kỳ', 'Số món', 'Đơn vị', 'Tình trạng', 'Thao tác']);
    expect(screen.getByRole('table')).toHaveClass('grid-table');
    expect(within(card('Nguyễn Văn An')).getByText('Kỳ 10')).toBeInTheDocument();
    expect(within(card('Lê Thị Bình')).getByText('Kỳ 9')).toBeInTheDocument();
    for (const n of ['Xem Nguyễn Văn An', 'Giao…, Nguyễn Văn An']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
  });

  it('chọn 2 dòng → nút "Giao 2 phiếu" + "Bỏ chọn"; không có chữ "Đã chọn … đơn vị"; Bỏ chọn xóa', async () => {
    stub();
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    expect(screen.queryByRole('button', { name: /^Giao \d+ phiếu/ })).toBeNull();
    await pick('Nguyễn Văn An');
    await pick('Lê Thị Bình');
    expect(screen.getByRole('button', { name: 'Giao 2 phiếu' })).toBeEnabled();
    expect(screen.queryByText(/Đã chọn|đơn vị ·/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    expect(screen.queryByRole('button', { name: /^Giao \d+ phiếu/ })).toBeNull();
  });

  it('ô ở tiêu đề chọn/bỏ mọi dòng đang lọc; dòng không có gì giao được thì ô chọn vô hiệu', async () => {
    stub();
    open('/admin/delivery?tab=all');
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    expect(screen.getByRole('checkbox', { name: 'Chọn Đỗ Mai Linh' })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả' }));
    expect(screen.getByRole('button', { name: 'Giao 3 phiếu' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Chọn Trần Minh Khoa' })).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả' }));
    expect(screen.queryByRole('button', { name: /^Giao \d+ phiếu/ })).toBeNull();
  });

  it('chọn rồi lọc ra khỏi danh sách → người đó rơi khỏi tập chọn', async () => {
    stub();
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    await pick('Nguyễn Văn An');
    await pick('Lê Thị Bình');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm tên hoặc phòng ban' }), 'binh');
    expect(screen.getByRole('button', { name: 'Giao 1 phiếu' })).toBeInTheDocument();
  });

  it('Giao 2 phiếu → hộp liệt kê từng người + số món, phần thiếu "chờ hàng về"; Xác nhận → đúng một POST deliveries/bulk, bấm đúp vẫn một lần', async () => {
    const f = stub({ bulk: (b) => jsonResponse(200, ok(b)) });
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    await pick('Nguyễn Văn An');
    await pick('Lê Thị Bình');
    await userEvent.click(screen.getByRole('button', { name: 'Giao 2 phiếu' }));
    const dlg = await screen.findByRole('dialog', { name: 'Giao 2 phiếu?' });
    expect(within(dlg).getByText('Nguyễn Văn An')).toBeInTheDocument();
    expect(within(dlg).getByText('Lê Thị Bình')).toBeInTheDocument();
    expect(within(dlg).getByText('2 món · 6 đơn vị')).toBeInTheDocument();
    expect(within(dlg).getByText('Phần thiếu 6 chờ hàng về')).toBeInTheDocument();
    expect(bodiesOf(f, BULK_URL)).toHaveLength(0);
    await userEvent.dblClick(within(dlg).getByRole('button', { name: 'Xác nhận giao' }));
    await waitFor(() => expect(bodiesOf(f, BULK_URL)).toHaveLength(1));
    expect(bodiesOf(f, BULK_URL)[0]).toEqual({
      requests: [
        { request_id: 'r-a', lines: [{ line_id: 'la', qty: 3, expected_delivered_qty: 0 }] },
        {
          request_id: 'r-b0',
          lines: [{ line_id: 'lb-debt', qty: 2, expected_delivered_qty: 0 }],
        },
        { request_id: 'r-b', lines: [{ line_id: 'lb', qty: 4, expected_delivered_qty: 0 }] },
      ],
    });
  });

  it('mọi phiếu ok → đóng hộp, toast "Đã giao 2 phiếu", bỏ chọn', async () => {
    stub({ bulk: (b) => jsonResponse(200, ok(b)) });
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    await pick('Nguyễn Văn An');
    await pick('Lê Thị Bình');
    await userEvent.click(screen.getByRole('button', { name: 'Giao 2 phiếu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Xác nhận giao' }));
    expect(await screen.findByText('Đã giao 2 phiếu')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('button', { name: /^Giao \d+ phiếu/ })).toBeNull();
  });

  it('một phiếu STALE_UPDATE → hộp chuyển sang kết quả: ✓ An, ✗ Bình "Phiếu vừa đổi — tải lại"; Đóng bỏ chọn', async () => {
    const f = stub({
      bulk: () =>
        jsonResponse(200, {
          results: [
            { request_id: 'r-a', ok: true, delivered_units: 3, request_complete: true },
            { request_id: 'r-b0', ok: false, code: 'STALE_UPDATE', line_id: 'lb-debt' },
            { request_id: 'r-b', ok: false, code: 'STALE_UPDATE', line_id: 'lb' },
          ],
        }),
    });
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    await pick('Nguyễn Văn An');
    await pick('Lê Thị Bình');
    await userEvent.click(screen.getByRole('button', { name: 'Giao 2 phiếu' }));
    const dlg = await screen.findByRole('dialog');
    const before = callsTo(f, PEOPLE_URL).length;
    await userEvent.click(within(dlg).getByRole('button', { name: 'Xác nhận giao' }));
    const status = await within(dlg).findByRole('status');
    expect(status).toHaveTextContent('Nguyễn Văn An');
    expect(status).toHaveTextContent('Đã giao 3');
    // Hai phiếu của Bình gộp một dòng, cùng lý do chỉ nói một lần
    expect(within(status).getAllByRole('listitem')).toHaveLength(2);
    expect(within(status).getAllByText('Phiếu vừa đổi — tải lại')).toHaveLength(1);
    expect(within(dlg).queryByRole('button', { name: 'Xác nhận giao' })).toBeNull();
    await waitFor(() => expect(callsTo(f, PEOPLE_URL).length).toBeGreaterThan(before));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('button', { name: /^Giao \d+ phiếu/ })).toBeNull();
  });

  it('lỗi mạng/máy chủ khi gửi → tải lại danh sách, báo gián đoạn, phiếu chưa gửi ghi "Chưa gửi"; chỉ còn nút Đóng', async () => {
    const f = stub({
      bulk: () => {
        throw new TypeError('network');
      },
    });
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    await pick('Nguyễn Văn An');
    await userEvent.click(screen.getByRole('button', { name: 'Giao 1 phiếu' }));
    const dlg = await screen.findByRole('dialog');
    const before = callsTo(f, PEOPLE_URL).length;
    await userEvent.click(within(dlg).getByRole('button', { name: 'Xác nhận giao' }));
    expect(await within(dlg).findByRole('alert')).toHaveTextContent('Gửi bị gián đoạn');
    expect(within(dlg).getByText('Chưa gửi')).toBeInTheDocument();
    await waitFor(() => expect(callsTo(f, PEOPLE_URL).length).toBeGreaterThan(before));
    expect(within(dlg).queryByRole('button', { name: 'Xác nhận giao' })).toBeNull();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('CSRF hết hạn (403 CSRF_TOKEN_INVALID) → "Phiên đăng nhập đã hết", hộp ở lại, chưa gửi gì', async () => {
    stubShellApi({
      '/api/admin/periods/2026-10/summary': () => jsonResponse(200, { lines_pending_delivery: 4, deadline: '2026-10-10T17:00:00.000Z' }),
      [PEOPLE_URL]: () => jsonResponse(200, { ym: '2026-10', people: PEOPLE }),
      [BULK_URL]: () => jsonResponse(403, { code: 'CSRF_TOKEN_INVALID' }),
    });
    open();
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    await pick('Nguyễn Văn An');
    await userEvent.click(screen.getByRole('button', { name: 'Giao 1 phiếu' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Xác nhận giao' }));
    expect(await within(dlg).findByRole('alert')).toHaveTextContent('Phiên đăng nhập đã hết');
    expect(within(dlg).getByRole('button', { name: 'Xác nhận giao' })).toBeEnabled();
  });

  it('nhiều hơn 100 phiếu → chia lô ≤ 100, gửi lần lượt, toast chung', async () => {
    const many = Array.from({ length: 101 }, (_, i) =>
      ({
        ...PEOPLE[0]!,
        user_sub: `u-m${i}`,
        full_name: `Người ${i}`,
        lines: PEOPLE[0]!.lines.map((l) => ({ ...l, line_id: `l-m${i}-${l.line_id}`, request_id: `r-m${i}`, stock_qty: 999 })),
      }),
    );
    const f = stub({ people: many, bulk: (b) => jsonResponse(200, ok(b)) });
    open();
    await screen.findByText('Người 0', { selector: '.pt-person b' });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả' }));
    await userEvent.click(screen.getByRole('button', { name: 'Giao 101 phiếu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Xác nhận giao' }));
    await waitFor(() => expect(callsTo(f, BULK_URL)).toHaveLength(2), { timeout: 10_000 });
    expect(bodiesOf(f, BULK_URL).map((b) => b.requests.length)).toEqual([100, 1]);
    expect(await screen.findByText('Đã giao 101 phiếu')).toBeInTheDocument();
  }, 30_000);

  it('390 px: có ô "Chọn tất cả người giao được" trên thanh công cụ, bấm là chọn mọi người giao được', async () => {
    stub();
    open('/admin/delivery', 390);
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả người giao được' }));
    expect(screen.getByRole('checkbox', { name: 'Chọn Nguyễn Văn An' })).toBeChecked();
    expect(screen.getByRole('button', { name: /^Giao \d+ phiếu$/ })).toBeInTheDocument();
  });

  it.each([390])('%i px: thanh "Giao n phiếu" có mặt khi đã chọn', async (width) => {
    stub();
    open('/admin/delivery', width);
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    await pick('Nguyễn Văn An');
    expect(screen.getByRole('button', { name: 'Giao 1 phiếu' }).closest('.pt-bulk')).not.toBeNull();
  });
});
