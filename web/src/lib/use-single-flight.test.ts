import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSingleFlight } from './use-single-flight';

function deferred() {
  let resolve: () => void = () => {};
  let reject: (e: unknown) => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useSingleFlight', () => {
  it('lần gọi thứ hai khi lần đầu chưa xong (cùng tick, chưa vẽ lại) bị bỏ qua; xong rồi thì gọi được', async () => {
    const { result } = renderHook(() => useSingleFlight());
    const first = deferred();
    const task = vi.fn(() => first.promise);
    let a: Promise<void> = Promise.resolve();
    act(() => {
      a = result.current.run(task);
      void result.current.run(task);
    });
    expect(task).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);
    await act(async () => {
      first.resolve();
      await a;
    });
    expect(result.current.pending).toBe(false);
    await act(() => result.current.run(task));
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('task ném lỗi → pending về false, lần gọi sau vẫn chạy', async () => {
    const { result } = renderHook(() => useSingleFlight());
    const failing = deferred();
    let a: Promise<void> = Promise.resolve();
    act(() => {
      a = result.current.run(() => failing.promise);
    });
    await act(async () => {
      failing.reject(new Error('mạng'));
      await a.catch(() => {});
    });
    expect(result.current.pending).toBe(false);
    const next = vi.fn(() => Promise.resolve());
    await act(() => result.current.run(next));
    expect(next).toHaveBeenCalledTimes(1);
  });
});
