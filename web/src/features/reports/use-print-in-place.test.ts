import { createElement, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderWithI18n, screen } from '@/test/test-utils';
import { ToastProvider } from '@/ui/toast-provider';
import { snapshotDataFixture } from './reports-fixtures';
import { usePrintInPlace, waitReady, type PrintResult } from './use-print-in-place';

const FORM = 'Phiếu đề xuất văn phòng phẩm';
const pageStyle = () => document.head.querySelector('style[data-print-page]');
const region = () => document.querySelector('body > [data-print-portal]');

function Harness() {
  const printer = usePrintInPlace();
  const [result, setResult] = useState<PrintResult | null>(null);
  return createElement(
    'div',
    null,
    createElement('button', { type: 'button', onClick: () => void printer.print(snapshotDataFixture()).then(setResult) }, 'go'),
    createElement('output', { 'data-testid': 'result' }, result ?? ''),
    createElement('output', { 'data-testid': 'pending' }, String(printer.pending)),
    printer.portal,
  );
}

function Toggle() {
  const [on, setOn] = useState(true);
  return createElement('div', null, on && createElement(Harness), createElement('button', { type: 'button', onClick: () => setOn(false) }, 'leave'));
}

const mount = () => renderWithI18n(createElement(ToastProvider, null, createElement(Harness)));
const go = () => act(async () => void fireEvent.click(screen.getByRole('button', { name: 'go' })));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('usePrintInPlace: in tại chỗ, không đổi trang', () => {
  it('một lần print: vùng in là con trực tiếp của body (ngoài #root), có tờ trình ký, không phụ lục, @page A4 dọc lúc in; xong thì gỡ cả hai', async () => {
    const seen: { region: boolean; heading: boolean; appendix: boolean; style: string | null }[] = [];
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      const r = region();
      seen.push({ region: !!r, heading: !!r?.querySelector('h1')?.textContent?.includes(FORM), appendix: !!r?.textContent?.includes('Phụ lục'), style: pageStyle()?.textContent ?? null });
      window.dispatchEvent(new Event('beforeprint'));
      window.dispatchEvent(new Event('afterprint'));
    });
    const open = vi.spyOn(window, 'open');
    mount();
    await go();
    expect(await screen.findByTestId('result')).toHaveTextContent('printed');
    expect(print).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
    expect(seen).toEqual([{ region: true, heading: true, appendix: false, style: '@page { size: A4 portrait; margin: 14mm 14mm 16mm; }' }]);
    expect(region()).toBeNull();
    expect(pageStyle()).toBeNull();
    expect(await screen.findByText('Đã chốt bản 09:30 28/10. Cần in lại: mở Bản chốt.')).toBeInTheDocument();
  });

  it('không có beforeprint sau 1 s → "blocked" + toast "Bấm để mở hộp in" có nút In gọi lại print; vùng in còn tới afterprint', async () => {
    vi.useFakeTimers();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    mount();
    await go();
    await act(() => vi.advanceTimersByTimeAsync(999));
    expect(screen.getByTestId('result')).toHaveTextContent('');
    expect(screen.queryByText('Bấm để mở hộp in')).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByTestId('result')).toHaveTextContent('blocked');
    expect(screen.getByText('Bấm để mở hộp in')).toBeInTheDocument();
    expect(region()).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'In' }));
    expect(print).toHaveBeenCalledTimes(2);
    act(() => void window.dispatchEvent(new Event('afterprint')));
    expect(region()).toBeNull();
    expect(pageStyle()).toBeNull();
  });

  it('toast bị chặn ở lại (không tự ẩn sau 4 s): sau 5 s nút In vẫn còn; afterprint thì toast bị chặn biến mất', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'print').mockImplementation(() => {});
    mount();
    await go();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.getByRole('button', { name: 'In' })).toBeInTheDocument();
    act(() => void window.dispatchEvent(new Event('afterprint')));
    expect(screen.queryByText('Bấm để mở hộp in')).toBeNull();
    expect(screen.queryByRole('button', { name: 'In' })).toBeNull();
  });

  it('toast bị chặn biến mất khi bấm in lần nữa', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'print').mockImplementation(() => {});
    mount();
    await go();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByText('Bấm để mở hộp in')).toBeInTheDocument();
    act(() => void fireEvent.click(screen.getByRole('button', { name: 'go' })));
    expect(screen.queryByText('Bấm để mở hộp in')).toBeNull();
  });

  it('bị chặn rồi trang lấy lại focus (chưa in gì): không báo "Đã chốt…", toast bị chặn và vùng in còn nguyên', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'print').mockImplementation(() => {});
    mount();
    await go();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    act(() => void window.dispatchEvent(new Event('focus')));
    expect(screen.queryByText('Đã chốt bản 09:30 28/10. Cần in lại: mở Bản chốt.')).toBeNull();
    expect(screen.getByText('Bấm để mở hộp in')).toBeInTheDocument();
    expect(region()).not.toBeNull();
  });

  it('bị chặn → bấm In ở toast mở được hộp in, không có afterprint: trang lấy lại focus thì gỡ vùng in và báo đã chốt', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'print').mockImplementation(() => {});
    mount();
    await go();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    fireEvent.click(screen.getByRole('button', { name: 'In' }));
    act(() => void window.dispatchEvent(new Event('focus')));
    expect(region()).toBeNull();
    expect(screen.queryByText('Bấm để mở hộp in')).toBeNull();
    expect(screen.getByText('Đã chốt bản 09:30 28/10. Cần in lại: mở Bản chốt.')).toBeInTheDocument();
  });

  it('toast bị chặn biến mất khi rời trang (gỡ màn in)', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'print').mockImplementation(() => {});
    const view = renderWithI18n(createElement(ToastProvider, null, createElement(Toggle)));
    await go();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByText('Bấm để mở hộp in')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'leave' }));
    expect(screen.queryByText('Bấm để mở hộp in')).toBeNull();
    view.unmount();
  });

  it('beforeprint tới trong 0.5 s → "printed", không toast bị chặn', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'print').mockImplementation(() => void setTimeout(() => window.dispatchEvent(new Event('beforeprint')), 500));
    mount();
    await go();
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(screen.getByTestId('result')).toHaveTextContent('printed');
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.queryByText('Bấm để mở hộp in')).toBeNull();
  });

  it('không có afterprint: rời trang (unmount) vẫn gỡ vùng in và @page', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => void window.dispatchEvent(new Event('beforeprint')));
    const view = mount();
    await go();
    expect(await screen.findByTestId('result')).toHaveTextContent('printed');
    expect(region()).not.toBeNull();
    view.unmount();
    expect(region()).toBeNull();
    expect(pageStyle()).toBeNull();
  });

  it('không có afterprint: trang lấy lại focus → gỡ vùng in và báo đã chốt; in lần kế chỉ còn một vùng in', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => void window.dispatchEvent(new Event('beforeprint')));
    mount();
    await go();
    expect(await screen.findByTestId('result')).toHaveTextContent('printed');
    await go();
    expect(document.querySelectorAll('[data-print-portal]')).toHaveLength(1);
    expect(document.head.querySelectorAll('style[data-print-page]')).toHaveLength(1);
    act(() => void window.dispatchEvent(new Event('focus')));
    expect(region()).toBeNull();
    expect(pageStyle()).toBeNull();
    expect(await screen.findByText('Đã chốt bản 09:30 28/10. Cần in lại: mở Bản chốt.')).toBeInTheDocument();
  });

  it('print() ném lỗi → báo "Đã chốt bản … nhưng chưa mở được bản in." và dọn', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {
      throw new Error('nope');
    });
    mount();
    await go();
    expect(await screen.findByText('Đã chốt bản 09:30 28/10 nhưng chưa mở được bản in.')).toBeInTheDocument();
    expect(screen.getByTestId('result')).toHaveTextContent('blocked');
    expect(region()).toBeNull();
  });
});

describe('waitReady: chờ font + ảnh tối đa 3 s', () => {
  const withImage = (decode: () => Promise<void>) => {
    const root = document.createElement('div');
    const img = document.createElement('img');
    img.decode = decode;
    root.append(img);
    return root;
  };

  it('ảnh decode() treo → xong đúng ở 3000 ms, không trước', async () => {
    vi.useFakeTimers();
    let done = false;
    void waitReady(withImage(() => new Promise(() => {}))).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(2999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });

  it('ảnh decode() xong ngay (hoặc lỗi) → xong ngay', async () => {
    vi.useFakeTimers();
    let done = 0;
    void waitReady(withImage(() => Promise.resolve())).then(() => done++);
    void waitReady(withImage(() => Promise.reject(new Error('broken')))).then(() => done++);
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(2);
  });
});
