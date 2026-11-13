import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useUrlPatch } from './use-url-patch';
import { useUrlSearchBox } from './use-url-search-box';

const wrap = (path: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  };

// Trang mẫu: ô tìm đẩy ?q=, nút "Xóa lọc" xóa cả chip lẫn q bằng chính hàm ghi URL của trang (như Kỳ tháng, Kho, Danh mục)
function usePage() {
  const [params, update] = useUrlPatch();
  const q = params.get('q') ?? '';
  const [text, setText] = useUrlSearchBox(q, (v) => update({ q: v || null }, true));
  return { text, setText, q, chip: params.get('chip'), clearAll: () => update({ chip: null, q: null }), setChip: (c: string) => update({ chip: c }), search: useLocation().search };
}

describe('useUrlSearchBox', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('gõ → 300 ms sau mới đẩy q lên URL', () => {
    const { result } = renderHook(usePage, { wrapper: wrap('/p') });
    act(() => result.current.setText('ab'));
    expect(result.current.q).toBe('');
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.q).toBe('ab');
  });

  it('bấm Xóa lọc trong 300 ms sau khi gõ (q trên URL vẫn rỗng) → ô rỗng, chữ vừa gõ không bị áp lại', () => {
    const { result } = renderHook(usePage, { wrapper: wrap('/p?chip=noted') });
    act(() => result.current.setText('ab'));
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.clearAll());
    expect(result.current.text).toBe('');
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.q).toBe('');
    expect(result.current.chip).toBeNull();
    expect(result.current.search).toBe('');
  });

  it('bấm chip trong lúc đang gõ (không đụng q) → chữ đang gõ vẫn được đẩy lên', () => {
    const { result } = renderHook(usePage, { wrapper: wrap('/p') });
    act(() => result.current.setText('ab'));
    act(() => result.current.setChip('noted'));
    expect(result.current.text).toBe('ab');
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.q).toBe('ab');
    expect(result.current.chip).toBe('noted');
  });

  it('q đổi từ ngoài (liên kết, Back) → ô đồng bộ theo', () => {
    const { result } = renderHook(usePage, { wrapper: wrap('/p?q=x') });
    expect(result.current.text).toBe('x');
    act(() => result.current.clearAll());
    expect(result.current.text).toBe('');
  });
});
