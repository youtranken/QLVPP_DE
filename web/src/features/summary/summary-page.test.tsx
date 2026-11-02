import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { PEOPLE, SUMMARY_ITEMS, calledUrls, stubSummaryApi } from './summary-fixtures';
import { adminItem, adminRequest } from './adjust-fixtures';

const search = () => screen.getByTestId('location-search').textContent ?? '';
const open = (path = '/admin/summary') => {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
};

afterEach(() => vi.unstubAllGlobals());

describe('SummaryPage — đầu trang, tháng, URL', () => {
  it('đúng một h1 "Tổng hợp kỳ", breadcrumb "Hằng tháng", mô tả; badge "Đang mở · hạn 10"; › khóa ở kỳ đang mở', async () => {
    stubSummaryApi();
    open();
    expect(await screen.findByText('Đang mở · hạn 10')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tổng hợp kỳ');
    expect(within(screen.getByRole('navigation', { name: 'Vị trí' })).getByText('Hằng tháng')).toBeInTheDocument();
    expect(screen.getByText('Ai đã đăng ký, món nào cần mua, phiếu nào cần sửa — trong một bảng.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
    expect(screen.getByText('Tháng 11/2026')).toBeInTheDocument();
  });

  it('?ym=2099-01 vượt trần → URL thay bằng ?ym=2026-11, không request nào mang 2099-01', async () => {
    const f = stubSummaryApi();
    open('/admin/summary?ym=2099-01');
    await waitFor(() => expect(search()).toContain('ym=2026-11'));
    expect(await screen.findByRole('button', { name: /Phiếu đã đăng ký/ })).toHaveTextContent('32/40');
    expect(calledUrls(f).some((u) => u.includes('2099-01'))).toBe(false);
  });

  it.each(['2026-00', '2025-13', '2026-1'])('?ym=%s sai mẫu → về kỳ đang mở, không gọi API kỳ sai', async (bad) => {
    const f = stubSummaryApi();
    open(`/admin/summary?ym=${bad}`);
    expect(await screen.findByText('Tháng 11/2026')).toBeInTheDocument();
    await waitFor(() => expect(search()).toContain('ym=2026-11'));
    expect(calledUrls(f).some((u) => u.includes(`/periods/${bad}/`))).toBe(false);
  });

  it('kỳ đã khóa: badge "Đã khóa", nhãn "Phiếu đã đăng ký · lúc khóa"; › sang kỳ đang mở rồi bị khóa', async () => {
    stubSummaryApi();
    open('/admin/summary?ym=2026-10');
    const kpi = await screen.findByRole('button', { name: /Phiếu đã đăng ký/ });
    expect(kpi).toHaveTextContent('30/38');
    expect(kpi).toHaveTextContent('Phiếu đã đăng ký · lúc khóa');
    expect(screen.getByText('Đã khóa')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tháng sau' }));
    expect(await screen.findByText('Tháng 11/2026')).toBeInTheDocument();
    expect(search()).toContain('ym=2026-11');
    expect(screen.getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
  });
});

describe('SummaryPage — thẻ lọc', () => {
  it('kỳ khóa: bấm "Dòng chờ giao" → filter=pending_delivery, aria-pressed, "Đang lọc: Còn dòng chờ giao · 3 người"; bấm lại → bỏ', async () => {
    const f = stubSummaryApi();
    open('/admin/summary?ym=2026-10');
    const card = await screen.findByRole('button', { name: /Dòng chờ giao/ });
    expect(card).toHaveTextContent('12');
    expect(card).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(card);
    expect(search()).toContain('filter=pending_delivery');
    expect(card).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(calledUrls(f).some((u) => u.includes('filter=pending_delivery'))).toBe(true));
    expect(await screen.findByText('Đang lọc: Còn dòng chờ giao · 3 người')).toBeInTheDocument();
    await userEvent.click(card);
    expect(search()).not.toContain('filter=');
    expect(card).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText(/Đang lọc:/)).toBeNull();
  });

  it('kỳ mở: "Dòng chờ giao" không có role button, số "—", dòng phụ "giao từ 11/11"', async () => {
    stubSummaryApi();
    open();
    expect(await screen.findByText('giao từ 11/11')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dòng chờ giao/ })).toBeNull();
    expect(screen.getByText('giao từ 11/11').closest('.stat-card')).toHaveTextContent('—');
  });

  it('kỳ mở mở thẳng ?filter=pending_delivery → bỏ filter khỏi URL, không gọi API với filter đó', async () => {
    const f = stubSummaryApi();
    open('/admin/summary?filter=pending_delivery');
    await screen.findByText('giao từ 11/11');
    await waitFor(() => expect(search()).not.toContain('filter='));
    expect(calledUrls(f).some((u) => u.includes('filter=pending_delivery'))).toBe(false);
    expect(screen.queryByText(/Đang lọc:/)).toBeNull();
  });

  it('kỳ khóa đang lọc chờ giao → › sang kỳ đang mở thì bỏ lọc', async () => {
    stubSummaryApi();
    open('/admin/summary?ym=2026-10&filter=pending_delivery');
    expect(await screen.findByRole('button', { name: /Dòng chờ giao/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Tháng sau' }));
    await screen.findByText('Tháng 11/2026');
    expect(search()).not.toContain('filter=');
  });

  it('"Phiếu đã đăng ký" → filter=unregistered: bảng chưa đăng ký + "Đang lọc: Chưa đăng ký · 2 người"; "Bỏ lọc" trả bảng theo người', async () => {
    stubSummaryApi();
    open();
    await userEvent.click(await screen.findByRole('button', { name: /Phiếu đã đăng ký/ }));
    expect(search()).toContain('filter=unregistered');
    expect(await screen.findByText('Phạm Thu Hà')).toBeInTheDocument();
    expect(screen.getByText('Đang lọc: Chưa đăng ký · 2 người')).toBeInTheDocument();
    expect(screen.queryByText('Phạm Văn Đức')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc' }));
    expect(await screen.findByText('Phạm Văn Đức')).toBeInTheDocument();
  });

  it('"Hết hàng / sắp hết" → view=item&filter=low: chỉ món sắp hết/hết hàng', async () => {
    stubSummaryApi();
    open();
    await userEvent.click(await screen.findByRole('button', { name: /Hết hàng \/ sắp hết/ }));
    expect(search()).toContain('view=item');
    expect(search()).toContain('filter=low');
    expect(await screen.findByText('Bút bi xanh')).toBeInTheDocument();
    expect(screen.getByText('Giấy A4')).toBeInTheDocument();
    expect(screen.queryByText('Giấy note')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Theo món' })).toHaveAttribute('aria-checked', 'true');
  });

  it('"Món ngoài danh mục chờ xem" → filter=custom_pending gửi lên API', async () => {
    const f = stubSummaryApi();
    open();
    await userEvent.click(await screen.findByRole('button', { name: /Món ngoài danh mục chờ xem/ }));
    await waitFor(() => expect(calledUrls(f).some((u) => u.includes('filter=custom_pending'))).toBe(true));
    expect(await screen.findByText('Đang lọc: Còn món ngoài DM chờ xem · 3 người')).toBeInTheDocument();
  });
});

describe('SummaryPage — thanh công cụ, bảng, ngăn kéo', () => {
  it('ô tìm maxLength=100; gõ → q lên API và URL', async () => {
    const f = stubSummaryApi();
    open();
    const box = await screen.findByRole('searchbox', { name: 'Tìm người, email…' });
    expect(box).toHaveAttribute('maxLength', '100');
    await userEvent.type(box, 'lan');
    await waitFor(() => expect(calledUrls(f).some((u) => u.includes('q=lan'))).toBe(true));
    expect(search()).toContain('q=lan');
  });

  it('q đổi từ ngoài (bấm "Tổng hợp kỳ" ở sidebar) → ô tìm đồng bộ về rỗng', async () => {
    stubSummaryApi();
    open();
    const box = await screen.findByRole('searchbox', { name: 'Tìm người, email…' });
    await userEvent.type(box, 'lan');
    await waitFor(() => expect(search()).toContain('q=lan'));
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Menu quản lý' })).getByRole('link', { name: 'Tổng hợp kỳ' }));
    await waitFor(() => expect(search()).not.toContain('q='));
    expect(screen.getByRole('searchbox', { name: 'Tìm người, email…' })).toHaveValue('');
    await new Promise((r) => setTimeout(r, 350));
    expect(search()).not.toContain('q=');
  });

  it('"Theo món" → view=item, bảng món; về "Theo người" bỏ view', async () => {
    stubSummaryApi();
    open();
    await screen.findByText('Phạm Văn Đức');
    await userEvent.click(screen.getByRole('radio', { name: 'Theo món' }));
    expect(search()).toContain('view=item');
    expect(await screen.findByText('Giấy note')).toBeInTheDocument();
    expect(screen.queryByText('Phạm Văn Đức')).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Theo người' }));
    expect(search()).not.toContain('view=');
  });

  it('bấm hàng → ?request=r-2 và mở ngăn kéo phiếu đó; đóng → bỏ request', async () => {
    const f = stubSummaryApi();
    open();
    await userEvent.click(await screen.findByText('Võ Thị Lan'));
    expect(search()).toContain('request=r-2');
    await waitFor(() => expect(calledUrls(f)).toContain('/api/admin/requests/r-2'));
    const drawer = await screen.findByRole('dialog', { name: 'Phiếu của Võ Thị Lan' });
    await userEvent.click(within(drawer).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(search()).not.toContain('request='));
  });

  it('nút "Điều chỉnh phiếu của Võ Thị Lan" mở đúng phiếu', async () => {
    stubSummaryApi();
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Điều chỉnh phiếu của Võ Thị Lan' }));
    expect(search()).toContain('request=r-2');
  });

  it('"Tạo phiếu hộ" ở kỳ đang mở mở hộp tạo hộ; ở kỳ đã khóa hộp cảnh báo và "Tạo phiếu" vô hiệu', async () => {
    stubSummaryApi();
    open('/admin/summary?ym=2026-10');
    await screen.findByText('Đã khóa');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo phiếu hộ' }));
    const locked = await screen.findByRole('dialog', { name: 'Tạo phiếu hộ — Tháng 10/2026' });
    expect(within(locked).getByText(/^Kỳ tháng 10 đã khóa lúc 00:00 ngày 11\/10/)).toBeInTheDocument();
    expect(within(locked).getByRole('button', { name: 'Tạo phiếu' })).toBeDisabled();
    await userEvent.click(within(locked).getByRole('button', { name: 'Hủy' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tháng sau' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Tạo phiếu hộ' }));
    const open11 = await screen.findByRole('dialog', { name: 'Tạo phiếu hộ — Tháng 11/2026' });
    expect(within(open11).getByRole('button', { name: 'Tạo phiếu' })).toBeEnabled();
  });

  it('ngăn kéo mở: ↓ sang người kế trong bảng (theo thứ tự hiển thị, nhóm "Chưa có phòng ban" cuối), ↑ về người trước', async () => {
    stubSummaryApi((url) => (url === '/api/admin/requests/r-3' ? jsonResponse(200, adminRequest({ id: 'r-3', full_name: 'Trần Bình' })) : undefined));
    open('/admin/summary?request=r-2');
    const drawer = await screen.findByRole('dialog', { name: 'Phiếu của Võ Thị Lan' });
    await screen.findByText('Phạm Văn Đức');
    within(drawer).getByRole('button', { name: 'Hủy' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(search()).toContain('request=r-3'));
    expect(await screen.findByRole('dialog', { name: 'Phiếu của Trần Bình' })).toBeInTheDocument();
    screen.getByRole('button', { name: 'Hủy' }).focus();
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(search()).toContain('request=r-2'));
  });

  it('lọc không khớp ai → "Không có phiếu nào khớp" + "Bỏ lọc"', async () => {
    stubSummaryApi((url) => (url.includes('by=person') ? jsonResponse(200, { items: [], next_cursor: null }) : undefined));
    open('/admin/summary?filter=custom_pending');
    expect(await screen.findByText('Không có phiếu nào khớp')).toBeInTheDocument();
    const clears = screen.getAllByRole('button', { name: 'Bỏ lọc' });
    await userEvent.click(clears[clears.length - 1]);
    expect(search()).not.toContain('filter=');
  });

  it('đang tải danh sách lọc mới (kỳ khóa) → bảng aria-busy, "Điều chỉnh" vô hiệu; xong thì bật lại', async () => {
    let release: (r: Response) => void = () => {};
    stubSummaryApi((url) => (url.includes('filter=pending_delivery') ? new Promise<Response>((res) => (release = res)) : undefined));
    open('/admin/summary?ym=2026-10');
    expect(await screen.findByRole('button', { name: 'Điều chỉnh phiếu của Võ Thị Lan' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: /Dòng chờ giao/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Điều chỉnh phiếu của Võ Thị Lan' })).toBeDisabled());
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    release(jsonResponse(200, { items: [PEOPLE[1]], next_cursor: null }));
    await waitFor(() => expect(screen.queryByText('Võ Thị Lan')).toBeNull());
    expect(screen.getByRole('button', { name: 'Điều chỉnh phiếu của Phạm Văn Đức' })).toBeEnabled();
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'false');
  });
});

describe('SummaryPage — số món hết hàng', () => {
  it('chỉ đếm món dùng được: món hết hàng thuộc nhóm đang ngừng (usable=false) không tính → "1 hết"', async () => {
    const paused = adminItem({ id: 'i-paused', name: 'Bút dạ quang', stock_qty: 0, stock_state: 'out', usable: false });
    stubSummaryApi((url) => (url === '/api/admin/items' ? jsonResponse(200, [...SUMMARY_ITEMS, paused]) : undefined));
    open();
    expect(await screen.findByRole('button', { name: /Hết hàng \/ sắp hết/ })).toHaveTextContent('1 hết · 1 sắp hết');
  });

  it('"sắp hết" cùng nguồn danh sách món dùng được (không lấy low_stock server đếm cả nhóm ngừng): món sắp hết nhóm ngừng không tính', async () => {
    const paused = adminItem({ id: 'i-paused-low', name: 'Kẹp giấy', stock_qty: 1, stock_state: 'low', usable: false });
    stubSummaryApi((url) => (url === '/api/admin/items' ? jsonResponse(200, [...SUMMARY_ITEMS, paused]) : undefined));
    open();
    const card = await screen.findByRole('button', { name: /Hết hàng \/ sắp hết/ });
    await waitFor(() => expect(card).toHaveTextContent('1 hết · 1 sắp hết'));
    expect(card.querySelector('.stat-card__v')).toHaveTextContent(/^2/);
  });

  it('danh sách món còn đang tải → ô ghi "—" thay vì số tạm', async () => {
    stubSummaryApi((url) => (url === '/api/admin/items' ? new Promise<Response>(() => {}) : undefined));
    open();
    const card = await screen.findByRole('button', { name: /Hết hàng \/ sắp hết/ });
    expect(card.querySelector('.stat-card__v')).toHaveTextContent(/^—/);
  });
});
