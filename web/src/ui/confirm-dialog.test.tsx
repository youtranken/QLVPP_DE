import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import { renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';

function renderConfirm(danger: boolean, onConfirm = vi.fn()) {
  renderWithI18n(
    <ConfirmDialog
      title="Xóa món Bút bi xanh?"
      message="Món sẽ biến khỏi danh mục."
      confirmLabel="Xóa món"
      cancelLabel="Giữ lại"
      danger={danger}
      onConfirm={onConfirm}
      onCancel={vi.fn()}
    />,
  );
  return screen.getByRole('dialog', { name: 'Xóa món Bút bi xanh?' });
}

describe('ConfirmDialog — M1', () => {
  it('danger: nút xác nhận đúng tên, là nút cuối, ngay sau nút phụ', () => {
    const dialog = renderConfirm(true);
    const buttons = within(dialog).getAllByRole('button');
    expect(buttons.at(-1)).toHaveAccessibleName('Xóa món');
    expect(buttons.at(-2)).toHaveAccessibleName('Giữ lại');
  });

  it('bấm xác nhận gọi onConfirm', async () => {
    const onConfirm = vi.fn();
    const dialog = renderConfirm(true, onConfirm);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa món' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmDialog — nút đóng chung', () => {
  it('nút "Đóng" là biểu tượng × từ sprite (cả hai khung đều gắn IconSprite), không phải ký tự ✕', () => {
    const dialog = renderConfirm(false);
    const close = within(dialog).getByRole('button', { name: 'Đóng' });
    expect(close.querySelector('svg use')?.getAttribute('href')).toBe('#u-x');
    expect(close).not.toHaveTextContent('✕');
  });
});

describe('ConfirmDialog — caution', () => {
  it('lời hỏi nền cam (vẫn là mô tả của hộp), focus sẵn ở nút hủy', async () => {
    renderWithI18n(<ConfirmDialog title="Giao cho An?" message="Sẽ ghi Không mua: Pin sạc AA." confirmLabel="Xác nhận giao" cancelLabel="Hủy" caution onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Giao cho An?' });
    expect(dialog).toHaveAccessibleDescription('Sẽ ghi Không mua: Pin sạc AA.');
    expect(within(dialog).getByText('Sẽ ghi Không mua: Pin sạc AA.')).toHaveClass('alert--warn');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Hủy' })).toHaveFocus());
  });
});
