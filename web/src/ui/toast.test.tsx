import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, fireEvent } from '@/test/test-utils';
import { ToastProvider } from '@/ui/toast-provider';
import { useToast } from '@/ui/toast-context';

type Show = ReturnType<typeof useToast>['show'];
let show: Show;

function Probe() {
  show = useToast().show;
  return null;
}

function mount() {
  renderWithI18n(
    <ToastProvider>
      <Probe />
    </ToastProvider>,
  );
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('còn hiện ở 3999 ms', () => {
    mount();
    act(() => show({ text: 'Đã lưu phiếu tháng 11' }));
    act(() => void vi.advanceTimersByTime(3999));
    expect(screen.getByRole('status')).toHaveTextContent('Đã lưu phiếu tháng 11');
  });

  it('mất ở 4000 ms', () => {
    mount();
    act(() => show({ text: 'Đã lưu phiếu tháng 11' }));
    act(() => void vi.advanceTimersByTime(4000));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('toast thứ hai thay toast đầu và tính lại 4 s', () => {
    mount();
    act(() => show({ text: 'Một' }));
    act(() => void vi.advanceTimersByTime(3000));
    act(() => show({ text: 'Hai' }));
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Hai');
    act(() => void vi.advanceTimersByTime(3999));
    expect(screen.getByRole('status')).toHaveTextContent('Hai');
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('nút hành động bấm được, gọi onClick rồi đóng toast', () => {
    mount();
    const onClick = vi.fn();
    act(() => show({ text: 'Đã xóa', tone: 'info', action: { label: 'Hoàn tác', onClick } }));
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('vùng status luôn có mặt, kể cả khi chưa có toast', () => {
    mount();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
