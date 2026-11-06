import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useReviewCache } from '@/features/review/review.api';
import { useRefreshStock } from '@/features/stock/stock.api';
import { useRefreshArrivals } from '@/features/arrivals/use-arrivals-plan';
import { useRefreshAfterAdjust } from '@/features/summary/use-adjust';
import { useRefreshSendState } from '@/features/send-adm/send-adm.api';
import { useRefreshAfterLineChange } from './use-refresh-after-flow';

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

  it('useRefreshAfterLineChange: một tập khóa — Tổng hợp, người giao, Còn nợ, trạng thái Gửi ADM, Hàng về, tồn, báo cáo + khóa thêm của luồng', async () => {
    const { wrapper, keys } = setup();
    await renderHook(() => useRefreshAfterLineChange([['admin-request']]), { wrapper }).result.current();
    expect(keys()).toEqual(
      expect.arrayContaining(['admin-summary', 'admin/delivery-people', 'backlog', 'send-state', 'arrivals-plan', 'stock', 'reports', 'admin-request']),
    );
  });

  it('làm bản mới / không cần đề nghị ở Gửi ADM → Hàng về của kỳ tải lại kế hoạch', async () => {
    const { wrapper, keys } = setup();
    await renderHook(() => useRefreshSendState('2026-10'), { wrapper }).result.current();
    expect(keys()).toEqual(expect.arrayContaining(['send-state/2026-10', 'arrivals-plan/2026-10']));
  });

  it('duyệt/từ chối dòng ngoài DM làm mới báo cáo', async () => {
    const { wrapper, keys } = setup();
    await renderHook(() => useReviewCache(), { wrapper }).result.current.reviewed();
    expect(keys()).toContain('reports');
  });
});

describe('mọi luồng đổi dòng phiếu dùng chung một tập làm mới (Tủ, Gửi ADM, Hàng về, Còn nợ, người giao)', () => {
  it.each<[string, () => () => Promise<unknown>]>([
    ['Hàng về lưu / ADM hết hàng / về bù', () => useRefreshArrivals('2026-10')],
    ['Hủy nợ ở Còn nợ', () => useRefreshAfterLineChange([['admin-request']])],
    ['Tổng hợp điều chỉnh phiếu', () => useRefreshAfterAdjust()],
    ['duyệt/từ chối dòng ngoài DM', () => useReviewCache().reviewed],
  ])('%s → stock, send-state, arrivals-plan, backlog, delivery-people', async (_label, hook) => {
    const { wrapper, keys } = setup();
    await renderHook(hook, { wrapper }).result.current();
    expect(keys()).toEqual(expect.arrayContaining(['stock', 'send-state', 'arrivals-plan', 'backlog', 'admin/delivery-people']));
  });
});
