import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, jsonResponse, renderHook } from '@/test/test-utils';
import { useLockTimer } from './use-lock-timer';

const DEADLINE = '2026-11-10T17:00:00.000Z';
const AT = new Date(DEADLINE).getTime();

function setup(deadline = DEADLINE) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(qc, 'invalidateQueries');
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { ym: '2026-11', deadline, is_open: true, days_left: 1, previous: null, owed: [] }))));
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { hook: renderHook(() => useLockTimer(), { wrapper }), spy };
}

describe('useLockTimer — hẹn giờ đúng deadline + 1 s', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('deadline + 999 ms chưa tải lại, deadline + 1000 ms tải lại kỳ hiện tại', async () => {
    vi.setSystemTime(AT - 5000);
    const { spy } = setup();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(spy).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000 + 999 - 10);
    });
    expect(spy).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['periods', 'current'] });
  });

  it('hạn xa hơn giới hạn setTimeout (≈24,8 ngày) không bị gọi ngay', async () => {
    vi.setSystemTime(AT - 30 * 86_400_000);
    const { spy } = setup();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(spy).not.toHaveBeenCalled();
  });
});
