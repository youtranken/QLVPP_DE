import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
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

const status = () => screen.getByRole('status');
const undoButton = () => screen.queryByRole('button', { name: 'Hoàn tác' });
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('Toast có Hoàn tác 5 giây (TC-18)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('nút đếm ngược "Hoàn tác (5)" → (4) → (3) → (2) → (1)', () => {
    mount();
    act(() => show({ text: 'Đã giao 5 phiếu', undo: vi.fn() }));
    for (const n of [5, 4, 3, 2, 1]) {
      expect(undoButton()).toHaveTextContent(`Hoàn tác (${n})`);
      tick(1000);
    }
  });

  it('4 999 ms vẫn còn nút; 5 000 ms nút và toast biến mất', () => {
    mount();
    act(() => show({ text: 'Đã giao 5 phiếu', undo: vi.fn() }));
    tick(4999);
    expect(undoButton()).toBeInTheDocument();
    tick(1);
    expect(undoButton()).not.toBeInTheDocument();
    expect(status()).toBeEmptyDOMElement();
  });

  it('rê chuột vào toast không dừng đếm: cửa sổ hoàn tác do server tính', () => {
    mount();
    act(() => show({ text: 'Đã xóa món Bút bi', undo: vi.fn() }));
    fireEvent.mouseEnter(screen.getByText('Đã xóa món Bút bi').parentElement!);
    tick(5000);
    expect(status()).toBeEmptyDOMElement();
  });

  it('bấm Hoàn tác → gọi hàm hoàn tác một lần, rồi báo "Đã hoàn tác."', async () => {
    mount();
    const undo = vi.fn().mockResolvedValue(undefined);
    act(() => show({ text: 'Đã giao 5 phiếu', undo }));
    tick(2000);
    await act(async () => fireEvent.click(undoButton()!));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(status()).toHaveTextContent('Đã hoàn tác.');
    expect(undoButton()).not.toBeInTheDocument();
  });

  it('bấm hai lần liền → chỉ gọi một lần (nút tắt khi đang gửi)', async () => {
    mount();
    let finish: () => void = () => undefined;
    const undo = vi.fn(() => new Promise<void>((r) => (finish = r)));
    act(() => show({ text: 'Đã giao 5 phiếu', undo }));
    const button = undoButton()!;
    fireEvent.click(button);
    fireEvent.click(button);
    expect(undo).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });

  it('server trả UNDO_EXPIRED → báo câu dễ hiểu "Đã quá 5 giây, không hoàn tác được nữa."', async () => {
    mount();
    const undo = vi.fn().mockRejectedValue(new ApiError(409, { code: 'UNDO_EXPIRED' }));
    act(() => show({ text: 'Đã hủy nợ', undo }));
    await act(async () => fireEvent.click(undoButton()!));
    expect(status()).toHaveTextContent('Đã quá 5 giây, không hoàn tác được nữa.');
  });

  it('server trả UNDO_ALREADY_DONE → "Thao tác này đã được hoàn tác."; lỗi khác → câu chung', async () => {
    mount();
    act(() => show({ text: 'Đã hủy nợ', undo: vi.fn().mockRejectedValue(new ApiError(409, { code: 'UNDO_ALREADY_DONE' })) }));
    await act(async () => fireEvent.click(undoButton()!));
    expect(status()).toHaveTextContent('Thao tác này đã được hoàn tác.');
    act(() => show({ text: 'Đã hủy nợ', undo: vi.fn().mockRejectedValue(new ApiError(409, { code: 'STALE_UPDATE' })) }));
    await act(async () => fireEvent.click(undoButton()!));
    expect(status()).toHaveTextContent('Không hoàn tác được — dữ liệu vừa đổi, tải lại để xem.');
  });

  it('undoSince 3 giây trước → nút "Hoàn tác (2)"; còn ở mốc+4 999 ms, mất ở mốc+5 000 ms (không muộn hơn server)', () => {
    mount();
    const t0 = Date.now();
    tick(3000);
    act(() => show({ text: 'Đã giao cho An', undo: vi.fn(), undoSince: t0 }));
    expect(undoButton()).toHaveTextContent('Hoàn tác (2)');
    expect((document.querySelector('.toast__bar') as HTMLElement).style.animationDuration).toBe('2000ms');
    tick(1999);
    expect(undoButton()).toBeInTheDocument();
    tick(1);
    expect(undoButton()).not.toBeInTheDocument();
    expect(status()).toBeEmptyDOMElement();
  });

  it('undoSince đã quá 5 000 ms → vẫn báo kết quả nhưng không có nút Hoàn tác', () => {
    mount();
    const t0 = Date.now();
    tick(5000);
    act(() => show({ text: 'Đã giao cho An', undo: vi.fn(), undoSince: t0 }));
    expect(status()).toHaveTextContent('Đã giao cho An');
    expect(undoButton()).not.toBeInTheDocument();
  });

  it('toast có cả nút hành động khác lẫn Hoàn tác: hiện đủ hai nút', () => {
    mount();
    act(() => show({ text: 'Đã giao cho An', action: { label: 'Người tiếp', onClick: vi.fn() }, undo: vi.fn() }));
    expect(screen.getByRole('button', { name: 'Người tiếp' })).toBeInTheDocument();
    expect(undoButton()).toBeInTheDocument();
  });
});
