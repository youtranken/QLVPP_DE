import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { InlineText } from './inline-text';

function render(onCommit = vi.fn(async () => undefined)) {
  renderWithI18n(<InlineText value="Giấy" label="Sửa tên" maxLength={5} onCommit={onCommit} formatError={() => 'Trùng tên.'} />);
  return onCommit;
}

describe('InlineText', () => {
  it('Enter gửi chữ đã trim rồi về nút; maxLength giữ trên ô', async () => {
    const onCommit = render();
    await userEvent.click(screen.getByRole('button', { name: 'Sửa tên' }));
    const input = screen.getByRole('textbox', { name: 'Sửa tên' });
    expect(input).toHaveAttribute('maxLength', '5');
    await userEvent.clear(input);
    await userEvent.type(input, ' Bút {Enter}');
    expect(onCommit).toHaveBeenCalledWith('Bút');
    expect(await screen.findByRole('button', { name: 'Sửa tên' })).toHaveFocus();
  });

  it('Esc bỏ, không gửi; giữ nguyên chữ thì Enter không gửi', async () => {
    const onCommit = render();
    await userEvent.click(screen.getByRole('button', { name: 'Sửa tên' }));
    await userEvent.type(screen.getByRole('textbox'), 'x{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Sửa tên' }));
    await userEvent.keyboard('{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('lỗi server → câu lỗi gắn ô, aria-invalid, ô vẫn mở', async () => {
    render(vi.fn(async () => Promise.reject(new Error('x'))));
    await userEvent.click(screen.getByRole('button', { name: 'Sửa tên' }));
    await userEvent.type(screen.getByRole('textbox'), 'A{Enter}');
    const input = await screen.findByRole('textbox');
    await vi.waitFor(() => expect(input).toHaveAccessibleDescription('Trùng tên.'));
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
