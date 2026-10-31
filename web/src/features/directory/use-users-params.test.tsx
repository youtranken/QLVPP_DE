import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useUsersParams } from './use-users-params';

describe('useUsersParams', () => {
  it('đẩy q (debounce) và bấm thẻ cùng lúc: URL giữ cả q lẫn status', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/admin/users']}>{children}</MemoryRouter>;
    const { result } = renderHook(() => ({ p: useUsersParams(), location: useLocation() }), { wrapper });
    act(() => {
      result.current.p.setQ('bình');
      result.current.p.toggleFilter('locked');
    });
    const sp = new URLSearchParams(result.current.location.search);
    expect(sp.get('q')).toBe('bình');
    expect(sp.get('status')).toBe('locked');
    expect(result.current.p.view).toEqual({ filter: 'locked', dept: '', q: 'bình' });
  });
});
