import { describe, it, expect, vi } from 'vitest';
import { Dialog, DialogTitle } from '@/ui/dialog';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';

function Harness({ dirty, onOpenChange }: { dirty: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <ConfirmProvider>
      <Dialog open onOpenChange={onOpenChange} dirty={dirty}>
        <DialogTitle>Sửa món</DialogTitle>
      </Dialog>
    </ConfirmProvider>
  );
}

describe('Dialog dirty guard', () => {
  it('không sửa dở: Esc đóng ngay', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness dirty={false} onOpenChange={onOpenChange} />);
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('đang sửa dở: Esc hỏi "Bỏ thay đổi?" — Tiếp tục sửa giữ mở, Bỏ thay đổi mới đóng', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness dirty onOpenChange={onOpenChange} />);
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByText('Bỏ thay đổi chưa lưu?')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Tiếp tục sửa'));
    expect(onOpenChange).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
