import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { DateRangeField, type DayRange } from '@/ui/date-range-field';
import { renderWithI18n, screen, userEvent, within } from '@/test/test-utils';

function Harness({ initial = { from: '', to: '' }, error, onChange = vi.fn() }: { initial?: DayRange; error?: string; onChange?: (r: DayRange) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <DateRangeField
      label="Khoảng ngày"
      value={value}
      error={error}
      onChange={(r) => {
        setValue(r);
        onChange(r);
      }}
    />
  );
}

const trigger = () => screen.getByRole('button', { name: /^Khoảng ngày/ });
const day = (iso: string) => screen.getByRole('grid').querySelector<HTMLElement>(`[data-day="${iso}"]`)!;

describe('DateRangeField — lịch tự dựng, không input date của trình duyệt', () => {
  it('chưa có khoảng: nút hiện "Mọi ngày", không có input date; có khoảng: "dd/mm/yyyy – dd/mm/yyyy"', () => {
    const { container, unmount } = renderWithI18n(<Harness />);
    expect(container.querySelector('input')).toBeNull();
    expect(trigger()).toHaveTextContent('Mọi ngày');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    unmount();
    renderWithI18n(<Harness initial={{ from: '2026-11-02', to: '2026-11-12' }} />);
    expect(trigger()).toHaveAccessibleName('Khoảng ngày 02/11/2026 – 12/11/2026');
  });

  it('bấm mở lịch tháng của ngày cuối, chọn ngày 5 rồi ngày 3 → khoảng 03–05 (tự xếp), lịch đóng, focus về nút', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Harness initial={{ from: '2026-10-01', to: '2026-10-20' }} onChange={onChange} />);
    await userEvent.click(trigger());
    const pop = screen.getByRole('dialog', { name: 'Khoảng ngày' });
    expect(within(pop).getByText(/tháng 10.*2026/i)).toBeInTheDocument();
    expect(within(pop).getByRole('status')).toHaveTextContent('20 ngày · 01/10/2026 – 20/10/2026');
    expect(day('2026-10-05')).toHaveAccessibleName(/5 tháng 10/i);
    await userEvent.click(day('2026-10-05'));
    expect(within(pop).getByRole('status')).toHaveTextContent('Chọn ngày kết thúc');
    await userEvent.click(day('2026-10-03'));
    expect(onChange).toHaveBeenCalledWith({ from: '2026-10-03', to: '2026-10-05' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('bàn phím: mở thì focus ngày cuối; ← lùi một ngày, PageDown sang tháng sau; Enter hai lần chọn một ngày; Esc đóng', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Harness initial={{ from: '2026-10-01', to: '2026-10-20' }} onChange={onChange} />);
    await userEvent.click(trigger());
    expect(document.activeElement).toHaveAttribute('data-day', '2026-10-20');
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toHaveAttribute('data-day', '2026-10-19');
    await userEvent.keyboard('{PageDown}');
    expect(document.activeElement).toHaveAttribute('data-day', '2026-11-19');
    await userEvent.keyboard('{Enter}{Enter}');
    expect(onChange).toHaveBeenCalledWith({ from: '2026-11-19', to: '2026-11-19' });
    await userEvent.click(trigger());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Xóa ngày" chỉ có khi đang có khoảng, bấm thì về rỗng', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Harness initial={{ from: '2026-10-01', to: '' }} onChange={onChange} />);
    expect(trigger()).toHaveTextContent('Từ 01/10/2026');
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: 'Xóa ngày' }));
    expect(onChange).toHaveBeenCalledWith({ from: '', to: '' });
  });

  it('lỗi hiện dưới ô, nút aria-invalid và mô tả trỏ tới lỗi', () => {
    renderWithI18n(<Harness error="Ngày không hợp lệ." />);
    expect(trigger()).toHaveAttribute('aria-invalid', 'true');
    expect(trigger()).toHaveAccessibleDescription('Ngày không hợp lệ.');
  });
});
