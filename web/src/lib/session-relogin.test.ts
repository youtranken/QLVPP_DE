import { beforeEach, describe, expect, it } from 'vitest';
import {
  EXPIRED_URL,
  RELOGIN_COOLDOWN_MS,
  authMode,
  beginRelogin,
  expiryTarget,
  forgetAuth,
  isSafeReturnTo,
  rememberAuth,
  shouldAutoRelogin,
  ssoLoginUrl,
  switchAccountUrl,
  takeReturnTo,
} from '@/lib/session-relogin';

const SSO_LOGIN_URL = '/api/auth/login?ui_locales=vi';

const T0 = 1_000_000_000_000;

describe('session-relogin — chặn lặp + returnTo', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('chưa từng đăng nhập trong tab → không tự SSO, về màn login', () => {
    expect(shouldAutoRelogin(T0)).toBe(false);
    expect(expiryTarget('/history', T0)).toBe(EXPIRED_URL);
  });

  it('phiên SSO hết hạn → SSO lại 1 lần, nhớ trang đang đứng', () => {
    rememberAuth('sso');
    expect(expiryTarget('/history/12?tab=sw#x', T0)).toBe(SSO_LOGIN_URL);
    expect(takeReturnTo()).toBe('/history/12?tab=sw#x');
    expect(takeReturnTo()).toBeNull();
  });

  it('lần 2 trong vòng 60s → KHÔNG SSO nữa, hiện "hết hạn" + quên chế độ', () => {
    rememberAuth('sso');
    expect(expiryTarget('/a', T0)).toBe(SSO_LOGIN_URL);
    // đăng nhập lại thành công (mode vẫn sso) rồi lại 401 ngay
    rememberAuth('sso');
    expect(expiryTarget('/a', T0 + RELOGIN_COOLDOWN_MS - 1)).toBe(EXPIRED_URL);
    expect(authMode()).toBeNull();
  });

  it('quá 60s kể từ lần thử trước → được tự SSO lại', () => {
    rememberAuth('sso');
    beginRelogin('/a', T0);
    expect(shouldAutoRelogin(T0 + RELOGIN_COOLDOWN_MS)).toBe(true);
  });

  it('mốc thử ở tương lai (lệch đồng hồ) → coi như vừa thử, không lặp', () => {
    rememberAuth('sso');
    beginRelogin('/a', T0 + 5_000);
    expect(shouldAutoRelogin(T0)).toBe(false);
  });

  it('phiên SA local → không bao giờ tự SSO', () => {
    rememberAuth('sa');
    expect(shouldAutoRelogin(T0)).toBe(false);
    expect(expiryTarget('/admin', T0)).toBe(EXPIRED_URL);
  });

  it('đã đăng xuất (forgetAuth) → không tự SSO', () => {
    rememberAuth('sso');
    forgetAuth();
    expect(shouldAutoRelogin(T0)).toBe(false);
  });

  it("trang gốc '/' không cần lưu returnTo", () => {
    rememberAuth('sso');
    beginRelogin('/', T0);
    expect(takeReturnTo()).toBeNull();
  });

  it('returnTo bị sửa tay thành URL ngoài → bị loại', () => {
    sessionStorage.setItem('vpp.auth.returnTo', '//evil.example/x');
    expect(takeReturnTo()).toBeNull();
  });

  it.each([
    ['/history?x=1#h', true],
    ['/', true],
    ['//evil.com', false],
    ['/\\evil.com', false],
    ['https://evil.com/', false],
    ['javascript:alert(1)', false],
    ['history', false],
    ['/api/auth/logout', false],
    ['/a\nb', false],
    ['', false],
  ])('isSafeReturnTo(%j) = %s', (v, ok) => {
    expect(isSafeReturnTo(v)).toBe(ok);
  });
});

describe('ui_locales = ngôn ngữ app đang dùng (docs 7a)', () => {
  beforeEach(() => localStorage.clear());

  it('mặc định vi; vpp_lang=en → en cho cả login, login_hint và switch-account', () => {
    expect(ssoLoginUrl()).toBe('/api/auth/login?ui_locales=vi');
    localStorage.setItem('vpp_lang', 'en');
    expect(ssoLoginUrl()).toBe('/api/auth/login?ui_locales=en');
    expect(ssoLoginUrl(' a@pmh.com.vn ')).toBe('/api/auth/login?login_hint=a%40pmh.com.vn&ui_locales=en');
    expect(switchAccountUrl()).toBe('/api/auth/switch-account?ui_locales=en');
    expect(beginRelogin('/', T0)).toBe('/api/auth/login?ui_locales=en');
  });
});
