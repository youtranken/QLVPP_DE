import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { jsonResponse } from '@/test/test-utils';
import { useAdminBadges } from '@/shell/use-admin-badges';

const PERIOD = { ym: '2026-11', deadline: '2026-11-10T17:00:00.000Z', is_open: true, days_left: 4, previous: null };

type Route = () => Response;

function stubApi(over: Record<string, Route> = {}) {
  const routes: Record<string, Route> = {
    '/api/periods/current': () => jsonResponse(200, PERIOD),
    '/api/admin/review?status=pending': () => jsonResponse(200, { items: [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }] }),
    '/api/admin/periods/2026-10/summary': () => jsonResponse(200, { lines_pending_delivery: 6 }),
    '/api/admin/stock/low': () => jsonResponse(200, [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }, { id: 'i4' }]),
    ...over,
  };
  const f = vi.fn((url: string) => Promise.resolve((routes[String(url)] ?? (() => jsonResponse(500, null)))()));
  vi.stubGlobal('fetch', f);
  return f;
}

// Giống makeQueryClient của app (không tự tải lại khi focus) để chứng minh hook tự bật lại cho đếm
function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 10_000, refetchOnWindowFocus: false } } });
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
}

const calls = (f: ReturnType<typeof stubApi>, url: string) => f.mock.calls.filter(([u]) => u === url).length;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useAdminBadges', () => {
  it('đếm review = số dòng chờ, giao hàng = lines_pending_delivery của kỳ khóa gần nhất, kho = số món sắp hết', async () => {
    const f = stubApi();
    const { result } = renderHook(() => useAdminBadges(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current).toEqual({ review: 3, delivery: 6, stock: 4 }));
    expect(calls(f, '/api/admin/periods/2026-10/summary')).toBe(1);
  });

  it('API trả 0 dòng → đếm 0 (nơi hiển thị ẩn)', async () => {
    stubApi({
      '/api/admin/review?status=pending': () => jsonResponse(200, { items: [] }),
      '/api/admin/periods/2026-10/summary': () => jsonResponse(200, { lines_pending_delivery: 0 }),
      '/api/admin/stock/low': () => jsonResponse(200, []),
    });
    const { result } = renderHook(() => useAdminBadges(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current).toEqual({ review: 0, delivery: 0, stock: 0 }));
  });

  it('lỗi tải → không có đếm (undefined), không ném', async () => {
    const f = stubApi({
      '/api/admin/review?status=pending': () => jsonResponse(500, null),
      '/api/periods/current': () => jsonResponse(500, null),
      '/api/admin/stock/low': () => jsonResponse(403, { code: 'FORBIDDEN_ROLE' }),
    });
    const { result } = renderHook(() => useAdminBadges(), { wrapper: wrapper() });
    await waitFor(() => expect(calls(f, '/api/admin/stock/low')).toBe(1));
    await waitFor(() => expect(result.current).toEqual({ review: undefined, delivery: undefined, stock: undefined }));
  });

  it('staleTime 60 s: focus lúc 59 999 ms không tải lại, lúc 60 000 ms tải lại', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-03T08:00:00.000Z') });
    const f = stubApi();
    const { result } = renderHook(() => useAdminBadges(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.review).toBe(3));
    const t0 = Date.now();
    const focus = () =>
      act(() => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      });

    vi.setSystemTime(t0 + 59_999);
    focus();
    expect(calls(f, '/api/admin/review?status=pending')).toBe(1);

    vi.setSystemTime(t0 + 60_000);
    focus();
    await waitFor(() => expect(calls(f, '/api/admin/review?status=pending')).toBe(2));
    expect(calls(f, '/api/admin/stock/low')).toBe(2);
    focusManager.setFocused(undefined);
  });
});
