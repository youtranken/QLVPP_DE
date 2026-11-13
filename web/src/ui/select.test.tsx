import { describe, it, expect, vi } from 'vitest';
import { Select } from '@/ui/select';
import { pickOption, renderWithI18n, screen, userEvent } from '@/test/test-utils';

const options = [
  { value: '', label: 'Mọi phòng ban' },
  { value: 'ct', label: 'Công trình' },
  { value: 'kt', label: 'Kế toán' },
];

describe('Select', () => {
  it('ô chọn tự dựng (không <select> gốc) có tên theo nhãn hiện, hiện lựa chọn đang chọn; mở ra đủ lựa chọn, mục đang chọn aria-selected', async () => {
    const { container } = renderWithI18n(<Select label="Phòng ban" value="ct" options={options} onChange={() => {}} />);
    expect(container.querySelector('select')).toBeNull();
    const box = screen.getByRole('combobox', { name: 'Phòng ban' });
    expect(box).toHaveTextContent('Công trình');
    expect(screen.getByText('Phòng ban')).toBeVisible();
    await userEvent.click(box);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Mọi phòng ban', 'Công trình', 'Kế toán']);
    expect(screen.getByRole('option', { name: 'Công trình' })).toHaveAttribute('aria-selected', 'true');
  });
  it('chọn "Kế toán" → onChange nhận "kt", danh sách đóng, focus về nút', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Select label="Phòng ban" value="" options={options} onChange={onChange} />);
    const box = screen.getByRole('combobox', { name: 'Phòng ban' });
    await pickOption(box, 'Kế toán');
    expect(onChange).toHaveBeenCalledWith('kt');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box).toHaveFocus();
  });
  it('stacked → nhãn hiện đứng trên ô chọn (dùng trong form lọc), ô chọn vẫn có tên', () => {
    renderWithI18n(<Select label="Hành động" stacked value="" options={options} onChange={() => {}} />);
    const box = screen.getByRole('combobox', { name: 'Hành động' });
    expect(box.closest('.select')).toHaveClass('select--stacked');
    expect(screen.getByText('Hành động')).toBeVisible();
  });
  it('hideLabel → không có nhãn hiện, ô chọn vẫn có tên', () => {
    renderWithI18n(<Select label="Phòng ban" hideLabel value="" options={options} onChange={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Phòng ban' })).toBeInTheDocument();
    expect(screen.queryByText('Phòng ban')).toBeNull();
  });
  it('disabled → ô chọn tắt, có title nói lý do', () => {
    renderWithI18n(<Select label="Phòng ban" value="" options={options} onChange={() => {}} disabled title="Đang đồng bộ" />);
    const box = screen.getByRole('combobox', { name: 'Phòng ban' });
    expect(box).toBeDisabled();
    expect(box).toHaveAttribute('title', 'Đang đồng bộ');
  });
});
