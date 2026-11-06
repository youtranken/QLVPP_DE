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
    // 6 người chưa nhận nhưng chỉ 4 giao được ngay; người nợ có hàng cũng giao được ngay
    '/api/admin/periods/2026-10/delivery-people': () =>
      jsonResponse(200, {
        ym: '2026-10',
        people: [
          ...Array.from({ length: 6 }, (_, i) => ({ user_sub: `p${i}`, status: 'pending', has_pending: true, deliverable_now: i < 3 })),
          { user_sub: 'd1', status: 'debt', has_debt: true, deliverable_now: true },
          { user_sub: 'd2', status: 'done', deliverable_now: false },
        ],
      }),
    // 2 món thiếu cho người chờ, 3 "Không có", 1 sắp hết, 1 chờ hàng về → badge 2
    '/api/admin/stock': () =>
      jsonResponse(200, [
        { item_id: 'i1', short: 3, stock_state: 'short' },
        { item_id: 'i2', short: 1, stock_state: 'short' },
        { item_id: 'i3', short: 0, stock_state: 'none' },
        { item_id: 'i4', short: 0, stock_state: 'none' },
        { item_id: 'i5', short: 0, stock_state: 'none' },
        { item_id: 'i6', short: 0, stock_state: 'low' },
        { item_id: 'i7', short: 0, stock_state: 'incoming' },
      ]),
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
  it('đếm review = số dòng chờ, giao hàng = số người giao được ngay (deliverable_now) của kỳ khóa gần nhất, Tủ/Kho = số món thiếu cho người chờ (short > 0)', async () => {
    const f = stubApi();
    const { result } = renderHook(() => useAdminBadges(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current).toEqual({ review: 3, delivery: 4, stock: 2 }));
    expect(calls(f, '/api/admin/periods/2026-10/delivery-people')).toBe(1);
  });

  it('API trả 0 dòng → đếm 0 (nơi hiển thị ẩn)', async () => {
    stubApi({
      '/api/admin/review?status=pending': () => jsonResponse(200, { items: [] }),
      '/api/admin/periods/2026-10/delivery-people': () => jsonResponse(200, { ym: '2026-10', people: [{ user_sub: 'a', status: 'debt' }] }),
      '/api/admin/stock': () => jsonResponse(200, [{ item_id: 'i1', short: 0, stock_state: 'incoming' }]),
    });
    const { result } = renderHook(() => useAdminBadges(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current).toEqual({ review: 0, delivery: 0, stock: 0 }));
  });

  it('ngay sau khóa sổ, tủ trống cho mọi món của 3 người chưa nhận → giao hàng 0 (không đếm theo Chưa nhận)', async () => {
    stubApi({
      '/api/admin/periods/2026-10/delivery-people': () =>
        jsonResponse(200, { ym: '2026-10', people: ['a', 'b', 'c'].map((s) => ({ user_sub: s, status: 'pending', has_pending: true, deliverable_now: false })) }),
    });
    const { result } = renderHook(() => useAdminBadges(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.review).toBe(3));
    await waitFor(() => expect(result.current.delivery).toBe(0));
  });

  it('kỳ chưa khóa (409 PERIOD_NOT_LOCKED) → delivery undefined, không ném', async () => {
    stubApi({ '/api/admin/periods/2026-10/delivery-people': () => jsonResponse(409, { code: 'PERIOD_NOT_LOCKED' }) });
    const { result } = renderHook(() => useAdminBadges(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.review).toBe(3));
    await waitFor(() => expect(result.current.delivery).toBeUndefined());
  });

  it('lỗi tải → không có đếm (undefined), không ném', async () => {
    const f = stubApi({
      '/api/admin/review?status=pending': () => jsonResponse(500, null),
      '/api/periods/current': () => jsonResponse(500, null),
      '/api/admin/stock': () => jsonResponse(403, { code: 'FORBIDDEN_ROLE' }),
    });
    const { result } = renderHook(() => useAdminBadges(), { wrapper: wrapper() });
    await waitFor(() => expect(calls(f, '/api/admin/stock')).toBe(1));
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
    expect(calls(f, '/api/admin/stock')).toBe(2);
    focusManager.setFocused(undefined);
  });
});
