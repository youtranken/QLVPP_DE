import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderHook, waitFor } from '@/test/test-utils';
import { useDirectoryNames, usePersonName } from './use-all-users';

afterEach(() => vi.unstubAllGlobals());

function stubDirectory(total: number) {
  const fetchMock = vi.fn((url: string) => {
    const cursor = new URL(url, 'http://x').searchParams.get('cursor');
    const from = cursor ? Number(cursor) : 0;
    const to = Math.min(from + 200, total);
    const items = Array.from({ length: to - from }, (_, i) => ({ sub: `u${from + i}`, fullName: i === 0 && from === 0 ? null : `Người ${from + i}`, email: null, department: null, status: 'active', employeeCode: null, team: null, role: 'member', lastLoginAt: null }));
    return Promise.resolve(jsonResponse(200, { items, next_cursor: to < total ? String(to) : null }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const render = () => renderHook(() => useDirectoryNames(), { wrapper: wrapper() });
const renderPerson = () => renderHook(() => usePersonName(), { wrapper: wrapper() });

describe('useDirectoryNames', () => {
  it('đi hết các trang, tên theo sub (không tên → sub)', async () => {
    stubDirectory(201);
    const { result } = render();
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.get('u0')).toBe('u0');
    expect(result.current.data?.get('u200')).toBe('Người 200');
    expect(result.current.data?.size).toBe(201);
  });

  it('danh bạ 2001 người → dừng ở trang 11 (ngưỡng 2000), không tải vô hạn; tên rơi về sub', async () => {
    const fetchMock = stubDirectory(2001);
    const { result } = render();
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(fetchMock).toHaveBeenCalledTimes(11);
    expect(result.current.data?.size).toBe(0);
  });
});

describe('usePersonName', () => {
  it('đang tải danh bạ → dấu chờ, không vội gọi "Người dùng cũ"; tải xong: có tên → tên, không có → "Người dùng cũ"; system… → Hệ thống', async () => {
    stubDirectory(3);
    const { result } = renderPerson();
    expect(result.current('u-di')).toBe('…');
    await waitFor(() => expect(result.current('u1')).toBe('Người 1'));
    expect(result.current('u-di')).toBe('Người dùng cũ');
    expect(result.current('system:cron')).toBe('Hệ thống (tự động)');
  });

  it('danh bạ quá lớn (không tải hết) → hiện sub, không gán "Người dùng cũ"', async () => {
    stubDirectory(2001);
    const { result } = renderPerson();
    await waitFor(() => expect(result.current('u-di')).toBe('u-di'));
  });
});
