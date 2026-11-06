import { describe, it, expect, vi } from 'vitest';
import { Dialog, DialogCloseButton, DialogTitle } from '@/ui/dialog';
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

  it('đang sửa dở: Esc hỏi "Bỏ thay đổi?" — Ở lại giữ mở, Bỏ thay đổi mới đóng', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness dirty onOpenChange={onOpenChange} />);
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByText('Bỏ thay đổi?')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Ở lại'));
    expect(onOpenChange).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('DialogCloseButton', () => {
  function CloseHarness({ disabled, onOpenChange }: { disabled?: boolean; onOpenChange: (o: boolean) => void }) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogTitle>Sửa món</DialogTitle>
        <DialogCloseButton disabled={disabled} />
      </Dialog>
    );
  }

  it('nút "Đóng" là biểu tượng SVG, không phải ký tự ✕, bấm thì đóng', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(<CloseHarness onOpenChange={onOpenChange} />);
    const btn = screen.getByRole('button', { name: 'Đóng' });
    expect(btn.querySelector('svg')).not.toBeNull();
    expect(btn).not.toHaveTextContent('✕');
    await userEvent.click(btn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disabled: nút "Đóng" vô hiệu, bấm không đóng', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(<CloseHarness disabled onOpenChange={onOpenChange} />);
    const btn = screen.getByRole('button', { name: 'Đóng' });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
