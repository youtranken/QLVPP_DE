import { describe, expect, it, vi } from 'vitest';
import { Drawer, DrawerClose, DrawerTitle } from '@/ui/drawer';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';

function Harness({ dirty = false, onOpenChange }: { dirty?: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <ConfirmProvider>
      <Drawer open onOpenChange={onOpenChange} dirty={dirty}>
        <DrawerTitle>Phiếu của An</DrawerTitle>
        <DrawerClose>Hủy</DrawerClose>
      </Drawer>
    </ConfirmProvider>
  );
}

describe('Drawer — ngăn trượt phải', () => {
  it('là dialog có tên, rộng tối đa 520 px, lớp drawer', () => {
    renderWithI18n(<Harness onOpenChange={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Phiếu của An' });
    expect(dialog).toHaveClass('drawer');
    expect(dialog).toHaveStyle({ maxWidth: '520px' });
  });

  it('nút đóng trong ngăn: không sửa dở → đóng ngay', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('đang sửa dở: Hủy/Esc hỏi "Bỏ thay đổi?" — Tiếp tục sửa giữ ngăn mở', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness dirty onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(await screen.findByText('Bỏ thay đổi chưa lưu?')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Tiếp tục sửa'));
    expect(onOpenChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
