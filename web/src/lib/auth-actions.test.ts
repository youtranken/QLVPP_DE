import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/navigate', () => ({ navigateTo: vi.fn() }));

import { apiFetch, queryClient } from '@/lib/api-client';
import { logout } from '@/lib/auth-actions';
import { navigateTo } from '@/lib/navigate';
import { endLogout, handleSessionExpired, rememberAuth } from '@/lib/session-relogin';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(navigateTo).mockClear();
  queryClient.clear();
  endLogout();
  window.sessionStorage.clear();
});

describe('logout', () => {
  it('server hủy phiên → hủy truy vấn đang chạy + xóa cache rồi mới về trang đầu', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    queryClient.setQueryData(['notifications', 'unread'], { unread_count: 3 });
    const cancel = vi.spyOn(queryClient, 'cancelQueries');
    expect(await logout('csrf')).toBe(true);
    expect(cancel).toHaveBeenCalled();
    expect(queryClient.getQueryData(['notifications', 'unread'])).toBeUndefined();
    expect(navigateTo).toHaveBeenCalledWith('/');
  });

  it('server lỗi → giữ cache, không điều hướng', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })));
    queryClient.setQueryData(['notifications', 'unread'], { unread_count: 3 });
    expect(await logout('csrf')).toBe(false);
    expect(queryClient.getQueryData(['notifications', 'unread'])).toEqual({ unread_count: 3 });
  });
});

// "Đăng xuất" thoát cả PMH ID: server xóa phiên app rồi trả URL end_session, web chuyển sang đó
describe('logout → end_session PMH ID', () => {
  const END = 'https://dev-admin.pmh.com.vn:8443/oidc/logout?id_token_hint=t&post_logout_redirect_uri=https%3A%2F%2Fdev-vpp.pmh.com.vn%3A8443';
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('server trả redirectTo → chuyển sang PMH ID (gửi CSRF + ui_locales ngôn ngữ đang dùng), không về /', async () => {
    const fetchMock = vi.fn(async () => json(200, { ok: true, redirectTo: END }));
    vi.stubGlobal('fetch', fetchMock);
    rememberAuth('sso');
    expect(await logout('csrf-1')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout?ui_locales=vi', { method: 'POST', headers: { 'X-CSRF-Token': 'csrf-1' } });
    expect(vi.mocked(navigateTo).mock.calls).toEqual([[END]]);
    expect(window.sessionStorage.getItem('vpp.auth.mode')).toBeNull();
  });

  it('redirectTo null (SA cục bộ, tài khoản thử) → về /', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { ok: true, redirectTo: null })));
    expect(await logout('csrf')).toBe(true);
    expect(vi.mocked(navigateTo).mock.calls).toEqual([['/']]);
  });

  it('redirectTo không phải URL http(s) → về /, không điều hướng lạ', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { ok: true, redirectTo: 'javascript:alert(1)' })));
    expect(await logout('csrf')).toBe(true);
    expect(vi.mocked(navigateTo).mock.calls).toEqual([['/']]);
  });

  it('401 (phiên đã mất sẵn) → về /', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(401, { code: 'UNAUTHENTICATED' })));
    expect(await logout('csrf')).toBe(true);
    expect(vi.mocked(navigateTo).mock.calls).toEqual([['/']]);
  });
});

describe('logout: 401 muộn không kéo sang trang hết phiên / SSO lại', () => {
  it('truy vấn đang bay trả 401 SAU khi đăng xuất → không gọi luồng hết phiên, chỉ về trang đầu', async () => {
    rememberAuth('sso');
    let late: (r: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.startsWith('/api/auth/logout')
          ? Promise.resolve(new Response(null, { status: 204 }))
          : new Promise<Response>((res) => {
              late = res;
            }),
      ),
    );
    const inflight = apiFetch('/api/me/notifications?unread=true&limit=1').catch((e: unknown) => e);
    expect(await logout('csrf')).toBe(true);
    late(new Response(null, { status: 401 }));
    await inflight;
    expect(vi.mocked(navigateTo).mock.calls).toEqual([['/']]);
  });

  it('trong lúc đăng xuất: truy vấn chạy lại không gửi request (không ai refetch sau clear)', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await logout('csrf')).toBe(true);
    await expect(apiFetch('/api/me/notifications')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('server từ chối đăng xuất → bỏ cờ, 401 sau đó vẫn đi luồng hết phiên', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })));
    expect(await logout('csrf')).toBe(false);
    handleSessionExpired();
    expect(navigateTo).toHaveBeenCalledWith('/?session=expired');
  });
});
