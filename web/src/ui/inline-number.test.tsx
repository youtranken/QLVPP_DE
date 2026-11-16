import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
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

  it('ApiError hiện message của server, không phải HTTP 422', async () => {
    const err = new ApiError(422, { code: 'VALIDATION', message: 'Tối đa phải từ 1 đến 999' });
    renderWithI18n(<InlineNumber value={5} label="Tối đa/tháng" onCommit={() => Promise.reject(err)} />);
    const input = await openEditor();
    await userEvent.clear(input);
    await userEvent.type(input, '8{Enter}');
    expect(await screen.findByText('Tối đa phải từ 1 đến 999')).toBeInTheDocument();
    expect(screen.queryByText(/HTTP/)).not.toBeInTheDocument();
  });

  it('ApiError không có message thì dùng câu chung', async () => {
    renderWithI18n(<InlineNumber value={5} label="Tối đa/tháng" onCommit={() => Promise.reject(new ApiError(500, {}))} />);
    const input = await openEditor();
    await userEvent.clear(input);
    await userEvent.type(input, '8{Enter}');
    expect(await screen.findByText('Không lưu được — thử lại.')).toBeInTheDocument();
  });

  it('formatError ghi đè câu lỗi', async () => {
    renderWithI18n(
      <InlineNumber value={5} label="Tối đa/tháng" onCommit={() => Promise.reject(new Error('x'))} formatError={() => 'Câu riêng'} />,
    );
    const input = await openEditor();
    await userEvent.clear(input);
    await userEvent.type(input, '8{Enter}');
    expect(await screen.findByText('Câu riêng')).toBeInTheDocument();
  });

  it('Enter thành công trả focus về nút', async () => {
    renderWithI18n(<InlineNumber value={5} label="Tối đa/tháng" onCommit={vi.fn().mockResolvedValue(undefined)} />);
    const input = await openEditor();
    await userEvent.clear(input);
    await userEvent.type(input, '8{Enter}');
    expect(await screen.findByRole('button', { name: 'Tối đa/tháng' })).toHaveFocus();
  });

  it('Esc trả focus về nút', async () => {
    renderWithI18n(<InlineNumber value={5} label="Tối đa/tháng" onCommit={vi.fn()} />);
    await openEditor();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Tối đa/tháng' })).toHaveFocus();
  });

  it('bị từ chối thì focus ở lại ô nhập', async () => {
    renderWithI18n(<InlineNumber value={5} label="Tối đa/tháng" onCommit={() => Promise.reject(new Error('Lỗi'))} />);
    const input = await openEditor();
    await userEvent.clear(input);
    await userEvent.type(input, '8{Enter}');
    expect(await screen.findByText('Lỗi')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Tối đa/tháng' })).toHaveFocus();
  });

  it('đang lưu: ô readOnly + aria-busy, giữ focus, Enter lần hai không gọi lại', async () => {
    let resolve!: () => void;
    const onCommit = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    renderWithI18n(<InlineNumber value={5} label="Tối đa/tháng" onCommit={onCommit} />);
    const input = await openEditor();
    await userEvent.clear(input);
    await userEvent.type(input, '8{Enter}');
    const busy = screen.getByRole('spinbutton', { name: 'Tối đa/tháng' });
    expect(busy).toHaveAttribute('readonly');
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(busy).not.toBeDisabled();
    expect(busy).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledTimes(1);
    resolve();
    expect(await screen.findByRole('button', { name: 'Tối đa/tháng' })).toBeInTheDocument();
  });

  it('blur giá trị không đổi thì đóng; giá trị đã đổi thì giữ mở và không tự lưu', async () => {
    const onCommit = vi.fn();
    const { unmount } = renderWithI18n(<InlineNumber value={5} label="Tối đa/tháng" onCommit={onCommit} />);
    await openEditor();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Tối đa/tháng' })).toBeInTheDocument();
    unmount();
    renderWithI18n(<InlineNumber value={5} label="Tối đa/tháng" onCommit={onCommit} />);
    const input = await openEditor();
    await userEvent.clear(input);
    await userEvent.type(input, '8');
    await userEvent.tab();
    expect(screen.getByRole('spinbutton', { name: 'Tối đa/tháng' })).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('InlineNumber — biên min/max kiểm tại ô (Tối đa/tháng 1..999)', () => {
  const setup = () => {
    const onCommit = vi.fn(() => Promise.resolve());
    renderWithI18n(<InlineNumber value={5} label="Tối đa" min={1} max={999} onCommit={onCommit} />);
    return onCommit;
  };
  const edit = async (text: string) => {
    await userEvent.click(screen.getByRole('button', { name: 'Tối đa' }));
    const box = screen.getByRole('spinbutton', { name: 'Tối đa' });
    await userEvent.clear(box);
    await userEvent.type(box, `${text}{Enter}`);
    return box;
  };

  it.each(['0', '1000', '2.5'])('gõ %s → "Nhập số nguyên từ 1 đến 999" tại ô, không gọi onCommit', async (text) => {
    const onCommit = setup();
    const box = await edit(text);
    expect(box).toHaveAccessibleDescription('Nhập số nguyên từ 1 đến 999');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it.each([['1', 1], ['999', 999]])('gõ %s → gọi onCommit(%i)', async (text, n) => {
    const onCommit = setup();
    await edit(text);
    expect(onCommit).toHaveBeenCalledWith(n);
  });
});
