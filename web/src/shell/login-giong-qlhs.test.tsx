import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { LoginScreen } from '@/shell/login-screen';
import { renderWithI18n, screen, within } from '@/test/test-utils';

// Trang đăng nhập thống nhất với QLHS/QLTS/Tài khoản D&E (chủ dự án 15/11)
describe('đăng nhập giống QLHS', () => {
  afterEach(() => i18n.changeLanguage('vi'));

  it('chân trang: trái "Phát triển bởi IT Department", phải bản quyền; không còn dòng "Cần hỗ trợ"', () => {
    renderWithI18n(<LoginScreen />);
    const spans = within(screen.getByRole('contentinfo')).getAllByText(/./, { selector: 'span' });
    expect(spans.map((s) => s.textContent)).toEqual([
      'Phát triển bởi IT Department',
      `© ${new Date().getFullYear()} Phú Mỹ Hưng · Division D&E`,
    ]);
  });

  it('EN: chân trang "Developed by IT Department" / "© năm Phu My Hung · Division D&E", không "Need help"', async () => {
    await i18n.changeLanguage('en');
    renderWithI18n(<LoginScreen />);
    const foot = screen.getByRole('contentinfo');
    expect(foot).toHaveTextContent(`Developed by IT Department© ${new Date().getFullYear()} Phu My Hung · Division D&E`);
    expect(screen.queryByText(/Need help/)).toBeNull();
  });

  it('câu phụ và nút bước Email theo QLHS (vi/en)', async () => {
    renderWithI18n(<LoginScreen />);
    expect(screen.getByText('Đăng nhập để bắt đầu — nhập email của bạn.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeInTheDocument();
    await i18n.changeLanguage('en');
    expect(await screen.findByText('Sign in to get started — enter your email.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('dòng tên app cùng khuôn QLHS: icon VPP + "QLVPP — Quản lý văn phòng phẩm" (en: Office supplies management)', async () => {
    const { container } = renderWithI18n(<LoginScreen />);
    const name = container.querySelector('.auth-panel-name') as HTMLElement;
    expect(name).toHaveTextContent('QLVPP — Quản lý văn phòng phẩm');
    const icon = name.querySelector('img') as HTMLImageElement;
    expect(icon).toHaveAttribute('src', '/vpp.png');
    expect(icon).toHaveAttribute('alt', '');
    await i18n.changeLanguage('en');
    expect(await screen.findByText('QLVPP — Office supplies management')).toBeInTheDocument();
  });

  it('tab trình duyệt: tiêu đề "QLVPP", icon VPP (favicon + apple-touch-icon) có trong public/', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).toMatch(/<title>QLVPP<\/title>/);
    expect(html).toMatch(/<link rel="icon" type="image\/png" sizes="64x64" href="\/favicon.png" \/>/);
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/apple-touch-icon.png" \/>/);
    for (const f of ['favicon.png', 'apple-touch-icon.png', 'vpp.png']) {
      expect(existsSync(resolve(process.cwd(), 'public', f))).toBe(true);
    }
    expect(i18n.t('app.shortName')).toBe('QLVPP');
  });

  it('logo PMH ở trên, tên app ngay dưới', () => {
    renderWithI18n(<LoginScreen />);
    const head = screen.getByRole('banner');
    const logo = within(head).getByRole('img', { name: 'Phú Mỹ Hưng' });
    const name = within(head).getByText('QLVPP — Quản lý văn phòng phẩm');
    expect(logo.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('CSS: tiêu đề card 21px/700; chân trang hai bên, màn hẹp xuống hai dòng', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/login.css'), 'utf8');
    expect(css).toMatch(/\.auth-card h1 \{[^}]*font-size: 21px;[^}]*font-weight: 700;/);
    expect(css).toMatch(/\.auth-panel-foot \{[^}]*justify-content: space-between;[^}]*flex-wrap: wrap;/);
    expect(css).not.toMatch(/auth-panel-foot__help/);
    // Ô ngôn ngữ đang chọn tô màu nhấn, chữ trắng như QLHS; vẫn đủ 44px để chạm
    expect(css).toMatch(/\.auth-card__head \.seg button\[aria-checked='true'\] \{[^}]*background: var\(--c-acc\);[^}]*color: var\(--c-on-acc\);/);
    expect(css).toMatch(/\.auth-card__head \.seg button \{[^}]*height: 44px;/);
  });

  it('EN: màn không có quyền theo câu QLHS', async () => {
    window.history.replaceState(null, '', '/?login=forbidden');
    await i18n.changeLanguage('en');
    renderWithI18n(<LoginScreen />);
    expect(screen.getByRole('heading', { name: 'No access' })).toBeInTheDocument();
    expect(
      await screen.findByText('Your account does not have access to QLVPP. Contact D&E Admin to be granted access.'),
    ).toBeInTheDocument();
    window.history.replaceState(null, '', '/');
  });
});
