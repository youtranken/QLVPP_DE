import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { Stepper } from '@/ui/stepper';

function Controlled({ start, max, onChange }: { start: number; max: number; onChange?: (n: number) => void }) {
  const [value, setValue] = useState(start);
  return (
    <Stepper
      value={value}
      max={max}
      label="Bút bi"
      onChange={(n) => {
        setValue(n);
        onChange?.(n);
      }}
    />
  );
}

describe('Stepper', () => {
  it('nút có aria-label theo nhãn; + tăng, − giảm', async () => {
    renderWithI18n(<Controlled start={1} max={5} />);
    await userEvent.click(screen.getByRole('button', { name: 'Thêm Bút bi' }));
    expect(screen.getByRole('spinbutton', { name: 'Bút bi' })).toHaveValue(2);
    await userEvent.click(screen.getByRole('button', { name: 'Bớt Bút bi' }));
    expect(screen.getByRole('spinbutton', { name: 'Bút bi' })).toHaveValue(1);
  });

  it('không vượt max: + vô hiệu ở max, gõ 99 với max 5 → 5', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Controlled start={5} max={5} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Thêm Bút bi' })).toBeDisabled();
    const input = screen.getByRole('spinbutton', { name: 'Bút bi' });
    await userEvent.clear(input);
    await userEvent.type(input, '99');
    expect(onChange).not.toHaveBeenCalledWith(99);
    expect(input).toHaveValue(5);
  });

  it('về 0 thì báo onChange(0) và − vô hiệu ở min', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Controlled start={1} max={5} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Bớt Bút bi' }));
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(screen.getByRole('button', { name: 'Bớt Bút bi' })).toBeDisabled();
  });

  it('ô trống khi rời ô thì trả lại giá trị cũ', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Controlled start={3} max={5} onChange={onChange} />);
    const input = screen.getByRole('spinbutton', { name: 'Bút bi' });
    await userEvent.clear(input);
    await userEvent.tab();
    expect(input).toHaveValue(3);
    expect(onChange).not.toHaveBeenCalled();
  });
});
