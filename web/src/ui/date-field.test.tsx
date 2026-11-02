import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { DateField } from './date-field';

function Harness({ initial = '', error, onChange }: { initial?: string; error?: string; onChange: (v: string | null) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DateField
        label="Từ ngày"
        value={value}
        error={error}
        onChange={(v) => {
          if (v !== null) setValue(v);
          onChange(v);
        }}
      />
      <button type="button">khác</button>
    </>
  );
}

const box = () => screen.getByRole('textbox', { name: 'Từ ngày' });

describe('DateField — dd/mm/yyyy', () => {
  it('hiện giá trị ISO dưới dạng dd/mm/yyyy, ô chữ (không input date của trình duyệt), mô tả nêu định dạng', () => {
    renderWithI18n(<Harness initial="2026-12-31" onChange={vi.fn()} />);
    expect(box()).toHaveValue('31/12/2026');
    expect(box()).toHaveAttribute('type', 'text');
    expect(box()).toHaveAccessibleDescription('dd/mm/yyyy');
  });

  it('gõ "01/01/2027" → onChange ISO 2027-01-01; gõ 8 số "31122026" → 2026-12-31 và rời ô thì hiện "31/12/2026"', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Harness onChange={onChange} />);
    await userEvent.type(box(), '01/01/2027');
    expect(onChange).toHaveBeenLastCalledWith('2027-01-01');
    await userEvent.clear(box());
    await userEvent.type(box(), '31122026');
    expect(onChange).toHaveBeenLastCalledWith('2026-12-31');
    await userEvent.click(screen.getByRole('button', { name: 'khác' }));
    expect(box()).toHaveValue('31/12/2026');
  });

  it.each(['31/02/2026', '29/02/2027'])('"%s" sai → onChange(null); lỗi chỉ hiện khi rời ô, gắn vào ô', async (text) => {
    const onChange = vi.fn();
    renderWithI18n(<Harness onChange={onChange} />);
    await userEvent.type(box(), text);
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(box()).not.toHaveAttribute('aria-invalid');
    await userEvent.click(screen.getByRole('button', { name: 'khác' }));
    expect(box()).toHaveAttribute('aria-invalid', 'true');
    expect(box()).toHaveAccessibleDescription('Ngày không hợp lệ — nhập dd/mm/yyyy.');
  });

  it('29/02/2028 (năm nhuận) hợp lệ, không lỗi khi rời ô', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Harness onChange={onChange} />);
    await userEvent.type(box(), '29/02/2028');
    await userEvent.click(screen.getByRole('button', { name: 'khác' }));
    expect(onChange).toHaveBeenLastCalledWith('2028-02-29');
    expect(box()).not.toHaveAttribute('aria-invalid');
  });

  it('xóa hết → onChange(""); lỗi của trang (error) thắng gợi ý', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Harness initial="2026-10-20" error="“Đến ngày” phải bằng hoặc sau “Từ ngày”." onChange={onChange} />);
    expect(box()).toHaveAccessibleDescription('“Đến ngày” phải bằng hoặc sau “Từ ngày”.');
    await userEvent.clear(box());
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});
