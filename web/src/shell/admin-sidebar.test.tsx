import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';

const rows = (n: number) => ({ items: Array.from({ length: n }, (_, i) => ({ id: `l${i}` })) });
const sideNav = () => screen.getByRole('navigation', { name: 'Menu quản lý' });
// Tên đọc = nhãn mục (+ ", n …" khi có số); title chỉ ở cột thu gọn hoặc khi nhãn bị cắt
const byLabel = (label: string) => (name: string) => name === label || name.startsWith(`${label},`);
const navLink = (label: string) => within(sideNav()).getByRole('link', { name: byLabel(label) });

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('AdminSidebar: đếm', () => {
  it('review trả 3 dòng → "Món ngoài danh mục" hiện 3; giao 6 người giao được ngay (1 người chưa nhận nhưng tủ trống không tính), Tủ/Kho 4 món thiếu cho người chờ kèm nhãn đọc màn hình', async () => {
    mockViewport(1280);
    stubShellApi({
      '/api/admin/review?status=pending': () => jsonResponse(200, rows(3)),
      '/api/admin/periods/2026-10/delivery-people': () => jsonResponse(200, { ym: '2026-10', people: [...Array.from({ length: 6 }, (_, i) => ({ user_sub: `p${i}`, status: 'pending', deliverable_now: true })), { user_sub: 'x', status: 'pending', deliverable_now: false }] }),
      '/api/admin/stock': () => jsonResponse(200, Array.from({ length: 4 }, (_, i) => ({ item_id: `i${i}`, short: i + 1, stock_state: 'short' }))),
    });
    renderApp(makeMe('admin'), '/admin/catalog');
    await waitFor(() => expect(navLink('Món ngoài danh mục')).toHaveTextContent('3'));
    expect(navLink('Món ngoài danh mục')).toHaveAccessibleName('Món ngoài danh mục, 3 món chờ xem');
    await waitFor(() => expect(navLink('Giao hàng')).toHaveAccessibleName('Giao hàng, 6 người chưa nhận'));
    await waitFor(() => expect(navLink('Tủ / Kho')).toHaveAccessibleName('Tủ / Kho, 4 món thiếu cho người chờ'));
  });

  it.each([
    [0, false],
    [1, true],
  ])('biên 0/1: review trả %i dòng → hiện đếm: %s', async (n, shown) => {
    mockViewport(1280);
    stubShellApi({
      '/api/admin/review?status=pending': () => jsonResponse(200, rows(n)),
      '/api/admin/periods/2026-10/delivery-people': () => jsonResponse(200, { ym: '2026-10', people: [{ user_sub: 'a', status: 'pending', deliverable_now: true }, { user_sub: 'b', status: 'pending', deliverable_now: true }] }),
    });
    renderApp(makeMe('admin'), '/admin/catalog');
    // Đếm giao hàng phụ thuộc kỳ hiện tại → khi nó hiện thì đếm review (độc lập) cũng đã về
    await waitFor(() => expect(navLink('Giao hàng')).toHaveTextContent('2'));
    if (shown) expect(navLink('Món ngoài danh mục')).toHaveAccessibleName('Món ngoài danh mục, 1 món chờ xem');
    else expect(navLink('Món ngoài danh mục')).toHaveAccessibleName('Món ngoài danh mục');
    expect(navLink('Món ngoài danh mục')).toHaveTextContent(shown ? /1/ : /^Món ngoài danh mục$/);
  });

  it('lỗi tải đếm → không có số, sidebar vẫn đủ 12 mục', async () => {
    mockViewport(1280);
    const f = stubShellApi({
      '/api/admin/review?status=pending': () => jsonResponse(500, null),
      '/api/admin/periods/2026-10/delivery-people': () => jsonResponse(409, { code: 'PERIOD_NOT_LOCKED' }),
      '/api/admin/stock': () => jsonResponse(500, null),
    });
    renderApp(makeMe('admin'), '/admin/catalog');
    await waitFor(() => expect(f.mock.calls.some(([u]) => u === '/api/admin/periods/2026-10/delivery-people')).toBe(true));
    await new Promise((r) => setTimeout(r, 0));
    const links = within(sideNav()).getAllByRole('link');
    expect(links).toHaveLength(12);
    for (const a of links) expect(a.textContent).not.toMatch(/\d/);
  });
});

describe('AdminSidebar: nhóm', () => {
  it('sidebar có 3 nhóm theo thứ tự; Còn nợ nằm trong "Hằng tháng"', async () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    await screen.findByRole('link', { name: /Kỳ đăng ký hiện tại/ });
    const groups = within(sideNav()).getAllByRole('group');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Hằng tháng', 'Danh mục và tủ', 'Quản lý']);
    expect(within(groups[0]).getByRole('link', { name: 'Còn nợ' })).toHaveAttribute('href', '/admin/backlog');
    expect(within(groups[0]).queryByRole('link', { name: 'Giao hàng (bản cũ)' })).toBeNull();
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
    expect(screen.getAllByText('Adm D&E').length).toBeGreaterThan(0);
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
      expect(within(side).getByRole('link', { name: byLabel('Categories') })).toBeInTheDocument();
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

  it('nhãn sidebar theo thiết kế: Sản phẩm, Tủ / Kho, Danh bạ', async () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    await screen.findByRole('navigation', { name: 'Menu quản lý' });
    for (const t of ['Sản phẩm', 'Tủ / Kho', 'Danh bạ']) expect(navLink(t)).toBeInTheDocument();
  });
});

describe('AdminSidebar: Tổng hợp, Còn nợ, Báo cáo trong nhóm Hằng tháng', () => {
  it.each(['/admin/month', '/admin/reports', '/admin/backlog'])('đang ở %s → mục trong "Hằng tháng" có aria-current, nhóm không cần mở', async (path) => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), path);
    const monthly = within(await screen.findByRole('navigation', { name: 'Menu quản lý' })).getByRole('group', { name: 'Hằng tháng' });
    expect(within(monthly).getAllByRole('link').filter((a) => a.hasAttribute('aria-current'))).toHaveLength(1);
  });
});

describe('AdminSidebar: tên đầy đủ khi nhãn bị cắt', () => {
  const TABLET = '(min-width: 768px) and (max-width: 1279px)';

  function stubWidth(width: number) {
    const subs = { add: 0, remove: 0 };
    vi.stubGlobal('matchMedia', (query: string) => {
      const max = /max-width:\s*(\d+)px/.exec(query);
      const min = /min-width:\s*(\d+)px/.exec(query);
      const matches = !query.includes('prefers-reduced-motion') && (!max || width <= Number(max[1])) && (!min || width >= Number(min[1]));
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: () => {
          if (query === TABLET) subs.add++;
        },
        removeEventListener: () => {
          if (query === TABLET) subs.remove++;
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      };
    });
    return subs;
  }

  it('cột thu gọn (768–1279): mọi mục có title = nhãn', async () => {
    stubWidth(1024);
    stubShellApi({});
    renderApp(makeMe('admin'), '/admin/catalog');
    await waitFor(() => expect(navLink('Danh mục')).toHaveAttribute('title', 'Danh mục'));
  });

  it('cột đủ chữ (≥ 1280): rê chuột lên mục có nhãn bị cắt → title = tên đầy đủ; nhãn vừa thì không title', async () => {
    stubWidth(1440);
    stubShellApi({});
    renderApp(makeMe('admin'), '/admin/catalog');
    const long = navLink('Món ngoài danh mục');
    const short = navLink('Danh mục');
    const label = (a: HTMLElement) => a.querySelector<HTMLElement>('.side__label')!;
    Object.defineProperty(label(long), 'scrollWidth', { configurable: true, value: 220 });
    Object.defineProperty(label(long), 'clientWidth', { configurable: true, value: 140 });
    Object.defineProperty(label(short), 'scrollWidth', { configurable: true, value: 60 });
    Object.defineProperty(label(short), 'clientWidth', { configurable: true, value: 140 });
    await userEvent.hover(long);
    expect(long).toHaveAttribute('title', 'Món ngoài danh mục');
    await userEvent.hover(short);
    expect(short).not.toHaveAttribute('title');
  });

  it('truy vấn cột thu gọn chỉ nghe một lần cho cả menu (không mỗi mục một lần, không nghe lại mỗi lần vẽ)', async () => {
    const subs = stubWidth(1440);
    stubShellApi({ '/api/admin/review?status=pending': () => jsonResponse(200, rows(3)) });
    renderApp(makeMe('admin'), '/admin/catalog');
    await waitFor(() => expect(navLink('Món ngoài danh mục')).toHaveTextContent('3'));
    // AdminSidebar + khối người dùng cuối cột
    expect(subs.add).toBe(2);
    expect(subs.remove).toBe(0);
  });
});
