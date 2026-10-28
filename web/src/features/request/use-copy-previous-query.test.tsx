import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { jsonResponse } from '@/test/test-utils';
import { useCopyPreviousQuery } from './request.api';

afterEach(() => vi.unstubAllGlobals());

describe('useCopyPreviousQuery', () => {
  it('POST chép lại chỉ gọi một lần mỗi kỳ: mount lại hoặc quay lại cửa sổ không gọi lại', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(404, { code: 'REQUEST_NOT_FOUND' })));
    vi.stubGlobal('fetch', fetchMock);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const first = renderHook(() => useCopyPreviousQuery('2026-11', 'csrf'), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();
    const second = renderHook(() => useCopyPreviousQuery('2026-11', 'csrf'), { wrapper });
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(second.result.current.data).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    focusManager.setFocused(undefined);
  });
});
