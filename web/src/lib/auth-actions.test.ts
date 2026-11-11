import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/navigate', () => ({ navigateTo: vi.fn() }));

import { queryClient } from '@/lib/api-client';
import { logout } from '@/lib/auth-actions';
import { navigateTo } from '@/lib/navigate';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  queryClient.clear();
});

describe('logout (B0.21)', () => {
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
