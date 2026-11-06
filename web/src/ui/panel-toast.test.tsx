import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderWithI18n, screen } from '@/test/test-utils';
import { usePanelToast } from './panel-toast';

function Host({ onUndo }: { onUndo: () => void }) {
  const toast = usePanelToast(5000);
  return (
    <>
      <button type="button" onClick={() => toast.show({ text: 'Đã ngừng Kẹp B', action: { label: 'Hoàn tác', onClick: onUndo } })}>
        show
      </button>
      {toast.host}
    </>
  );
}

afterEach(() => vi.useRealTimers());

describe('usePanelToast (Hoàn tác 5 s)', () => {
  it('biên: còn ở 4 999 ms, mất ở 5 000 ms', () => {
    vi.useFakeTimers();
    renderWithI18n(<Host onUndo={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'show' }));
    act(() => vi.advanceTimersByTime(4999));
    expect(screen.getByText('Đã ngừng Kẹp B')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Đã ngừng Kẹp B')).toBeNull();
  });

  it('rê chuột vào thì dừng đếm; bấm "Hoàn tác" gọi một lần rồi ẩn', () => {
    vi.useFakeTimers();
    const undo = vi.fn();
    renderWithI18n(<Host onUndo={undo} />);
    fireEvent.click(screen.getByRole('button', { name: 'show' }));
    fireEvent.mouseEnter(screen.getByText('Đã ngừng Kẹp B').parentElement!);
    act(() => vi.advanceTimersByTime(10_000));
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Đã ngừng Kẹp B')).toBeNull();
  });
});
