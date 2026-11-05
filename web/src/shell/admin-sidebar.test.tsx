import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';

const rows = (n: number) => ({ items: Array.from({ length: n }, (_, i) => ({ id: `l${i}` })) });
const sideNav = () => screen.getByRole('navigation', { name: 'Menu quản lý' });
const navLink = (title: string) => within(sideNav()).getByTitle(title);

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('AdminSidebar: đếm', () => {
  it('review trả 3 dòng → "Món ngoài danh mục" hiện 3; giao 6 dòng, kho 4 món kèm nhãn đọc màn hình', async () => {
    mockViewport(1280);
    stubShellApi({
      '/api/admin/review?status=pending': () => jsonResponse(200, rows(3)),
      '/api/admin/periods/2026-10/summary': () => jsonResponse(200, { lines_pending_delivery: 6 }),
      '/api/admin/stock/low': () => jsonResponse(200, rows(4).items),
    });
    renderApp(makeMe('admin'), '/admin/catalog');
    await waitFor(() => expect(navLink('Món ngoài danh mục')).toHaveTextContent('3'));
    expect(navLink('Món ngoài danh mục')).toHaveAccessibleName('Món ngoài danh mục, 3 món chờ xem');
    await waitFor(() => expect(navLink('Giao hàng')).toHaveAccessibleName('Giao hàng, 6 dòng chờ giao'));
    await waitFor(() => expect(navLink('Tủ / Kho')).toHaveAccessibleName('Tủ / Kho, 4 món sắp hết'));
  });

  it.each([
    [0, false],
    [1, true],
  ])('biên 0/1: review trả %i dòng → hiện đếm: %s', async (n, shown) => {
    mockViewport(1280);
    stubShellApi({
      '/api/admin/review?status=pending': () => jsonResponse(200, rows(n)),
      '/api/admin/periods/2026-10/summary': () => jsonResponse(200, { lines_pending_delivery: 2 }),
    });
    renderApp(makeMe('admin'), '/admin/catalog');
    // Đếm giao hàng phụ thuộc kỳ hiện tại → khi nó hiện thì đếm review (độc lập) cũng đã về
    await waitFor(() => expect(navLink('Giao hàng')).toHaveTextContent('2'));
    if (shown) expect(navLink('Món ngoài danh mục')).toHaveAccessibleName('Món ngoài danh mục, 1 món chờ xem');
    else expect(navLink('Món ngoài danh mục')).toHaveAccessibleName('Món ngoài danh mục');
    expect(navLink('Món ngoài danh mục')).toHaveTextContent(shown ? /1/ : /^Món ngoài danh mục$/);
  });

  it('lỗi tải đếm → không có số, sidebar vẫn đủ 11 mục (nhóm "Xem lại sau" thu gọn)', async () => {
    mockViewport(1280);
    const f = stubShellApi({
      '/api/admin/review?status=pending': () => jsonResponse(500, null),
      '/api/admin/periods/2026-10/summary': () => jsonResponse(500, null),
      '/api/admin/stock/low': () => jsonResponse(500, null),
    });
    renderApp(makeMe('admin'), '/admin/catalog');
    await waitFor(() => expect(f.mock.calls.some(([u]) => u === '/api/admin/periods/2026-10/summary')).toBe(true));
    await new Promise((r) => setTimeout(r, 0));
    const links = within(sideNav()).getAllByRole('link');
    expect(links).toHaveLength(11);
    for (const a of links) expect(a.textContent).not.toMatch(/\d/);
  });
});

describe('AdminSidebar: nhóm', () => {
  it('sidebar có 4 nhóm theo thứ tự v2', async () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    await screen.findByRole('link', { name: /Kỳ đăng ký hiện tại/ });
    const groups = within(sideNav()).getAllByRole('group');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Hằng tháng', 'Danh mục và tủ', 'Quản lý', 'Xem lại sau']);
    await userEvent.click(within(groups[3]).getByRole('button', { name: 'Xem lại sau' }));
    expect(within(groups[3]).getByRole('link', { name: 'Còn nợ' })).toHaveAttribute('href', '/admin/backlog');
    expect(within(groups[3]).getByRole('link', { name: 'Giao hàng (bản cũ)' })).toHaveAttribute('href', '/admin/delivery/classic');
    expect(within(groups[1]).getByRole('link', { name: /Món ngoài danh mục/ })).toBeInTheDocument();
  });
});

describe('AdminSidebar: thẻ kỳ, người dùng, ngôn ngữ', () => {
  it('đáy sidebar: thẻ kỳ, họ tên + vai, nút Đăng xuất', async () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    expect(await screen.findByRole('link', { name: /Kỳ đăng ký hiện tại: tháng 11 · đang mở/ })).toHaveTextContent('còn 4 ngày');
    expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
    expect(screen.getAllByText('Hành chính').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
  });

  it('cột ≥ 1280: hàng tài khoản một dòng — Đăng xuất là nút biểu tượng có tên, đổi ngôn ngữ nằm sau nút "Ngôn ngữ"', async () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    const logout = await screen.findByRole('button', { name: 'Đăng xuất' });
    expect(logout).toHaveTextContent(/^$/);
    expect(logout).toHaveAttribute('title', 'Đăng xuất');
    expect(screen.queryByRole('radio', { name: 'English' })).toBeNull();
    const lang = screen.getByRole('button', { name: 'Ngôn ngữ' });
    expect(lang).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(lang);
    expect(lang).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('radio', { name: 'English' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('radio', { name: 'English' })).toBeNull();
  });

  it('mở chuông khi hộp "Ngôn ngữ" đang mở → hộp ngôn ngữ đóng (không chồng nhau); mở lại hộp ngôn ngữ thì chuông đóng', async () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    const lang = await screen.findByRole('button', { name: 'Ngôn ngữ' });
    await userEvent.click(lang);
    expect(screen.getByRole('radiogroup', { name: 'Ngôn ngữ' })).toBeInTheDocument();
    const bell = screen.getByRole('button', { name: /^Thông báo/ });
    await userEvent.click(bell);
    expect(screen.queryByRole('radiogroup', { name: 'Ngôn ngữ' })).toBeNull();
    expect(bell).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(lang);
    expect(screen.getByRole('radiogroup', { name: 'Ngôn ngữ' })).toBeInTheDocument();
    expect(bell).toHaveAttribute('aria-expanded', 'false');
  });

  it('cột ≥ 1280: nút "Ngôn ngữ" hiện mã ngôn ngữ hiện tại; mở → aria-controls trỏ tới hộp, focus vào lựa chọn đang chọn; bấm ra ngoài thì đóng; Esc đóng và trả focus về nút', async () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    const lang = await screen.findByRole('button', { name: 'Ngôn ngữ' });
    expect(lang).toHaveTextContent('VI');
    expect(lang).not.toHaveAttribute('aria-controls');
    await userEvent.click(lang);
    const group = screen.getByRole('radiogroup', { name: 'Ngôn ngữ' });
    expect(group.closest(`[id="${lang.getAttribute('aria-controls')}"]`)).not.toBeNull();
    expect(screen.getByRole('radio', { name: 'Tiếng Việt' })).toHaveFocus();
    await userEvent.click(screen.getByRole('main'));
    expect(screen.queryByRole('radiogroup', { name: 'Ngôn ngữ' })).toBeNull();
    expect(lang).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(lang);
    await userEvent.click(screen.getByRole('radio', { name: 'Tiếng Việt' }));
    expect(screen.getByRole('radiogroup', { name: 'Ngôn ngữ' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('radiogroup', { name: 'Ngôn ngữ' })).toBeNull();
    expect(lang).toHaveFocus();
  });

  it('đăng xuất lỗi → câu "Chưa đăng xuất được — thử lại." dưới nút', async () => {
    mockViewport(1280);
    stubShellApi({ '/api/auth/logout': () => jsonResponse(500, null) });
    renderApp(makeMe('admin'), '/admin/catalog');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa đăng xuất được — thử lại.');
  });

  it('đổi English → nhãn nhóm và mục sidebar đổi', async () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    try {
      await userEvent.click(screen.getByRole('button', { name: 'Ngôn ngữ' }));
      await userEvent.click(screen.getByRole('radio', { name: 'English' }));
      const side = screen.getByRole('navigation', { name: 'Admin menu' });
      expect(within(side).getByRole('group', { name: 'Monthly' })).toBeInTheDocument();
      expect(within(side).getByTitle('Categories')).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage('vi');
    }
  });
});

describe('AdminSidebar: đầu và cuối', () => {
  it('không còn hàng thương hiệu ở đầu sidebar', async () => {
    mockViewport(1280);
    stubShellApi();
    const { container } = renderApp(makeMe('admin'), '/admin/catalog');
    await screen.findByRole('navigation', { name: 'Menu quản lý' });
    expect(container.querySelector('.side__brand')).toBeNull();
  });

  it('chuông nằm cùng khối người dùng ở cuối, sau thanh điều hướng', async () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    const bell = await screen.findByRole('button', { name: /Thông báo/ });
    expect(bell.closest('.side__user')).not.toBeNull();
    expect(sideNav().compareDocumentPosition(bell) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('nhãn sidebar theo thiết kế: Danh mục món, Tủ / Kho, Nhân viên', async () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    await screen.findByRole('navigation', { name: 'Menu quản lý' });
    for (const t of ['Danh mục món', 'Tủ / Kho', 'Nhân viên']) expect(navLink(t)).toBeInTheDocument();
  });
});

describe('AdminSidebar: nhóm "Xem lại sau" thu gọn', () => {
  const later = () => within(sideNav()).getByRole('group', { name: 'Xem lại sau' });
  const toggle = () => within(later()).getByRole('button', { name: 'Xem lại sau' });

  afterEach(() => localStorage.clear());

  it('mặc định thu gọn: nút aria-expanded=false, không có liên kết nào trong nhóm', async () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    await screen.findByRole('navigation', { name: 'Menu quản lý' });
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(within(later()).queryAllByRole('link')).toHaveLength(0);
  });

  it('bấm nút → mở (aria-expanded=true, thấy 2 liên kết); bấm lại → thu gọn', async () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    await screen.findByRole('navigation', { name: 'Menu quản lý' });
    await userEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(within(later()).getAllByRole('link').map((a) => a.getAttribute('title'))).toEqual(['Còn nợ', 'Giao hàng (bản cũ)']);
    await userEvent.click(toggle());
    expect(within(later()).queryAllByRole('link')).toHaveLength(0);
  });

  it('trạng thái mở nhớ qua lần tải sau (localStorage)', async () => {
    mockViewport(1280);
    stubShellApi();
    const first = renderApp(makeMe('admin'), '/admin/catalog');
    await userEvent.click(await within(await screen.findByRole('navigation', { name: 'Menu quản lý' })).findByRole('button', { name: 'Xem lại sau' }));
    first.unmount();
    renderApp(makeMe('admin'), '/admin/catalog');
    await screen.findByRole('navigation', { name: 'Menu quản lý' });
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  });

  it.each(['/admin/backlog', '/admin/delivery/classic'])('đang ở %s (trong nhóm) → tự mở, mục đang chọn có aria-current', async (path) => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), path);
    await screen.findByRole('navigation', { name: 'Menu quản lý' });
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(within(later()).getAllByRole('link').filter((a) => a.hasAttribute('aria-current'))).toHaveLength(1);
  });

  it('đang ở trong nhóm: bấm nút không ghi localStorage (không đè lựa chọn đã nhớ) và nhóm vẫn mở', async () => {
    mockViewport(1280);
    stubShellApi();
    localStorage.setItem('vpp.admin.navLater', '1');
    renderApp(makeMe('admin'), '/admin/backlog');
    await screen.findByRole('navigation', { name: 'Menu quản lý' });
    await userEvent.click(toggle());
    expect(localStorage.getItem('vpp.admin.navLater')).toBe('1');
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  });

  it('/admin/delivery/classic không đánh dấu thêm mục "Giao hàng" (chỉ khớp đúng đường dẫn)', async () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/delivery/classic');
    await screen.findByRole('navigation', { name: 'Menu quản lý' });
    expect(navLink('Giao hàng')).not.toHaveAttribute('aria-current');
    expect(navLink('Giao hàng (bản cũ)')).toHaveAttribute('aria-current', 'page');
  });

  it('localStorage hỏng (ném lỗi) → nhóm vẫn dựng, vẫn bấm mở được', async () => {
    mockViewport(1280);
    stubShellApi();
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      renderApp(makeMe('admin'), '/admin/catalog');
      await screen.findByRole('navigation', { name: 'Menu quản lý' });
      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(toggle());
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });
});
