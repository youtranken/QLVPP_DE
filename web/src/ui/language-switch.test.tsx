import { afterEach, describe, expect, it } from 'vitest';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { setLanguage } from '@/lib/i18n';
import { LanguageSwitch } from './language-switch';

afterEach(async () => {
  await setLanguage('vi');
  localStorage.clear();
});

describe('LanguageSwitch', () => {
  it('bấm "EN" → lưu vpp_lang=en, đổi lang của trang', async () => {
    renderWithI18n(<LanguageSwitch short />);
    await userEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(localStorage.getItem('vpp_lang')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(await screen.findByRole('radiogroup', { name: 'Language' })).toBeInTheDocument();
  });

  it('short: chữ VI/EN, aria-label vẫn là tên đầy đủ; không short: tên đầy đủ', () => {
    const { unmount } = renderWithI18n(<LanguageSwitch short />);
    expect(screen.getByRole('radio', { name: 'Tiếng Việt' })).toHaveTextContent(/^VI$/);
    unmount();
    renderWithI18n(<LanguageSwitch />);
    expect(screen.getByRole('radio', { name: 'English' })).toHaveTextContent(/^English$/);
  });
});
