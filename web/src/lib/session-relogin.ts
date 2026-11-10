// Phiên SSO PMH ID thường còn sống khi phiên VPP hết → tự SSO lại tối đa 1 lần/60 s (trừ SA/đã đăng xuất)
import { currentLanguage } from '@/lib/lang-pref';
import { navigateTo } from '@/lib/navigate';

export const SSO_LOGIN_URL = '/api/auth/login';
export const SWITCH_ACCOUNT_URL = '/api/auth/switch-account';

// Luôn kèm `ui_locales` = ngôn ngữ app đang dùng (docs 7a) — PMH ID chỉ dùng để HIỂN THỊ trang của
// nó, không ghi vào tài khoản
function withUiLocales(base: string, params = new URLSearchParams()): string {
  params.set('ui_locales', currentLanguage());
  return `${base}?${params.toString()}`;
}

// URL bắt đầu SSO PMH ID (kèm login_hint nếu có)
export function ssoLoginUrl(loginHint?: string): string {
  const hint = loginHint?.trim();
  return withUiLocales(SSO_LOGIN_URL, new URLSearchParams(hint ? { login_hint: hint } : {}));
}

// "Đăng nhập bằng tài khoản khác" — end_session PMH ID cùng ngôn ngữ app
export function switchAccountUrl(): string {
  return withUiLocales(SWITCH_ACCOUNT_URL);
}
export const EXPIRED_URL = '/?session=expired';
export const RELOGIN_COOLDOWN_MS = 60_000;

const MODE_KEY = 'vpp.auth.mode';
const ATTEMPT_KEY = 'vpp.auth.reloginAt';
const RETURN_KEY = 'vpp.auth.returnTo';

export type AuthMode = 'sso' | 'sa';

function get(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // storage bị chặn → không auto re-login, về màn đăng nhập
  }
}
function del(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // bỏ qua
  }
}

export function rememberAuth(mode: AuthMode): void {
  set(MODE_KEY, mode);
}

export function authMode(): AuthMode | null {
  const v = get(MODE_KEY);
  return v === 'sso' || v === 'sa' ? v : null;
}

export function forgetAuth(): void {
  del(MODE_KEY);
  del(RETURN_KEY);
}

// Chỉ đường dẫn tương đối cùng origin; chặn '//host', '/\host', '/api/...'
export function isSafeReturnTo(v: unknown): v is string {
  if (typeof v !== 'string' || v.length === 0 || v.length > 2048) return false;
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('\\')) return false;
  if ([...v].some((c) => c.charCodeAt(0) < 0x20)) return false;
  try {
    const u = new URL(v, window.location.origin);
    if (u.origin !== window.location.origin) return false;
    return !u.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

export function shouldAutoRelogin(now = Date.now()): boolean {
  if (authMode() !== 'sso') return false;
  const at = Number(get(ATTEMPT_KEY));
  // Mốc ở tương lai (lệch đồng hồ) cũng tính là "vừa thử" để không lặp
  if (Number.isFinite(at) && at > 0 && now - at < RELOGIN_COOLDOWN_MS) return false;
  return true;
}

export function beginRelogin(currentPath: string, now = Date.now()): string {
  set(ATTEMPT_KEY, String(now));
  if (isSafeReturnTo(currentPath) && currentPath !== '/') set(RETURN_KEY, currentPath);
  else del(RETURN_KEY);
  return ssoLoginUrl();
}

export function expiryTarget(currentPath: string, now = Date.now()): string {
  if (shouldAutoRelogin(now)) return beginRelogin(currentPath, now);
  forgetAuth();
  return EXPIRED_URL;
}

export function takeReturnTo(): string | null {
  const v = get(RETURN_KEY);
  del(RETURN_KEY);
  return isSafeReturnTo(v) ? v : null;
}

// Nhiều request cùng 401 (hoặc effect chạy 2 lần ở StrictMode) → chỉ lần đầu quyết định;
// lần sau thấy mốc "vừa thử" sẽ tưởng đã lặp và đá về màn đăng nhập.
let redirecting = false;

export function isRedirecting(): boolean {
  return redirecting;
}

export function startRelogin(): void {
  redirecting = true;
  const { pathname, search, hash } = window.location;
  navigateTo(beginRelogin(pathname + search + hash));
}

export function handleSessionExpired(): void {
  if (redirecting) return;
  redirecting = true;
  const { pathname, search, hash } = window.location;
  navigateTo(expiryTarget(pathname + search + hash));
}
