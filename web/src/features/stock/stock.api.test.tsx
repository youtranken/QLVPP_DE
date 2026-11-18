import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { STOCK_KEY, useRefreshStock } from './stock.api';

const LEDGER = [...STOCK_KEY, 'ledger', '2026-11', 'issue'];

describe('useRefreshStock', () => {
  it('xuất lẻ xong làm mới sổ Lịch sử lọc Xuất lẻ (thay trang Xuất lẻ cũ)', async () => {
    const qc = new QueryClient();
    qc.setQueryData(LEDGER, []);
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useRefreshStock(), { wrapper });
    expect(qc.getQueryState(LEDGER)?.isInvalidated).toBe(false);
    await result.current();
    expect(qc.getQueryState(LEDGER)?.isInvalidated).toBe(true);
  });
});
