import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n as render, screen, userEvent, within } from '@/test/test-utils';
import { GroupedCombobox } from './grouped-combobox';

const OPTIONS = [
  { id: 'b1', label: 'Bút bi', group: 'Bút' },
  { id: 'k1', label: 'Kẹp giấy', group: 'Kẹp & dán', search: 'Kẹp giấy Paper clip K14' },
  { id: 'k2', label: 'Kẹp bướm', group: 'Kẹp & dán' },
];

const setup = () => {
  const onPick = vi.fn();
  render(<GroupedCombobox options={OPTIONS} onPick={onPick} label="Tìm món để thêm" noMatch="Không có món khớp" />);
  return { onPick, input: screen.getByRole('combobox', { name: 'Tìm món để thêm' }) };
};

describe('GroupedCombobox', () => {
  it('gõ "kep" (không dấu) → nhóm "Kẹp & dán" có "Kẹp giấy", không còn "Bút bi"', async () => {
    const { input } = setup();
    await userEvent.type(input, 'kep');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    const group = screen.getByRole('group', { name: 'Kẹp & dán' });
    expect(within(group).getByRole('option', { name: 'Kẹp giấy' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Bút bi' })).not.toBeInTheDocument();
  });

  it('↓ ↓ Enter chọn mục thứ hai; ↑ quay lại', async () => {
    const { input, onPick } = setup();
    await userEvent.type(input, 'kep');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Kẹp bướm' })).toHaveAttribute('aria-selected', 'true');
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Kẹp bướm' }).id);
    await userEvent.keyboard('{ArrowUp}{Enter}');
    expect(onPick).toHaveBeenCalledWith('k1');
    expect(input).toHaveValue('');
  });

  it('Esc đóng danh sách; bấm chuột chọn; không khớp → "Không có món khớp"', async () => {
    const { input, onPick } = setup();
    await userEvent.type(input, 'xyz');
    expect(screen.getByText('Không có món khớp')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, 'clip');
    await userEvent.click(screen.getByRole('option', { name: 'Kẹp giấy' }));
    expect(onPick).toHaveBeenCalledWith('k1');
  });
});
