import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView, memberItem } from '@/test/fixtures-request';
import { mockViewport } from '@/test/viewport';
import type { CurrentPeriod, RequestView } from '@/features/request/request.api';

const PERIOD: CurrentPeriod = {
  ym: '2026-11',
  deadline: '2026-11-10T17:00:00.000Z',
  is_open: true,
  days_left: 4,
  previous: null,
};
const PEN = memberItem({ id: 'i-pen', name: 'Bút bi xanh', unit: 'cay', max_qty: 20, category_id: 'c-1' });
const NOTE = memberItem({ id: 'i-note', name: 'Giấy note vàng', unit: 'loc', max_qty: 10, category_id: 'c-2' });
const CLIP = memberItem({ id: 'i-clip', name: 'Kẹp giấy', unit: 'hop', max_qty: 10 });
const A4 = memberItem({ id: 'i-a4', name: 'Giấy A4', unit: 'ram', max_qty: 5, admin_only: true });
const CATEGORIES = [
  { id: 'c-1', name: 'Bút & viết', name_en: null, sort_order: 0, active: true },
  { id: 'c-2', name: 'Giấy & sổ', name_en: null, sort_order: 1, active: true },
];
const facts = (i: typeof PEN) => ({ ...i });

function view(over: Partial<RequestView> = {}): RequestView {
  return {
    id: 'r-1',
    period_ym: '2026-11',
    user_sub: 'u-member',
    full_name: 'Nguyễn Văn An',
    department: 'Phòng Công trình',
    updated_at: '2026-11-03T07:20:00.000Z',
    is_open: true,
    lines: [],
    ...over,
  };
}

type Handler = (init?: RequestInit) => Response;

function stubApi(request: RequestView | null, put?: Handler) {
  let current = request;
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
    if (url === '/api/me/request?ym=2026-11') {
      return Promise.resolve(current ? jsonResponse(200, current) : jsonResponse(404, { code: 'REQUEST_NOT_FOUND' }));
    }
    if (url.startsWith('/api/items')) return Promise.resolve(jsonResponse(200, [PEN, NOTE, CLIP, A4]));
    if (url === '/api/item-categories') return Promise.resolve(jsonResponse(200, CATEGORIES));
    if (url === '/api/me/request/lines' && method === 'PUT' && put) return Promise.resolve(put(init));
    return Promise.resolve(jsonResponse(500, {}));
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    fetchMock,
    setServer: (v: RequestView | null) => {
      current = v;
    },
    putBody: () => {
      const call = fetchMock.mock.calls.find(([u, i]) => u === '/api/me/request/lines' && i?.method === 'PUT');
      return JSON.parse(String(call?.[1]?.body));
    },
  };
}

const grid = () => screen.getByRole('region', { name: 'Danh mục món' });
// Radix ẩn nền khi hộp thoại mở (mất tên truy cập) → tìm giỏ phía sau qua tiêu đề
const cart = (hidden = false) =>
  hidden
    ? screen.getByRole('heading', { name: 'Phiếu của tôi', hidden: true }).closest('aside')!
    : screen.getByRole('complementary', { name: 'Phiếu của tôi' });
const cartLine = (name: string, hidden = false) => within(cart(hidden)).getByText(name).closest('li')!;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RequestPage', () => {
  it('chưa có phiếu: hero "Phiếu tháng 11", 4 ngày còn lại, "Chưa lưu phiếu tháng này"; món chỉ Hành chính không hiện', async () => {
    mockViewport(1280);
    stubApi(null);
    renderApp(makeMe('member'), '/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Phiếu tháng 11' })).toBeInTheDocument();
    expect(screen.getByText('Chưa lưu phiếu tháng này')).toBeInTheDocument();
    expect(screen.getByText('ngày còn lại')).toBeInTheDocument();
    expect(await within(grid()).findByText('Bút bi xanh')).toBeInTheDocument();
    expect(within(grid()).getByText('cây · tối đa 20/tháng')).toBeInTheDocument();
    expect(within(grid()).queryByText('Giấy A4')).toBeNull();
    expect(within(grid()).getByRole('button', { name: /Không thấy món cần\?/ })).toBeInTheDocument();
  });

  it('390 px: chọn 3 món → thanh "3 thay đổi chưa lưu · Lưu" → hộp xác nhận → PUT đúng body → toast + "Đã lưu 14:20"', async () => {
    mockViewport(390);
    const api = stubApi(null, () =>
      jsonResponse(200, {
        request: view({
          lines: [
            lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 }),
            lineView({ id: 'l-2', item_id: NOTE.id, item: facts(NOTE), qty: 1 }),
            lineView({ id: 'l-3', item_id: CLIP.id, item: facts(CLIP), qty: 1 }),
          ],
        }),
      }),
    );
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Giấy note vàng' }));
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Kẹp giấy' }));

    expect(within(cart()).getByText('3 loại món · 4 đơn vị')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '3 thay đổi chưa lưu · Lưu' }));
    const dialog = await screen.findByRole('dialog', { name: 'Lưu phiếu tháng 11?' });
    expect(within(dialog).getByText('2 cây')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu phiếu' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.putBody()).toEqual({
      ym: '2026-11',
      lines: [
        { item_id: PEN.id, qty: 2 },
        { item_id: NOTE.id, qty: 1 },
        { item_id: CLIP.id, qty: 1 },
      ],
    });
    expect(screen.getByText('Đã lưu phiếu tháng 11').closest('[role="status"]')).not.toBeNull();
    expect(screen.getByText(/Đã lưu 14:20 · sửa tiếp đến hết 10\/11/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu phiếu' })).toBeDisabled();
  });

  it('server 409 STALE_UPDATE → hộp "Phiếu vừa được cập nhật ở nơi khác"; giỏ giữ nguyên; "Tải lại" lấy bản mới', async () => {
    mockViewport(1280);
    const saved = view({ lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 })] });
    const api = stubApi(saved, () => jsonResponse(409, { code: 'STALE_UPDATE', message: 'x' }));
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('complementary', { name: 'Phiếu của tôi' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));

    const stale = await screen.findByRole('dialog', { name: 'Phiếu vừa được cập nhật ở nơi khác' });
    expect(within(cartLine('Bút bi xanh', true)).getByRole('spinbutton', { hidden: true })).toHaveValue(3);
    api.setServer(view({ updated_at: '2026-11-03T08:00:00.000Z', lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 7 })] }));
    await userEvent.click(within(stale).getByRole('button', { name: 'Tải lại' }));
    await waitFor(() => expect(within(cartLine('Bút bi xanh')).getByRole('spinbutton')).toHaveValue(7));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('400 ITEM_INACTIVE {line_id} → đúng dòng đó báo lỗi, dòng khác giữ nguyên không lỗi', async () => {
    mockViewport(1280);
    const saved = view({
      lines: [
        lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 }),
        lineView({ id: 'l-2', item_id: NOTE.id, item: facts(NOTE), qty: 1 }),
      ],
    });
    stubApi(saved, () => jsonResponse(400, { code: 'ITEM_INACTIVE', message: 'x', line_id: 'l-2' }));
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('complementary', { name: 'Phiếu của tôi' })).findByText('Giấy note vàng');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Giấy note vàng' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));

    expect(await within(cartLine('Giấy note vàng')).findByText('Món này đã ngừng — bỏ khỏi phiếu rồi lưu lại.')).toBeInTheDocument();
    expect(within(cartLine('Bút bi xanh')).queryByText(/ngừng/)).toBeNull();
    expect(within(cartLine('Bút bi xanh')).getByRole('spinbutton')).toHaveValue(2);
    expect(within(cartLine('Giấy note vàng')).getByRole('spinbutton')).toHaveValue(2);
  });

  it('dòng Hành chính thêm: nhãn "Hành chính thêm", không có nút −/+/×', async () => {
    mockViewport(1280);
    stubApi(
      view({
        lines: [
          lineView({ id: 'l-a', item_id: A4.id, item: facts(A4), qty: 2, added_by_admin: true, readonly_for_member: true }),
        ],
      }),
    );
    renderApp(makeMe('member'), '/');
    const line = (await within(await screen.findByRole('complementary', { name: 'Phiếu của tôi' })).findByText('Giấy A4')).closest('li')!;
    expect(within(line).getByText('Hành chính thêm')).toHaveAttribute('title', 'Dòng này do Hành chính thêm, liên hệ nếu cần sửa');
    expect(within(line).queryAllByRole('button')).toEqual([]);
    expect(within(line).getByText('2 ram')).toBeInTheDocument();
  });

  it('390 px: lỗi theo dòng → thông báo role=alert thấy ngay, focus stepper của dòng lỗi (aria-describedby = câu lỗi)', async () => {
    mockViewport(390);
    const saved = view({
      lines: [
        lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 }),
        lineView({ id: 'l-2', item_id: NOTE.id, item: facts(NOTE), qty: 1 }),
      ],
    });
    stubApi(saved, () => jsonResponse(400, { code: 'ITEM_INACTIVE', message: 'x', line_id: 'l-2' }));
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('complementary', { name: 'Phiếu của tôi' })).findByText('Giấy note vàng');
    await userEvent.click(within(cart()).getByRole('button', { name: 'Thêm Giấy note vàng' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));

    const msg = 'Món này đã ngừng — bỏ khỏi phiếu rồi lưu lại.';
    expect(await screen.findByRole('alert')).toHaveTextContent(`Chưa lưu được — Giấy note vàng: ${msg}`);
    const stepper = within(cart()).getByRole('spinbutton', { name: 'Giấy note vàng' });
    await waitFor(() => expect(stepper).toHaveFocus());
    expect(stepper).toHaveAccessibleDescription(msg);
    expect(stepper).toHaveAttribute('aria-invalid', 'true');

    await userEvent.click(within(cart()).getByRole('button', { name: 'Bớt Giấy note vàng' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('390 px: lỗi mạng/không rõ → thông báo role=alert "Chưa lưu được — kiểm tra mạng rồi thử lại."', async () => {
    mockViewport(390);
    stubApi(null, () => jsonResponse(500, {}));
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));
    // Giỏ nằm dưới lưới ở 390 → thông báo phải ở ngoài giỏ (cạnh thanh lưu), chỉ một alert
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Chưa lưu được — kiểm tra mạng rồi thử lại.');
    expect(cart()).not.toContainElement(alert);
    await waitFor(() => expect(alert).toHaveFocus());
  });
});
