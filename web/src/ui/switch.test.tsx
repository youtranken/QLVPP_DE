import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { Switch } from '@/ui/switch';

describe('Switch', () => {
  it('role="switch" + aria-checked theo checked; bấm gọi onChange với giá trị đảo', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Switch checked label="Ngừng Bút bi" onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Ngừng Bút bi' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('có chữ hiển thị thì tên lấy từ chữ; disabled không gọi onChange', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Switch checked={false} text="Hiện món đã ngừng (2)" onChange={onChange} disabled />);
    const sw = screen.getByRole('switch', { name: 'Hiện món đã ngừng (2)' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(sw);
    expect(onChange).not.toHaveBeenCalled();
  });
});
