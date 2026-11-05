import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useReviewCache } from '@/features/review/review.api';
import { useRefreshStock } from '@/features/stock/stock.api';
import { useRefreshAfterFlow } from './use-refresh-after-flow';

function setup() {
  const qc = new QueryClient();
  const spy = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const keys = () => spy.mock.calls.map((c) => (c[0]?.queryKey ?? []).join('/'));
  return { wrapper, keys };
}

describe('làm mới sau thao tác kho/giao: báo cáo đổi theo (REPORTS_KEY)', () => {
  it('useRefreshStock làm mới báo cáo', async () => {
    const { wrapper, keys } = setup();
    await renderHook(() => useRefreshStock(), { wrapper }).result.current();
    expect(keys()).toContain('reports');
  });

  it('useRefreshAfterFlow: báo cáo, người giao, Tổng hợp, Còn nợ, tồn + khóa thêm của luồng', async () => {
    const { wrapper, keys } = setup();
    await renderHook(() => useRefreshAfterFlow([['admin-request']]), { wrapper }).result.current();
    expect(keys()).toEqual(expect.arrayContaining(['reports', 'admin/delivery-people', 'admin-request']));
    expect(keys().some((k) => k.startsWith('admin/summary') || k.includes('summary'))).toBe(true);
  });

  it('duyệt/từ chối dòng ngoài DM làm mới báo cáo', async () => {
    const { wrapper, keys } = setup();
    await renderHook(() => useReviewCache(), { wrapper }).result.current.reviewed();
    expect(keys()).toContain('reports');
  });
});
