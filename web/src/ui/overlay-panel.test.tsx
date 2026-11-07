import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { usePanelParam } from '@/lib/use-panel-param';
import { OverlayPanel } from '@/ui/overlay-panel';
import { DialogTitle } from '@/ui/dialog';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { act, renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
import { mockViewport } from '@/test/viewport';

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

interface HarnessProps {
  dirty?: boolean;
  saving?: boolean;
  index?: number;
  onClose?: () => void;
  onStep?: (dir: 1 | -1) => void;
}

function Harness({ dirty = false, saving = false, index = 2, onClose = vi.fn(), onStep = vi.fn() }: HarnessProps) {
  return (
    <ConfirmProvider>
      <OverlayPanel
        open
        onClose={onClose}
        title="Sửa món Bút bi xanh"
        dirty={dirty}
        saving={saving}
        nav={{ index, total: 48, onStep, prevLabel: 'Món trước', nextLabel: 'Món sau' }}
        footer={<button type="button">Lưu</button>}
      >
        <label>
          Tên
          <input defaultValue="Bút bi xanh" />
        </label>
      </OverlayPanel>
    </ConfirmProvider>
  );
}

const dialog = () => screen.getByRole('dialog', { name: 'Sửa món Bút bi xanh' });

describe('OverlayPanel — lớp phủ từ phải', () => {
  it('768 px: lớp ovp, không có thanh "← Đóng", có × "Đóng"; đầu panel có bộ đếm 3/48', () => {
    mockViewport(768);
    renderWithI18n(<Harness />);
    expect(dialog()).toHaveClass('ovp');
    expect(document.querySelector('.ovp-backdrop')).not.toBeNull();
    expect(screen.queryByRole('button', { name: '← Đóng' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeInTheDocument();
    expect(screen.getByText('3/48')).toBeInTheDocument();
  });

  it('767 px: thanh đầu "← Đóng" (không có ×), bấm thì đóng', async () => {
    mockViewport(767);
    const onClose = vi.fn();
    renderWithI18n(<Harness onClose={onClose} />);
    expect(screen.queryByRole('button', { name: 'Đóng' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '← Đóng' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('mục đầu: ↑ vô hiệu, ↓ bật; mục thứ hai: ↑ bật', () => {
    mockViewport(1280);
    const { rerender } = renderWithI18n(<Harness index={0} />);
    expect(screen.getByRole('button', { name: 'Món trước' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Món sau' })).toBeEnabled();
    rerender(<Harness index={1} />);
    expect(screen.getByRole('button', { name: 'Món trước' })).toBeEnabled();
  });

  it('mục cuối 48/48: ↓ vô hiệu; mục bị lọc khỏi danh sách: "—/48", ↑/↓ vô hiệu', () => {
    mockViewport(1280);
    const { rerender } = renderWithI18n(<Harness index={47} />);
    expect(screen.getByText('48/48')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Món sau' })).toBeDisabled();
    rerender(<Harness index={-1} />);
    expect(screen.getByText('—/48')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Món trước' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Món sau' })).toBeDisabled();
  });

  it('chưa sửa gì: ↓ (phím và nút) chuyển ngay, không hỏi', async () => {
    mockViewport(1280);
    const onStep = vi.fn();
    renderWithI18n(<Harness onStep={onStep} />);
    await userEvent.click(screen.getByRole('button', { name: 'Món sau' }));
    await userEvent.keyboard('{ArrowUp}');
    expect(onStep.mock.calls).toEqual([[1], [-1]]);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('đang sửa: ↓ hỏi "Bỏ thay đổi?"; "Ở lại" giữ nguyên, "Bỏ thay đổi" mới chuyển', async () => {
    mockViewport(1280);
    const onStep = vi.fn();
    renderWithI18n(<Harness dirty onStep={onStep} />);
    await userEvent.click(screen.getByRole('button', { name: 'Món sau' }));
    expect(await screen.findByText('Bỏ thay đổi?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ở lại' }));
    expect(onStep).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Món sau' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it('đang sửa: Esc và × đều hỏi; "Ở lại" không đóng', async () => {
    mockViewport(1280);
    const onClose = vi.fn();
    renderWithI18n(<Harness dirty onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(await screen.findByRole('button', { name: 'Ở lại' }));
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('đang lưu: Esc không đóng, × và ↑/↓ vô hiệu', async () => {
    mockViewport(1280);
    const onClose = vi.fn();
    renderWithI18n(<Harness saving onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Món sau' })).toBeDisabled();
  });

  it('hộp "Bỏ thay đổi?" nằm trên panel: Esc lần 1 chỉ đóng hộp, panel còn', async () => {
    mockViewport(1280);
    const onClose = vi.fn();
    renderWithI18n(<Harness dirty onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    await screen.findByText('Bỏ thay đổi?');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('Bỏ thay đổi?')).toBeNull());
    expect(dialog()).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

function Opener() {
  const [open, setOpen] = useState(false);
  return (
    <ConfirmProvider>
      <button type="button" onClick={() => setOpen(true)}>
        Sửa Bút bi xanh
      </button>
      <OverlayPanel open={open} onClose={() => setOpen(false)} title="Sửa món Bút bi xanh">
        <p>Nội dung</p>
      </OverlayPanel>
    </ConfirmProvider>
  );
}

describe('OverlayPanel — focus', () => {
  it('đóng bằng Esc → focus về thẻ đã mở', async () => {
    mockViewport(1280);
    renderWithI18n(<Opener />);
    const card = screen.getByRole('button', { name: 'Sửa Bút bi xanh' });
    await userEvent.click(card);
    expect(dialog()).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(card);
  });
});

function RoutedPanel({ dirty }: { dirty: boolean }) {
  const { search } = useLocation();
  const panel = usePanelParam('item');
  return (
    <>
      <output data-testid="search">{search}</output>
      <button type="button" onClick={() => panel.open('m1')}>
        Mở
      </button>
      <OverlayPanel open={panel.id !== null} onClose={panel.close} title="Sửa món Bút bi xanh" dirty={dirty}>
        <p>Nội dung</p>
      </OverlayPanel>
    </>
  );
}

function renderRouted(dirty: boolean) {
  window.history.replaceState(null, '', '/admin/catalog');
  renderWithI18n(
    <BrowserRouter>
      <ConfirmProvider>
        <RoutedPanel dirty={dirty} />
      </ConfirmProvider>
    </BrowserRouter>,
  );
}

describe('OverlayPanel — nút Back của trình duyệt', () => {
  it('chưa sửa: Back đóng panel ngay', async () => {
    mockViewport(1280);
    renderRouted(false);
    await userEvent.click(screen.getByRole('button', { name: 'Mở' }));
    expect(dialog()).toBeInTheDocument();
    await act(async () => window.history.back());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('search').textContent).toBe('');
  });

  it('đang sửa: Back hỏi, URL vẫn có ?item; "Ở lại" giữ panel; "Bỏ thay đổi" thì đóng', async () => {
    mockViewport(1280);
    renderRouted(true);
    await userEvent.click(screen.getByRole('button', { name: 'Mở' }));
    await act(async () => window.history.back());
    await userEvent.click(await screen.findByRole('button', { name: 'Ở lại' }));
    expect(window.location.search).toBe('?item=m1');
    expect(screen.getByTestId('search').textContent).toBe('?item=m1');
    expect(dialog()).toBeInTheDocument();
    await act(async () => window.history.back());
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(''));
    expect(window.location.search).toBe('');
  });

  it('đang sửa: × → "Bỏ thay đổi" chỉ hỏi một lần, panel đóng, URL sạch', async () => {
    mockViewport(1280);
    renderRouted(true);
    await userEvent.click(screen.getByRole('button', { name: 'Mở' }));
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(''));
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('đang sửa: rời trang/đóng tab → beforeunload bị chặn (preventDefault + returnValue cho Safari/Chrome cũ); chưa sửa thì không', () => {
    mockViewport(1280);
    window.history.replaceState(null, '', '/admin/catalog?item=m1');
    const { rerender } = renderWithI18n(
      <BrowserRouter>
        <ConfirmProvider>
          <RoutedPanel dirty />
        </ConfirmProvider>
      </BrowserRouter>,
    );
    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    const returnValue = vi.fn();
    Object.defineProperty(dirtyEvent, 'returnValue', { set: returnValue });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);
    expect(returnValue).toHaveBeenCalledWith('');
    rerender(
      <BrowserRouter>
        <ConfirmProvider>
          <RoutedPanel dirty={false} />
        </ConfirmProvider>
      </BrowserRouter>,
    );
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
  });

  it('có head: không vẽ tiêu đề mặc định; DialogTitle trong head đặt tên hộp; 390 không có hàng "← Đóng" riêng nhưng vẫn có nút đóng cùng hàng đầu', () => {
    mockViewport(390);
    renderWithI18n(
      <ConfirmProvider>
        <OverlayPanel open onClose={vi.fn()} title="Tiêu đề mặc định" head={<DialogTitle>Tiêu đề trong head</DialogTitle>}>
          <p>thân</p>
        </OverlayPanel>
      </ConfirmProvider>,
    );
    expect(screen.getByRole('dialog', { name: 'Tiêu đề trong head' })).toBeInTheDocument();
    expect(screen.queryByText('Tiêu đề mặc định')).toBeNull();
    expect(document.querySelector('.ovp-bar')).toBeNull();
    expect(screen.getByRole('button', { name: '← Đóng' }).closest('.ovp-head')).not.toBeNull();
  });
});
