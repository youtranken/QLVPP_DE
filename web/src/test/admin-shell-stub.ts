import { vi } from 'vitest';
import { jsonResponse } from '@/test/test-utils';

export const SHELL_PERIOD = { ym: '2026-11', deadline: '2026-11-10T17:00:00.000Z', is_open: true, days_left: 4, previous: null };

type Route = (init?: RequestInit) => Response;

// fetch giả cho shell Hành chính: đếm sidebar, thẻ kỳ, chuông; trang bên trong nhận { items: [] }
export function stubShellApi(over: Record<string, Route> = {}, fallback: Route = () => jsonResponse(200, { items: [] })) {
  const routes: Record<string, Route> = {
    '/api/periods/current': () => jsonResponse(200, SHELL_PERIOD),
    '/api/admin/review?status=pending': () => jsonResponse(200, { items: [] }),
    '/api/admin/periods/2026-10/summary': () => jsonResponse(200, { lines_pending_delivery: 0 }),
    '/api/admin/stock': () => jsonResponse(200, []),
    '/api/me/notifications?unread=true&limit=1': () => jsonResponse(200, { items: [], next_cursor: null, unread_count: 0 }),
    '/api/admin/items': () => jsonResponse(200, []),
    '/api/item-categories?all=1': () => jsonResponse(200, []),
    ...over,
  };
  const f = vi.fn((url: string, init?: RequestInit) => Promise.resolve((routes[String(url)] ?? fallback)(init)));
  vi.stubGlobal('fetch', f);
  return f;
}
