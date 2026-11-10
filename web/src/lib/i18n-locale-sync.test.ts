import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n, { applySignedInLanguage, resetLanguageStateForTest, setLanguage } from '@/lib/i18n';
import { resetMemoryForTest } from '@/lib/lang-pref';

type Call = { url: string; body: Record<string, unknown>; headers: Record<string, string> };
let calls: Call[];

function stubSaveApi(response: unknown = { locale: 'en', saved: true }) {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({
        url,
        body: JSON.parse(String(init.body)) as Record<string, unknown>,
        headers: init.headers as Record<string, string>,
      });
      return Promise.resolve(new Response(JSON.stringify(response), { status: 200 }));
    }),
  );
}

const NOW = 1_762_000_000_000;
const sso = (over: Record<string, unknown> = {}) => ({
  locale: 'vi',
  localeUpdatedAt: null,
  csrfToken: 'csrf-1',
  serverTime: NOW,
  ...over,
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  sessionStorage.clear();
  resetMemoryForTest();
  resetLanguageStateForTest();
  await i18n.changeLanguage('vi');
  stubSaveApi();
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetLanguageStateForTest();
  sessionStorage.clear();
  localStorage.clear();
  await i18n.changeLanguage('vi');
});

describe('ngôn ngữ theo tài khoản PMH ID (docs 7a)', () => {
  it('đăng nhập với claim en → app hiện EN, không gọi API', async () => {
    await applySignedInLanguage(sso({ locale: 'en' }));
    expect(i18n.language).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(calls).toHaveLength(0);
  });

  it('claim lạ → VI', async () => {
    localStorage.setItem('vpp_lang', 'en');
    await applySignedInLanguage(sso({ locale: 'fr' }));
    expect(i18n.language).toBe('vi');
  });

  it('đổi trong app (phiên SSO) → đổi NGAY + PUT /api/auth/me/locale kèm CSRF và {page, seq} tăng dần', async () => {
    await applySignedInLanguage(sso());
    const p = setLanguage('en');
    expect(i18n.language).toBe('en');
    await p;
    await setLanguage('vi');
    expect(calls.map((c) => c.url)).toEqual(['/api/auth/me/locale', '/api/auth/me/locale']);
    expect(calls[0].headers['X-CSRF-Token']).toBe('csrf-1');
    expect(calls[0].body).toMatchObject({ locale: 'en', seq: 1 });
    expect(calls[1].body).toMatchObject({ locale: 'vi', seq: 2, page: calls[0].body.page });
  });

  it('API lỗi (saved:false) → giao diện vẫn giữ lựa chọn; /me xử lý lại trong trang không nhảy về claim cũ', async () => {
    stubSaveApi({ locale: 'en', saved: false, reason: 'rate_limited' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await applySignedInLanguage(sso({ locale: 'vi' }));
    await setLanguage('en');
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    await applySignedInLanguage(sso({ locale: 'vi' }));
    expect(i18n.language).toBe('en');
    warn.mockRestore();
  });

  it('SA local / dev (locale null) → đổi tại chỗ, không gọi IdP, giữ ngôn ngữ trình duyệt', async () => {
    localStorage.setItem('vpp_lang', 'en');
    await i18n.changeLanguage('en');
    await applySignedInLanguage(sso({ locale: null }));
    expect(i18n.language).toBe('en');
    await setLanguage('vi');
    expect(i18n.language).toBe('vi');
    expect(calls).toHaveLength(0);
  });

  describe('chọn ở màn đăng nhập rồi đăng nhập', () => {
    it('chọn EN, claim vi chưa từng đặt (null) → dùng EN và lưu vào PMH ID; xoá lựa chọn chờ', async () => {
      await setLanguage('en'); // chưa đăng nhập → lựa chọn chờ
      expect(calls).toHaveLength(0);
      await applySignedInLanguage(sso({ locale: 'vi', localeUpdatedAt: null }));
      expect(i18n.language).toBe('en');
      expect(calls.map((c) => c.body.locale)).toEqual(['en']);
      expect(sessionStorage.getItem('vpp_lang_pending')).toBeNull();
    });

    it('chọn EN rồi bấm VI ở PMH ID (locale_updated_at ≥ pendingAt) → dùng claim VI, không gọi API', async () => {
      await setLanguage('en');
      await applySignedInLanguage(sso({ locale: 'vi', localeUpdatedAt: Math.floor(NOW / 1000) + 5 }));
      expect(i18n.language).toBe('vi');
      expect(calls).toHaveLength(0);
      expect(sessionStorage.getItem('vpp_lang_pending')).toBeNull();
    });

    it('PMH ID đặt trước lúc chọn (locale_updated_at < pendingAt) → lựa chọn của app thắng', async () => {
      await setLanguage('en');
      await applySignedInLanguage(sso({ locale: 'vi', localeUpdatedAt: Math.floor(NOW / 1000) - 60 }));
      expect(i18n.language).toBe('en');
      expect(calls.map((c) => c.body.locale)).toEqual(['en']);
    });

    it('so theo GIỜ MÁY CHỦ: máy người dùng chậm 5 phút — PMH ID đặt sau lúc chọn (giờ máy chủ) thì PMH ID thắng', async () => {
      await setLanguage('en'); // máy: NOW; máy chủ: NOW + 300 s
      const serverNowSec = Math.floor(NOW / 1000) + 300;
      await applySignedInLanguage(sso({ locale: 'vi', localeUpdatedAt: serverNowSec + 1, serverTime: NOW + 300_000 }));
      expect(i18n.language).toBe('vi');
      expect(calls).toHaveLength(0);
    });

    it('lựa chọn chờ trùng claim → không gọi API, vẫn xoá', async () => {
      await setLanguage('en');
      await applySignedInLanguage(sso({ locale: 'en', localeUpdatedAt: null }));
      expect(i18n.language).toBe('en');
      expect(calls).toHaveLength(0);
      expect(sessionStorage.getItem('vpp_lang_pending')).toBeNull();
    });
  });
});
