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

describe('logout: 401 muộn không kéo sang trang hết phiên / SSO lại', () => {
  it('truy vấn đang bay trả 401 SAU khi đăng xuất → không gọi luồng hết phiên, chỉ về trang đầu', async () => {
    rememberAuth('sso');
    let late: (r: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url === '/api/auth/logout'
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
