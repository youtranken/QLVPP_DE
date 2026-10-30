import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen } from '@/test/test-utils';
import { Skeleton } from '@/ui/skeleton';

describe('Skeleton', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('chưa hiện ở 299 ms', () => {
    renderWithI18n(<Skeleton shape="row" count={3} />);
    act(() => void vi.advanceTimersByTime(299));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('hiện ở 300 ms với đúng số khối', () => {
    const { container } = renderWithI18n(<Skeleton shape="row" count={3} />);
    act(() => void vi.advanceTimersByTime(300));
    expect(screen.getByRole('status', { busy: true })).toBeInTheDocument();
    expect(container.querySelectorAll('.skeleton')).toHaveLength(3);
  });

  it('delayMs tùy chỉnh được', () => {
    renderWithI18n(<Skeleton shape="stat" delayMs={50} />);
    act(() => void vi.advanceTimersByTime(49));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
