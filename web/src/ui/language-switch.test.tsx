import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { applySignedInLanguage, resetLanguageStateForTest, setLanguage } from '@/lib/i18n';
import { LanguageSwitch } from './language-switch';

afterEach(async () => {
  resetLanguageStateForTest();
  vi.unstubAllGlobals();
  await setLanguage('vi');
  localStorage.clear();
  sessionStorage.clear();
});

describe('LanguageSwitch', () => {
  it('bấm "EN" → lưu vpp_lang=en, đổi lang của trang', async () => {
    renderWithI18n(<LanguageSwitch short />);
    await userEvent.click(screen.getByRole('radio', { name: 'EN – English' }));
    expect(localStorage.getItem('vpp_lang')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(await screen.findByRole('radiogroup', { name: 'Language' })).toBeInTheDocument();
  });

  it('short: chữ VI/EN, tên truy cập bắt đầu bằng chữ đang hiện rồi tên đầy đủ; không short: tên đầy đủ', () => {
    const { unmount } = renderWithI18n(<LanguageSwitch short />);
    expect(screen.getByRole('radio', { name: 'VI – Tiếng Việt' })).toHaveTextContent(/^VI$/);
    expect(screen.getByRole('radio', { name: 'EN – English' })).toHaveTextContent(/^EN$/);
    unmount();
    renderWithI18n(<LanguageSwitch />);
    expect(screen.getByRole('radio', { name: 'English' })).toHaveTextContent(/^English$/);
  });

  it('phiên SSO: bấm "EN" → giao diện đổi ngay + gọi PUT /api/auth/me/locale {locale:"en"}', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('{"locale":"en","saved":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchFn);
    await applySignedInLanguage({ locale: 'vi', localeUpdatedAt: null, csrfToken: 'c1', serverTime: Date.now() });
    renderWithI18n(<LanguageSwitch short />);
    await userEvent.click(screen.getByRole('radio', { name: 'VI – Tiếng Việt' }));
    await userEvent.click(screen.getByRole('radio', { name: 'EN – English' }));
    expect(document.documentElement.lang).toBe('en');
    const puts = fetchFn.mock.calls.filter(([url]) => url === '/api/auth/me/locale');
    expect(puts).toHaveLength(2);
    expect(JSON.parse(String((puts[1][1] as RequestInit).body))).toMatchObject({ locale: 'en', seq: 2 });
  });
});
