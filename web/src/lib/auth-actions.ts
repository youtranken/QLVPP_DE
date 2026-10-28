import { navigateTo } from '@/lib/navigate';
import { SSO_LOGIN_URL, forgetAuth, rememberAuth } from '@/lib/session-relogin';

export const SWITCH_ACCOUNT_URL = '/api/auth/switch-account';

export function loginWithPmhId(loginHint?: string): void {
  const hint = loginHint?.trim();
  navigateTo(hint ? `${SSO_LOGIN_URL}?login_hint=${encodeURIComponent(hint)}` : SSO_LOGIN_URL);
}

export type SaLoginOutcome = 'ok' | 'invalid' | 'locked' | 'error';

export async function saLogin(username: string, password: string): Promise<SaLoginOutcome> {
  try {
    const res = await fetch('/api/auth/sa-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    if (res.ok) {
      rememberAuth('sa');
      return 'ok';
    }
    if (res.status === 429) return 'locked';
    if (res.status === 401) return 'invalid';
    return 'error';
  } catch {
    return 'error';
  }
}

// Chỉ quên trạng thái đăng nhập khi server đã hủy phiên; 401 nghĩa là phiên đã mất sẵn
export async function logout(csrfToken: string | null): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
    });
    if (!res.ok && res.status !== 401) return false;
  } catch {
    return false;
  }
  forgetAuth();
  navigateTo('/');
  return true;
}

// Bị chặn quyền: phải qua end_session của PMH ID, nếu không phiên SSO còn sống sẽ lặp lại forbidden
export function switchAccount(): void {
  forgetAuth();
  navigateTo(SWITCH_ACCOUNT_URL);
}
