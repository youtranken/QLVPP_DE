import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { jsonResponse, renderWithI18n, screen } from '@/test/test-utils';
import { PERIOD } from '@/test/request-api-stub';
import { adminItem } from '@/features/summary/adjust-fixtures';
import { ItemFacts } from './item-facts';

afterEach(() => vi.unstubAllGlobals());

describe('ItemFacts — số người đăng ký', () => {
  it('lấy theo kỳ đã khóa gần nhất (2026-10), không gọi danh sách kỳ đang mở (409)', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
      if (url.startsWith('/api/admin/periods/2026-10/requests')) return Promise.resolve(jsonResponse(200, { items: [{ key: 'i-1', item_id: 'i-1', name: 'Bút', unit: 'cay', requested_qty: 4, people: 3 }] }));
      return Promise.resolve(jsonResponse(409, { code: 'PERIOD_NOT_LOCKED' }));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithI18n(
      <MemoryRouter>
        <ItemFacts item={adminItem({ id: 'i-1', name: 'Bút' })} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Đăng ký kỳ tháng 10: 3 người')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/2026-11/requests'))).toBe(false);
  });
});
