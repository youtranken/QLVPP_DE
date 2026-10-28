import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { useSetMyRequest } from './request.api';

describe('useSetMyRequest', () => {
  it('lưu phiếu xong thì danh sách lịch sử bị đánh dấu cũ', () => {
    const qc = new QueryClient();
    qc.setQueryData(['request', 'history'], { pages: [], pageParams: [] });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useSetMyRequest(), { wrapper });
    result.current('2026-11', null);
    expect(qc.getQueryState(['request', 'history'])?.isInvalidated).toBe(true);
  });
});
