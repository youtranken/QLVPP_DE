import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { ISSUES_KEY, useRefreshStock } from './stock.api';

describe('useRefreshStock', () => {
  it('xuất lẻ xong làm mới danh sách xuất lẻ', async () => {
    const qc = new QueryClient();
    qc.setQueryData([...ISSUES_KEY, '2026-11'], []);
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useRefreshStock(), { wrapper });
    expect(qc.getQueryState([...ISSUES_KEY, '2026-11'])?.isInvalidated).toBe(false);
    await result.current();
    expect(qc.getQueryState([...ISSUES_KEY, '2026-11'])?.isInvalidated).toBe(true);
  });
});
