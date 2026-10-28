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

// Chủ động đăng xuất → tab này không bao giờ tự SSO lại; lỗi mạng vẫn về / để trang phản ánh phiên thật
export async function logout(csrfToken: string | null): Promise<void> {
  forgetAuth();
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
    });
  } catch {
    // vẫn về / bên dưới
  }
  navigateTo('/');
}

// Bị chặn quyền: phải qua end_session của PMH ID, nếu không phiên SSO còn sống sẽ lặp lại forbidden
export function switchAccount(): void {
  forgetAuth();
  navigateTo(SWITCH_ACCOUNT_URL);
}
