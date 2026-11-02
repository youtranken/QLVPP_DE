import { describe, it, expect, vi } from 'vitest';
import { Select } from '@/ui/select';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';

const options = [
  { value: '', label: 'Mọi phòng ban' },
  { value: 'ct', label: 'Công trình' },
  { value: 'kt', label: 'Kế toán' },
];

describe('Select', () => {
  it('ô chọn có tên theo nhãn hiện, đủ lựa chọn, giá trị đang chọn', () => {
    renderWithI18n(<Select label="Phòng ban" value="ct" options={options} onChange={() => {}} />);
    const box = screen.getByRole('combobox', { name: 'Phòng ban' });
    expect(box).toHaveValue('ct');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Mọi phòng ban', 'Công trình', 'Kế toán']);
    expect(screen.getByText('Phòng ban')).toBeVisible();
  });
  it('chọn "Kế toán" → onChange nhận "kt"', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Select label="Phòng ban" value="" options={options} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Phòng ban' }), 'Kế toán');
    expect(onChange).toHaveBeenCalledWith('kt');
  });
  it('stacked → nhãn hiện đứng trên ô chọn (dùng trong form lọc), ô chọn vẫn có tên', () => {
    renderWithI18n(<Select label="Hành động" stacked value="" options={options} onChange={() => {}} />);
    const box = screen.getByRole('combobox', { name: 'Hành động' });
    expect(box.closest('label')).toHaveClass('select--stacked');
    expect(screen.getByText('Hành động')).toBeVisible();
  });
  it('hideLabel → nhãn chỉ cho trình đọc màn hình, ô chọn vẫn có tên', () => {
    renderWithI18n(<Select label="Phòng ban" hideLabel value="" options={options} onChange={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Phòng ban' })).toBeInTheDocument();
    expect(screen.getByText('Phòng ban')).toHaveClass('sr-only');
  });
  it('disabled → ô chọn tắt, có title nói lý do', () => {
    renderWithI18n(<Select label="Phòng ban" value="" options={options} onChange={() => {}} disabled title="Đang đồng bộ" />);
    const box = screen.getByRole('combobox', { name: 'Phòng ban' });
    expect(box).toBeDisabled();
    expect(box).toHaveAttribute('title', 'Đang đồng bộ');
  });
});
