import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { InlineNumber } from '@/ui/inline-number';

async function openEditor() {
  await userEvent.click(screen.getByRole('button', { name: 'Tối đa/tháng' }));
  return screen.getByRole('spinbutton', { name: 'Tối đa/tháng' });
}

describe('InlineNumber', () => {
  it('bấm ô rồi Enter gọi onCommit(7) và đóng ô nhập', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    renderWithI18n(<InlineNumber value={5} label="Tối đa/tháng" onCommit={onCommit} />);
    const input = await openEditor();
    await userEvent.clear(input);
    await userEvent.type(input, '7{Enter}');
    expect(onCommit).toHaveBeenCalledWith(7);
    expect(await screen.findByRole('button', { name: 'Tối đa/tháng' })).toHaveTextContent('5');
  });

  it('Esc trả giá trị cũ và không gọi onCommit', async () => {
    const onCommit = vi.fn();
    renderWithI18n(<InlineNumber value={5} label="Tối đa/tháng" onCommit={onCommit} />);
    const input = await openEditor();
    await userEvent.clear(input);
    await userEvent.type(input, '9{Escape}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tối đa/tháng' })).toHaveTextContent('5');
  });

  it('giá trị không đổi thì Enter không gọi onCommit', async () => {
    const onCommit = vi.fn();
    renderWithI18n(<InlineNumber value={5} label="Tối đa/tháng" onCommit={onCommit} />);
    await openEditor();
    await userEvent.keyboard('{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('onCommit bị từ chối: ô aria-invalid, câu lỗi ngay dưới ô, giữ ô mở', async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error('Tối đa phải từ 1 đến 999'));
    renderWithI18n(<InlineNumber value={5} label="Tối đa/tháng" min={1} max={999} onCommit={onCommit} />);
    const input = await openEditor();
    await userEvent.clear(input);
    await userEvent.type(input, '7{Enter}');
    const field = await screen.findByRole('spinbutton', { name: 'Tối đa/tháng' });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    const describedBy = field.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(describedBy)).toHaveTextContent('Tối đa phải từ 1 đến 999');
  });

  it('lỗi không phải Error thì hiện câu chung dưới ô', async () => {
    renderWithI18n(<InlineNumber value={5} label="Tối đa/tháng" onCommit={() => Promise.reject('x')} />);
    const input = await openEditor();
    await userEvent.clear(input);
    await userEvent.type(input, '8{Enter}');
    expect(await screen.findByText('Không lưu được — thử lại.')).toBeInTheDocument();
  });

  it('thuộc tính min/max đi xuống ô nhập', async () => {
    renderWithI18n(<InlineNumber value={5} label="Tối đa/tháng" min={1} max={999} onCommit={vi.fn()} />);
    const input = await openEditor();
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('max', '999');
  });
});
