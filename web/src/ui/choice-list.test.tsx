import { describe, it, expect, vi } from 'vitest';
import { ChoiceList } from '@/ui/choice-list';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';

const CHOICES = [
  { value: 'a', label: 'NCC hết hàng' },
  { value: 'b', label: 'Khác' },
];

describe('ChoiceList', () => {
  it('nhóm radio có tên theo nhãn, mỗi hàng là nhãn bọc radio thật; bấm cả hàng chọn được', async () => {
    const onChange = vi.fn();
    renderWithI18n(<ChoiceList label="Lý do" required value={null} choices={CHOICES} onChange={onChange} />);
    const group = screen.getByRole('radiogroup', { name: 'Lý do' });
    expect(group).toHaveAttribute('aria-required', 'true');
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    await userEvent.click(screen.getByText('Khác'));
    expect(onChange).toHaveBeenCalledWith('b');
  });
  it('mục đang chọn được tick', () => {
    renderWithI18n(<ChoiceList label="Lý do" value="a" choices={CHOICES} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'NCC hết hàng' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'NCC hết hàng' }).closest('label')).toHaveClass('choice-row');
  });
});
