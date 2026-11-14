import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubRequestApi } from '@/test/request-api-stub';

afterEach(() => vi.unstubAllGlobals());

describe('MemberShell', () => {
  it('390 px: thanh dưới "Điều hướng chính" có đúng 3 mục Đăng ký · Lịch sử · Tôi, không có tab trên', () => {
    mockViewport(390);
    renderApp(makeMe('member'), '/');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['Đăng ký', 'Lịch sử']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/', '/history']);
    expect(within(nav).getByRole('button', { name: 'Tôi' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Chuyển trang' })).toBeNull();
  });

  it('390 px: "Tôi" là nút mở sheet "Tài khoản" (không đổi URL); Esc đóng và trả focus về nút "Tôi"', async () => {
    mockViewport(390);
    renderApp(makeMe('member'), '/');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    const me = within(nav).getByRole('button', { name: 'Tôi' });
    await userEvent.click(me);
    const sheet = screen.getByRole('dialog', { name: 'Tài khoản' });
    expect(sheet).toHaveClass('sheet--bottom');
    expect(screen.getByTestId('location')).toHaveTextContent('/');
    // Thanh trên ≤ 900 không còn VI/EN: đổi ngôn ngữ nằm trong sheet "Tôi"
    expect(within(sheet).getByRole('radiogroup', { name: 'Ngôn ngữ' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Đăng xuất (cả Tài khoản D&E)' })).toHaveClass('btn--danger');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(me).toHaveFocus();
  });

  it('390 px: ở /me nút "Tôi" được đánh dấu trang hiện tại', () => {
    mockViewport(390);
    renderApp(makeMe('member'), '/me');
    expect(within(screen.getByRole('navigation', { name: 'Điều hướng chính' })).getByRole('button', { name: 'Tôi' })).toHaveAttribute('aria-current', 'page');
  });

  it.each([360, 390, 900])('%i px: thanh trên chỉ còn tên app + chuông (không VI/EN, không avatar) để tên app không bị cắt', (width) => {
    mockViewport(width);
    renderApp(makeMe('member'), '/');
    const banner = screen.getByRole('banner');
    expect(within(banner).queryByRole('radiogroup')).toBeNull();
    expect(banner.querySelector('.m-avatar')).toBeNull();
    expect(within(banner).getByRole('button', { name: /^Thông báo/ })).toBeInTheDocument();
  });

  it.each([1280])('%i px: header có nút đổi ngôn ngữ VI/EN đứng trước chuông', (width) => {
    mockViewport(width);
    renderApp(makeMe('member'), '/');
    const banner = screen.getByRole('banner');
    const group = within(banner).getByRole('radiogroup', { name: 'Ngôn ngữ' });
    expect(within(group).getByRole('radio', { name: 'VI – Tiếng Việt' })).toHaveTextContent('VI');
    expect(within(group).getByRole('radio', { name: 'EN – English' })).toHaveTextContent('EN');
    const bell = within(banner).getByRole('button', { name: /^Thông báo/ });
    expect(group.compareDocumentPosition(bell) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('1280 px: banner full-bleed bọc nội dung trong .m-top__in (nền đặc nằm ở banner, nội dung giữ max 1440)', () => {
    mockViewport(1280);
    renderApp(makeMe('member'), '/');
    expect(screen.getByRole('banner').querySelector('.m-top__in')).not.toBeNull();
  });

  it('1280 px: tab trên Đăng ký · Lịch sử, không có thanh dưới', () => {
    mockViewport(1280);
    renderApp(makeMe('member'), '/');
    const tabs = screen.getByRole('navigation', { name: 'Chuyển trang' });
    expect(within(tabs).getAllByRole('link').map((a) => a.textContent)).toEqual(['Đăng ký', 'Lịch sử']);
    expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Tôi' })).toBeNull();
  });

  it('1280 px: bấm tên ở góc phải mở hộp "Tài khoản" có "Đăng xuất"', async () => {
    mockViewport(1280);
    renderApp(makeMe('member'), '/');
    const btn = screen.getByRole('button', { name: 'Mở tài khoản của Nguyễn Văn An' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    const box = screen.getByRole('dialog', { name: 'Tài khoản' });
    expect(within(box).getByText('Phòng Công trình · Nhân viên')).toBeInTheDocument();
    expect(within(box).getByText('an.nguyen@pmh.com.vn')).toBeInTheDocument();
    expect(within(box).queryByText(/Tài khoản D&E/, { ignore: 'button' })).toBeNull();
    expect(within(box).getByRole('button', { name: 'Đăng xuất (cả Tài khoản D&E)' })).toHaveClass('btn--danger');
    expect(within(box).queryByRole('radiogroup')).toBeNull();
  });

  it('popover: Esc đóng và trả focus về nút tên; bấm ra ngoài đóng', async () => {
    mockViewport(1280);
    renderApp(makeMe('member'), '/');
    const btn = screen.getByRole('button', { name: 'Mở tài khoản của Nguyễn Văn An' });
    await userEvent.click(btn);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Tài khoản' })).toBeNull();
    expect(btn).toHaveFocus();
    await userEvent.click(btn);
    expect(screen.getByRole('dialog', { name: 'Tài khoản' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('main'));
    expect(screen.queryByRole('dialog', { name: 'Tài khoản' })).toBeNull();
  });

  it.each([
    [900, true],
    [901, false],
  ])('mốc %i px: thanh dưới = %s, tab trên ngược lại', (width, bottom) => {
    mockViewport(width);
    renderApp(makeMe('member'), '/');
    expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' }) !== null).toBe(bottom);
    expect(screen.queryByRole('navigation', { name: 'Chuyển trang' }) !== null).toBe(!bottom);
  });

  it('mục đang ở được đánh dấu aria-current', () => {
    mockViewport(390);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { items: [], next_cursor: null }))));
    renderApp(makeMe('member'), '/history');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(within(nav).getByRole('link', { name: 'Lịch sử' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Đăng ký' })).not.toHaveAttribute('aria-current');
  });

  it('1280 px: tab "Đăng ký" có aria-current=page ở /, các tab khác không', () => {
    mockViewport(1280);
    renderApp(makeMe('member'), '/');
    const tabs = screen.getByRole('navigation', { name: 'Chuyển trang' });
    expect(within(tabs).getByRole('link', { name: 'Đăng ký' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getByRole('link', { name: 'Lịch sử' })).not.toHaveAttribute('aria-current');
  });

  it('1280 px: khối avatar hiện chữ đầu, tên và phòng; 390 px không có avatar trên thanh trên (tài khoản ở "Tôi")', () => {
    mockViewport(1280);
    const { unmount } = renderApp(makeMe('member'), '/');
    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('Nguyễn Văn An')).toBeInTheDocument();
    expect(within(banner).getByText('Phòng Công trình')).toBeInTheDocument();
    expect(within(banner).getByText('NA')).toBeInTheDocument();
    unmount();
    mockViewport(390);
    renderApp(makeMe('member'), '/');
    expect(within(screen.getByRole('banner')).queryByText('Phòng Công trình')).toBeNull();
    expect(within(screen.getByRole('banner')).queryByText('NA')).toBeNull();
  });

  it('chữ đầu avatar bỏ từ không bắt đầu bằng chữ: "Nguyễn Thị Lan (demo)" → "NL" (không ra "N(")', () => {
    mockViewport(1280);
    renderApp(makeMe('member', { fullName: 'Nguyễn Thị Lan (demo)' }), '/');
    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('NL')).toBeInTheDocument();
    expect(within(banner).queryByText('N(')).toBeNull();
  });

  it('member không thấy lối vào trang quản lý', () => {
    mockViewport(1280);
    renderApp(makeMe('member'), '/');
    expect(screen.queryByRole('link', { name: 'Quản lý VPP' })).toBeNull();
  });

  it('/history là trang Lịch sử thật, không còn "Sắp có"', async () => {
    mockViewport(1280);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { items: [], next_cursor: null }))));
    renderApp(makeMe('member'), '/history');
    expect(await screen.findByText('Chưa có phiếu nào')).toBeInTheDocument();
    expect(screen.queryByText('Sắp có')).toBeNull();
  });

  it('390 px: ở /history/:ym mục "Lịch sử" vẫn sáng', () => {
    mockViewport(390);
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderApp(makeMe('member'), '/history/2026-10');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(within(nav).getByRole('link', { name: 'Lịch sử' })).toHaveAttribute('aria-current', 'page');
  });

  it.each([390, 1280])('%i px: chuông thông báo nằm ở thanh trên, thanh dưới vẫn 3 mục', (width) => {
    mockViewport(width);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { items: [], next_cursor: null, unread_count: 3 }))));
    renderApp(makeMe('member'), '/history');
    expect(screen.getByRole('banner')).toContainElement(screen.getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ }));
    if (width === 390) {
      const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
      expect(within(nav).getAllByRole('link')).toHaveLength(2);
      expect(within(nav).getAllByRole('button')).toHaveLength(1);
    }
  });
  it.each([390, 1280])('%i px: mọi <use href> trong khung nhân viên trỏ tới một symbol có thật (nút xóa ô tìm có dấu ×)', async (w) => {
    mockViewport(w);
    stubRequestApi();
    renderApp(makeMe('member'), '/');
    const search = await screen.findByRole('searchbox', { name: 'Tìm món' });
    await userEvent.type(search, 'xyz');
    const uses = [...document.querySelectorAll('use')];
    expect(uses.length).toBeGreaterThan(0);
    const missing = uses.map((u) => u.getAttribute('href') ?? '').filter((href) => !href.startsWith('#') || !document.getElementById(href.slice(1)));
    expect(missing).toEqual([]);
    expect(document.querySelector('.search-clear use')?.getAttribute('href')).toBe('#u-x');
  });
});
