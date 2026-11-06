import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { ConfirmProvider } from './confirm-provider';
import { useConfirm } from './confirm-context';
import { Dialog, DialogTitle } from './dialog';
import { RowMenu } from './row-menu';

function MenuWithDialog() {
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();
  return (
    <>
      <RowMenu
        label="Thao tác cho Bút"
        items={[
          { label: 'Sửa', onSelect: () => setOpen(true) },
          { label: 'Xóa', danger: true, onSelect: () => void confirm({ title: 'Xóa Bút?', message: 'Không hoàn tác được.', confirmLabel: 'Xóa' }) },
        ]}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTitle>Sửa Bút</DialogTitle>
        <button type="button" onClick={() => setOpen(false)}>
          Lưu
        </button>
      </Dialog>
    </>
  );
}

function setup() {
  renderWithI18n(
    <ConfirmProvider>
      <MenuWithDialog />
    </ConfirmProvider>,
  );
  return screen.getByRole('button', { name: 'Thao tác cho Bút' });
}

async function choose(trigger: HTMLElement, label: string) {
  await userEvent.click(trigger);
  await userEvent.click(screen.getByRole('menuitem', { name: label }));
}

describe('RowMenu mở hộp thoại — trả focus về nút ⋯ khi hộp đóng', () => {
  it('Esc trong hộp "Sửa" → focus về nút ⋯', async () => {
    const trigger = setup();
    await choose(trigger, 'Sửa');
    expect(await screen.findByRole('dialog', { name: 'Sửa Bút' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('bấm Lưu đóng hộp → focus về nút ⋯', async () => {
    const trigger = setup();
    await choose(trigger, 'Sửa');
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Sửa Bút' })).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('hộp xác nhận (ConfirmDialog): Hủy hoặc Esc → focus về nút ⋯', async () => {
    const trigger = setup();
    await choose(trigger, 'Xóa');
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Xóa Bút?' })).getByRole('button', { name: 'Quay lại' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());

    await choose(trigger, 'Xóa');
    expect(await screen.findByRole('dialog', { name: 'Xóa Bút?' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
