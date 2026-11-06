import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Drawer, DrawerClose, DrawerTitle } from '@/ui/drawer';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
import { mockViewport } from '@/test/viewport';

afterEach(() => {
  vi.unstubAllGlobals();
});

function Harness({
  dirty = false,
  onOpenChange,
  onPrev,
  onNext,
}: {
  dirty?: boolean;
  onOpenChange: (o: boolean) => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <ConfirmProvider>
      <Drawer open onOpenChange={onOpenChange} dirty={dirty} onPrev={onPrev} onNext={onNext}>
        <DrawerTitle>Phiếu của An</DrawerTitle>
        <label>
          Số lượng
          <input type="number" defaultValue={2} />
        </label>
        <button type="button">Lưu nháp</button>
        <DrawerClose>Hủy</DrawerClose>
      </Drawer>
    </ConfirmProvider>
  );
}

function Opener() {
  const [open, setOpen] = useState(false);
  return (
    <ConfirmProvider>
      <main id="main">
        <button type="button" onClick={() => setOpen(true)}>
          Mở Bút bi xanh
        </button>
      </main>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTitle>Sửa món</DrawerTitle>
        <DrawerClose>Hủy</DrawerClose>
      </Drawer>
    </ConfirmProvider>
  );
}

describe('Drawer — ngăn trượt phải', () => {
  it('là dialog có tên, rộng mặc định 384 px, lớp drawer', () => {
    renderWithI18n(<Harness onOpenChange={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Phiếu của An' });
    expect(dialog).toHaveClass('drawer');
    expect(dialog).toHaveStyle({ maxWidth: '384px' });
  });

  it('nút đóng trong ngăn: không sửa dở → đóng ngay', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('đang sửa dở: Hủy hỏi "Bỏ thay đổi?" — Ở lại giữ ngăn mở', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness dirty onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(await screen.findByText('Bỏ thay đổi?')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Ở lại'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('dirty + Esc → hỏi "Bỏ thay đổi?"; Bỏ thay đổi mới đóng', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness dirty onOpenChange={onOpenChange} />);
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByRole('dialog', { name: 'Bỏ thay đổi?' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ thay đổi' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('Drawer — ↑/↓ đổi nội dung tại chỗ', () => {
  it('focus ở nút: ↓ và J gọi onNext, ↑ và K gọi onPrev', async () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    renderWithI18n(<Harness onOpenChange={vi.fn()} onPrev={onPrev} onNext={onNext} />);
    screen.getByRole('button', { name: 'Lưu nháp' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onNext).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('j');
    expect(onNext).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('k');
    expect(onPrev).toHaveBeenCalledTimes(2);
  });

  it('focus trong input: ↓/↑/J/K không gọi callback (để ô nhập dùng phím)', async () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    renderWithI18n(<Harness onOpenChange={vi.fn()} onPrev={onPrev} onNext={onNext} />);
    screen.getByRole('spinbutton', { name: 'Số lượng' }).focus();
    await userEvent.keyboard('{ArrowDown}{ArrowUp}jk');
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('đang sửa dở: ↓ hỏi "Bỏ thay đổi?" — Ở lại không chuyển, Bỏ thay đổi mới gọi onNext', async () => {
    const onNext = vi.fn();
    renderWithI18n(<Harness dirty onOpenChange={vi.fn()} onNext={onNext} />);
    screen.getByRole('button', { name: 'Lưu nháp' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(await screen.findByText('Bỏ thay đổi?')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Ở lại'));
    expect(onNext).not.toHaveBeenCalled();
    screen.getByRole('button', { name: 'Lưu nháp' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('phím kèm Ctrl/Alt/Meta không bị nuốt', async () => {
    const onNext = vi.fn();
    renderWithI18n(<Harness onOpenChange={vi.fn()} onNext={onNext} />);
    screen.getByRole('button', { name: 'Lưu nháp' }).focus();
    await userEvent.keyboard('{Control>}{ArrowDown}{/Control}{Alt>}j{/Alt}');
    expect(onNext).not.toHaveBeenCalled();
  });
});

describe('Drawer — trả focus và đẩy nội dung', () => {
  it('đóng → focus trả về nút đã mở', async () => {
    renderWithI18n(<Opener />);
    const opener = screen.getByRole('button', { name: 'Mở Bút bi xanh' });
    await userEvent.click(opener);
    expect(screen.getByRole('dialog', { name: 'Sửa món' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it.each([1440, 1920])('%i px: phủ lên, không đẩy #main (không has-drawer, không padding-right)', async (w) => {
    mockViewport(w);
    const { container } = renderWithI18n(<Opener />);
    await userEvent.click(screen.getByRole('button', { name: 'Mở Bút bi xanh' }));
    const main = container.querySelector<HTMLElement>('#main')!;
    expect(main).not.toHaveClass('has-drawer');
    expect(main.style.getPropertyValue('--drawer-w')).toBe('');
  });

  it('không có #main: mở ngăn vẫn chạy, không lỗi', () => {
    mockViewport(1440);
    renderWithI18n(<Harness onOpenChange={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Phiếu của An' })).toBeInTheDocument();
  });
});
