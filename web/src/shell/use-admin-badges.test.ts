import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { jsonResponse } from '@/test/test-utils';
import { useAdminBadges } from '@/shell/use-admin-badges';

const PERIOD = { ym: '2026-11', deadline: '2026-11-10T17:00:00.000Z', is_open: true, days_left: 4, previous: null, owed: [] };

type Route = () => Response;

function stubApi(over: Record<string, Route> = {}) {
  const routes: Record<string, Route> = {
    '/api/periods/current': () => jsonResponse(200, PERIOD),
    // Kỳ 9: An 2 món + Bình 1 món chờ duyệt; kỳ 10: Chi 1 món → số 2 (người có món chờ ở kỳ cũ nhất), link kỳ 9
    '/api/admin/review?status=pending': () =>
      jsonResponse(200, { items: [{ line_id: 'l1', period_ym: '2026-09', user_sub: 'an' }, { line_id: 'l2', period_ym: '2026-09', user_sub: 'an' }, { line_id: 'l3', period_ym: '2026-09', user_sub: 'binh' }, { line_id: 'l4', period_ym: '2026-10', user_sub: 'chi' }] }),
    // Thẻ "Chưa nhận" của trang Giao hàng: 6 người chưa nhận + 1 người chỉ còn nợ = 7; người đã nhận đủ không tính
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
  it('Kỳ tháng = số người có món chờ duyệt ở kỳ cũ nhất (= chip "Có món chờ duyệt" của kỳ đó), link mở kỳ đó với chip bật; Giao hàng = số "Chưa nhận" trên trang; Tủ/Kho = số món thiếu', async () => {
    const f = stubApi();
    const { result } = renderHook(() => useAdminBadges(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current).toEqual({ review: 2, delivery: 7, stock: 2, links: { review: '/admin/month?ym=2026-09&chip=pending' } }));
    expect(calls(f, '/api/admin/periods/2026-10/delivery-people')).toBe(1);
  });

  it('API trả 0 dòng → đếm 0 (nơi hiển thị ẩn)', async () => {
    stubApi({
      '/api/admin/review?status=pending': () => jsonResponse(200, { items: [] }),
      '/api/admin/periods/2026-10/delivery-people': () => jsonResponse(200, { ym: '2026-10', people: [{ user_sub: 'a', status: 'done' }] }),
      '/api/admin/stock': () => jsonResponse(200, [{ item_id: 'i1', short: 0, stock_state: 'incoming' }]),
    });
    const { result } = renderHook(() => useAdminBadges(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current).toEqual({ review: 0, delivery: 0, stock: 0, links: {} }));
  });

  it.each([
    ['1 người chưa nhận', [{ user_sub: 'a', status: 'pending' }, { user_sub: 'b', status: 'done' }], 1],
    ['0 người (mọi người đã nhận đủ)', [{ user_sub: 'b', status: 'done' }], 0],
  ])('biên Giao hàng: %s — cùng số thẻ Chưa nhận, kể cả khi tủ trống', async (_n, people, n) => {
    stubApi({ '/api/admin/periods/2026-10/delivery-people': () => jsonResponse(200, { ym: '2026-10', people: people.map((p) => ({ ...p, deliverable_now: false })) }) });
    const { result } = renderHook(() => useAdminBadges(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.delivery).toBe(n));
  });

  it.each([
    ['0 món chờ → 0, link thường', [], 0, undefined],
    ['1 món chờ → 1, link kỳ có món', [{ line_id: 'l1', period_ym: '2026-09', user_sub: 'an' }], 1, '/admin/month?ym=2026-09&chip=pending'],
  ])('biên Kỳ tháng: %s', async (_n, items, n, link) => {
    stubApi({ '/api/admin/review?status=pending': () => jsonResponse(200, { items }) });
    const { result } = renderHook(() => useAdminBadges(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.review).toBe(n));
    expect(result.current.links.review).toBe(link);
  });

  it('kỳ chưa khóa (409 PERIOD_NOT_LOCKED) → delivery undefined, không ném', async () => {
    stubApi({ '/api/admin/periods/2026-10/delivery-people': () => jsonResponse(409, { code: 'PERIOD_NOT_LOCKED' }) });
    const { result } = renderHook(() => useAdminBadges(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.review).toBe(2));
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
    await waitFor(() => expect(result.current).toEqual({ review: undefined, delivery: undefined, stock: undefined, links: {} }));
  });

  it('staleTime 60 s: focus lúc 59 999 ms không tải lại, lúc 60 000 ms tải lại', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-03T08:00:00.000Z') });
    const f = stubApi();
    const { result } = renderHook(() => useAdminBadges(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.review).toBe(2));
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
