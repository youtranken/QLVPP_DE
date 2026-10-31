import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { useUrlPatch } from './use-url-patch';

const wrap = (path: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  };

function useProbe() {
  const [params, update] = useUrlPatch();
  return { params, update, location: useLocation(), navigate: useNavigate() };
}

describe('useUrlPatch', () => {
  it('hai cập nhật trong cùng một act (đẩy q rồi bấm thẻ) giữ cả hai khóa', () => {
    const { result } = renderHook(useProbe, { wrapper: wrap('/p') });
    act(() => {
      result.current.update({ q: 'abc' }, true);
      result.current.update({ status: 'locked' });
    });
    const p = new URLSearchParams(result.current.location.search);
    expect(p.get('q')).toBe('abc');
    expect(p.get('status')).toBe('locked');
  });

  it('null xóa khóa; khóa khác giữ nguyên', () => {
    const { result } = renderHook(useProbe, { wrapper: wrap('/p?a=1&b=2') });
    act(() => result.current.update({ a: null }));
    expect(result.current.location.search).toBe('?b=2');
  });

  it('replace=true không thêm mục lịch sử, replace=false thêm', () => {
    const { result } = renderHook(useProbe, { wrapper: wrap('/p') });
    act(() => result.current.update({ q: 'x' }, true));
    act(() => result.current.update({ s: '1' }));
    act(() => result.current.navigate(-1));
    expect(result.current.location.search).toBe('?q=x');
  });

  it('điều hướng từ ngoài (Back, liên kết) đặt lại bản mới nhất, không ghi đè bằng khóa cũ', () => {
    const { result } = renderHook(useProbe, { wrapper: wrap('/p') });
    act(() => result.current.update({ a: '1' }));
    act(() => result.current.navigate('/p?b=2'));
    act(() => result.current.update({ c: '3' }));
    expect(new URLSearchParams(result.current.location.search).toString()).toBe('b=2&c=3');
  });
});
