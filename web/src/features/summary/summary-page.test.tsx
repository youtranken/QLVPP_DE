import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { LOCKED, PEOPLE, SUMMARY_ITEMS, calledUrls, stubSummaryApi } from './summary-fixtures';
import { adminItem, adminRequest } from './adjust-fixtures';

const search = () => screen.getByTestId('location-search').textContent ?? '';
const open = (path = '/admin/summary') => {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
};

afterEach(() => vi.unstubAllGlobals());

describe('SummaryPage — đầu trang, tháng, URL', () => {
  it('không có ?ym → mặc định kỳ khóa gần nhất 2026-10 (không phải kỳ đang mở), không gọi danh sách kỳ mở', async () => {
    const f = stubSummaryApi();
    open();
    await waitFor(() => expect(search()).toContain('ym=2026-10'));
    expect(await screen.findByText('Đã khóa')).toBeInTheDocument();
    expect(calledUrls(f).some((u) => u.includes('/2026-11/requests'))).toBe(false);
  });

  it('danh sách trả 409 PERIOD_NOT_LOCKED → khung lỗi "Không tải được dữ liệu — thử lại.", không quay "Đang tải…" mãi', async () => {
    stubSummaryApi((url) =>
      url.startsWith('/api/admin/periods/2026-10/requests') ? jsonResponse(409, { code: 'PERIOD_NOT_LOCKED', ym: '2026-11', deadline: '2026-11-10T17:00:00.000Z' }) : undefined,
    );
    open('/admin/summary?ym=2026-10');
    expect(await screen.findByText('Không tải được dữ liệu — thử lại.')).toBeInTheDocument();
    expect(screen.queryByText('Đang tải…')).toBeNull();
  });
  it('đúng một h1 "Tổng hợp kỳ", breadcrumb "Hằng tháng", mô tả; badge "Đã khóa"; › khóa ở kỳ khóa gần nhất, kỳ mở hiện vô hiệu "Đang mở"', async () => {
    stubSummaryApi();
    open();
    expect(await screen.findByText('Đã khóa')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tổng hợp kỳ');
    expect(within(screen.getByRole('navigation', { name: 'Vị trí' })).getByText('Hằng tháng')).toBeInTheDocument();
    expect(screen.getByText('Ai đã đăng ký, món nào cần mua, phiếu nào cần sửa — trong một bảng.')).toBeInTheDocument();
    expect(screen.getByText('Tháng 10/2026')).toBeInTheDocument();
    const month = screen.getByRole('group', { name: 'Chọn tháng' });
    expect(within(month).getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
    expect(within(month).getByRole('button', { name: 'Tháng 11/2026 · Đang mở' })).toBeDisabled();
  });
  it('?ym=2099-01 vượt trần → URL thay bằng kỳ khóa gần nhất ?ym=2026-10, không request nào mang 2099-01', async () => {
    const f = stubSummaryApi();
    open('/admin/summary?ym=2099-01');
    await waitFor(() => expect(search()).toContain('ym=2026-10'));
    expect(await screen.findByRole('button', { name: /Phiếu đã đăng ký/ })).toHaveTextContent('30/38');
    expect(calledUrls(f).some((u) => u.includes('2099-01'))).toBe(false);
  });

  it.each(['2026-00', '2025-13', '2026-1'])('?ym=%s sai mẫu → về kỳ khóa gần nhất, không gọi API kỳ sai', async (bad) => {
    const f = stubSummaryApi();
    open(`/admin/summary?ym=${bad}`);
    expect(await screen.findByText('Tháng 10/2026')).toBeInTheDocument();
    await waitFor(() => expect(search()).toContain('ym=2026-10'));
    expect(calledUrls(f).some((u) => u.includes(`/periods/${bad}/`))).toBe(false);
  });

  it('kỳ đã khóa: badge "Đã khóa", nhãn "Phiếu đã đăng ký · lúc khóa"', async () => {
    stubSummaryApi();
    open('/admin/summary?ym=2026-10');
    const kpi = await screen.findByRole('button', { name: /Phiếu đã đăng ký/ });
    expect(kpi).toHaveTextContent('30/38');
    expect(kpi).toHaveTextContent('Phiếu đã đăng ký · lúc khóa');
    expect(screen.getByText('Đã khóa')).toBeInTheDocument();
  });

  it('?ym=2026-11 (kỳ đang mở) → URL thành 2026-10 + dải nhắc "xem được từ 00:00 ngày 11/11"; không gọi API kỳ mở cho danh sách', async () => {
    const f = stubSummaryApi();
    open('/admin/summary?ym=2026-11');
    await waitFor(() => expect(search()).toContain('ym=2026-10'));
    expect(await screen.findByText(/Kỳ tháng 11 đang mở, xem được từ 00:00 ngày 11\/11\./)).toBeInTheDocument();
    expect(calledUrls(f).some((u) => u.includes('/2026-11/requests') || u.includes('/2026-11/unregistered'))).toBe(false);
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



  it('?ym=kỳ mở&filter=pending_delivery → về kỳ khóa 2026-10 và giữ lọc chờ giao', async () => {
    const f = stubSummaryApi();
    open('/admin/summary?ym=2026-11&filter=pending_delivery');
    await waitFor(() => expect(search()).toContain('ym=2026-10'));
    expect(await screen.findByRole('button', { name: /Dòng chờ giao/ })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(calledUrls(f).some((u) => u.includes('/2026-10/requests') && u.includes('filter=pending_delivery'))).toBe(true));
  });
  it('kỳ khóa đang lọc chờ giao → ‹ sang kỳ trước vẫn giữ lọc', async () => {
    stubSummaryApi();
    open('/admin/summary?ym=2026-10&filter=pending_delivery');
    expect(await screen.findByRole('button', { name: /Dòng chờ giao/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));
    await screen.findByText('Tháng 9/2026');
    expect(search()).toContain('filter=pending_delivery');
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

  it('kỳ khóa: "Món ngoài danh mục chờ xem" → filter=custom_pending gửi lên API', async () => {
    const f = stubSummaryApi();
    open('/admin/summary?ym=2026-10');
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

  it.each(['2026-09', '2026-10'])('kỳ %s: không còn nút tạo phiếu thay người; nút chính "Sang Gửi ADM →" dẫn /admin/send-adm?ym=', async (ym) => {
    stubSummaryApi();
    open(`/admin/summary?ym=${ym}`);
    const link = await screen.findByRole('link', { name: 'Sang Gửi ADM →' });
    expect(link).toHaveAttribute('href', `/admin/send-adm?ym=${ym}`);
    expect(link).toHaveClass('btn--primary');
    expect(screen.queryByRole('button', { name: /Tạo phiếu/ })).toBeNull();
  });

  it('outside 2 → dòng nhỏ "+2 phiếu của người ngoài danh sách"; outside 0 → không có', async () => {
    stubSummaryApi((url) => (url === '/api/admin/periods/2026-10/summary' ? jsonResponse(200, { ...LOCKED, registered: 6, headcount: 8, unregistered: 2, outside: 2 }) : undefined));
    open('/admin/summary?ym=2026-10');
    expect(await screen.findByRole('button', { name: /Phiếu đã đăng ký/ })).toHaveTextContent('6/8');
    expect(screen.getByText('+2 phiếu của người ngoài danh sách')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));
    await screen.findByText('Tháng 9/2026');
    expect(screen.queryByText(/ngoài danh sách/)).toBeNull();
  });

  it('kỳ khóa 0 phiếu → khung trống "Kỳ tháng 10 không có phiếu nào (0/38)" kèm danh sách chưa đăng ký; kỳ 1 phiếu → bảng', async () => {
    const zero = { ...LOCKED, registered: 0, unregistered: 38 };
    const f = stubSummaryApi((url) => (url === '/api/admin/periods/2026-10/summary' ? jsonResponse(200, zero) : undefined));
    open('/admin/summary?ym=2026-10');
    expect(await screen.findByText('Kỳ tháng 10 không có phiếu nào (0/38)')).toBeInTheDocument();
    expect(await screen.findByText('Phạm Thu Hà')).toBeInTheDocument();
    expect(calledUrls(f).some((u) => u.includes('/2026-10/requests'))).toBe(false);
    vi.unstubAllGlobals();
  });

  it('kỳ khóa 1 phiếu → bảng theo người, không có khung trống', async () => {
    stubSummaryApi((url) => (url === '/api/admin/periods/2026-10/summary' ? jsonResponse(200, { ...LOCKED, registered: 1 }) : undefined));
    open('/admin/summary?ym=2026-10');
    expect(await screen.findByText('Phạm Văn Đức')).toBeInTheDocument();
    expect(screen.queryByText(/không có phiếu nào/)).toBeNull();
  });

  it('ngăn kéo mở: ↓ sang người kế trong bảng (theo thứ tự hiển thị, nhóm "Chưa có phòng ban" cuối), ↑ về người trước', async () => {
    stubSummaryApi((url) => (url === '/api/admin/requests/r-3' ? jsonResponse(200, adminRequest({ id: 'r-3', full_name: 'Trần Bình' })) : undefined));
    open('/admin/summary?request=r-2');
    const drawer = await screen.findByRole('dialog', { name: 'Phiếu của Võ Thị Lan' });
    await screen.findByText('Phạm Văn Đức');
    within(drawer).getByRole('button', { name: 'Quay lại' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(search()).toContain('request=r-3'));
    expect(await screen.findByRole('dialog', { name: 'Phiếu của Trần Bình' })).toBeInTheDocument();
    screen.getByRole('button', { name: 'Quay lại' }).focus();
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

describe('SummaryPage — vượt tối đa, người đã nghỉ (R-D8.20, R-D13.11)', () => {
  it('kỳ khóa: nút "Vượt tối đa" → filter=over_max lên API + "Đang lọc: Vượt tối đa"; người có dòng vượt có nhãn "Vượt tối đa"', async () => {
    const f = stubSummaryApi();
    open('/admin/summary?ym=2026-10');
    expect(await screen.findByText('Phạm Văn Đức')).toBeInTheDocument();
    const lan = screen.getByText('Võ Thị Lan').closest('tr')!;
    expect(within(lan).getByText('Vượt tối đa')).toBeInTheDocument();
    expect(within(screen.getByText('Phạm Văn Đức').closest('tr')!).queryByText('Vượt tối đa')).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Vượt tối đa' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(search()).toContain('filter=over_max');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(calledUrls(f).some((u) => u.includes('filter=over_max'))).toBe(true));
    expect(await screen.findByText('Đang lọc: Vượt tối đa · 3 người')).toBeInTheDocument();
  });

  it('?ym=kỳ mở&filter=over_max → về kỳ khóa 2026-10, nút "Vượt tối đa" bật và lọc lên API', async () => {
    const f = stubSummaryApi();
    open('/admin/summary?ym=2026-11&filter=over_max');
    await waitFor(() => expect(search()).toContain('ym=2026-10'));
    expect(await screen.findByRole('button', { name: 'Vượt tối đa' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(calledUrls(f).some((u) => u.includes('/2026-10/requests') && u.includes('filter=over_max'))).toBe(true));
  });
  it('theo món: dòng vượt tối đa có nhãn "Vượt tối đa hiện tại (4)"', async () => {
    stubSummaryApi();
    open('/admin/summary?ym=2026-10&view=item');
    expect(await screen.findByText('Vượt tối đa hiện tại (4)')).toBeInTheDocument();
    expect(screen.getAllByText(/^Vượt tối đa hiện tại/)).toHaveLength(1);
  });

  it('?left=1 → lọc người đã nghỉ còn phần chưa nhận; mở phiếu, giảm → lý do chọn sẵn "Người đã nghỉ"', async () => {
    const f = stubSummaryApi();
    open('/admin/summary?ym=2026-10&left=1');
    await waitFor(() => expect(calledUrls(f).some((u) => u.includes('filter=left'))).toBe(true));
    expect(await screen.findByText('Đang lọc: Người đã nghỉ còn phần chưa nhận · 3 người')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Điều chỉnh phiếu của Võ Thị Lan' }));
    const drawer = await screen.findByRole('dialog', { name: 'Phiếu của Võ Thị Lan' });
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Bớt Giấy note vàng' }));
    expect(within(drawer).getByRole('radio', { name: 'Người đã nghỉ' })).toBeChecked();
  });

  it('?ym=kỳ mở&left=1 → về kỳ khóa 2026-10 và lọc người đã nghỉ', async () => {
    const f = stubSummaryApi();
    open('/admin/summary?ym=2026-11&left=1');
    await waitFor(() => expect(search()).toContain('ym=2026-10'));
    await waitFor(() => expect(calledUrls(f).some((u) => u.includes('/2026-10/requests') && u.includes('filter=left'))).toBe(true));
  });
});
