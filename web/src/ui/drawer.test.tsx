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

  it('đang sửa dở: Hủy hỏi "Bỏ thay đổi?" — Tiếp tục sửa giữ ngăn mở', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness dirty onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(await screen.findByText('Bỏ thay đổi chưa lưu?')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Tiếp tục sửa'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('dirty + Esc → hỏi "Bỏ thay đổi chưa lưu?"; Bỏ thay đổi mới đóng', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness dirty onOpenChange={onOpenChange} />);
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByRole('dialog', { name: 'Bỏ thay đổi chưa lưu?' })).toBeInTheDocument();
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

  it('≥ 1440 px (1440): mở thêm has-drawer vào #main, đóng thì gỡ', async () => {
    mockViewport(1440);
    const { container } = renderWithI18n(<Opener />);
    const main = container.querySelector('#main')!;
    expect(main).not.toHaveClass('has-drawer');
    await userEvent.click(screen.getByRole('button', { name: 'Mở Bút bi xanh' }));
    expect(main).toHaveClass('has-drawer');
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(main).not.toHaveClass('has-drawer');
  });

  it('1439 px: phủ lên, không thêm has-drawer', async () => {
    mockViewport(1439);
    const { container } = renderWithI18n(<Opener />);
    await userEvent.click(screen.getByRole('button', { name: 'Mở Bút bi xanh' }));
    expect(container.querySelector('#main')).not.toHaveClass('has-drawer');
  });

  it('không có #main: mở ngăn vẫn chạy, không lỗi', () => {
    mockViewport(1440);
    renderWithI18n(<Harness onOpenChange={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Phiếu của An' })).toBeInTheDocument();
  });
});
