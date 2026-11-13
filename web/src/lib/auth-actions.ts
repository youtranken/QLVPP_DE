import { queryClient } from '@/lib/api-client';
import { currentLanguage } from '@/lib/lang-pref';
import { navigateTo } from '@/lib/navigate';
import { beginLogout, endLogout, forgetAuth, rememberAuth, ssoLoginUrl, switchAccountUrl } from '@/lib/session-relogin';

export function loginWithPmhId(loginHint?: string): void {
  navigateTo(ssoLoginUrl(loginHint));
}

export type SaLoginOutcome = 'ok' | 'invalid' | 'locked' | 'error';

export type IdentifyOutcome = 'password' | 'invalid' | 'error';

// Chữ không phải email: chỉ server biết tên tài khoản nội bộ (SA) — web không giữ, public-config không trả
export async function identifyLogin(identifier: string): Promise<IdentifyOutcome> {
  try {
    const res = await fetch('/api/auth/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: identifier.trim() }),
    });
    if (!res.ok) return 'error';
    const body = (await res.json()) as { next?: unknown };
    return body.next === 'password' || body.next === 'invalid' ? body.next : 'error';
  } catch {
    return 'error';
  }
}

// Đăng nhập không qua SSO (SA, tài khoản thử dev): mode 'sa' = hết phiên thì về màn đăng nhập, không tự SSO lại
async function postLocalLogin(url: string, username: string, password: string): Promise<SaLoginOutcome> {
  try {
    const res = await fetch(url, {
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

export function saLogin(username: string, password: string): Promise<SaLoginOutcome> {
  return postLocalLogin('/api/auth/sa-login', username, password);
}

// Tài khoản thử — chỉ bản dev (api trả 404 khi tắt)
export function testAccountLogin(username: string, password: string): Promise<SaLoginOutcome> {
  return postLocalLogin('/api/auth/test-login', username, password);
}

// Chỉ nhận URL end_session tuyệt đối http(s) do server dựng; thứ khác → về trang đầu
async function endSessionUrl(res: Response): Promise<string | null> {
  if (!res.ok) return null;
  try {
    const body = (await res.json()) as { redirectTo?: unknown };
    const url = typeof body.redirectTo === 'string' ? new URL(body.redirectTo) : null;
    return url && (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : null;
  } catch {
    return null;
  }
}

// "Đăng xuất" thoát cả PMH ID: server xóa phiên app rồi trả URL end_session (phiên SSO); SA cục bộ → null, về trang đầu.
// Chỉ quên trạng thái đăng nhập khi server đã hủy phiên; 401 nghĩa là phiên đã mất sẵn
export async function logout(csrfToken: string | null): Promise<boolean> {
  // Bật cờ trước khi gọi server: 401 của truy vấn đang bay (fetch không hủy được) không được kéo sang trang hết phiên / SSO lại
  beginLogout();
  let target: string | null = null;
  try {
    const res = await fetch(`/api/auth/logout?ui_locales=${currentLanguage()}`, {
      method: 'POST',
      headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
    });
    if (!res.ok && res.status !== 401) {
      endLogout();
      return false;
    }
    target = await endSessionUrl(res);
  } catch {
    endLogout();
    return false;
  }
  // Dọn cache ở một chỗ; truy vấn còn gắn trên màn không gửi lại request vì cờ đăng xuất (api-client)
  await queryClient.cancelQueries();
  queryClient.clear();
  forgetAuth();
  navigateTo(target ?? '/');
  return true;
}

// Bị chặn quyền: phải qua end_session của PMH ID, nếu không phiên SSO còn sống sẽ lặp lại forbidden
export function switchAccount(): void {
  forgetAuth();
  navigateTo(switchAccountUrl());
}
