import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { MonthSwitcher } from '@/ui/month-switcher';

const labels = { group: 'Chọn tháng', prev: 'Tháng trước', next: 'Tháng sau' };
const fmt = (ym: string) => `Tháng ${ym.slice(5)}/${ym.slice(0, 4)}`;

describe('MonthSwitcher', () => {
  it('ở trần thì › vô hiệu, dưới trần thì bật', () => {
    const { unmount } = renderWithI18n(
      <MonthSwitcher value="2026-11" max="2026-11" onChange={() => {}} formatLabel={fmt} labels={labels} />,
    );
    expect(screen.getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
    unmount();
    renderWithI18n(
      <MonthSwitcher value="2026-10" max="2026-11" onChange={() => {}} formatLabel={fmt} labels={labels} />,
    );
    expect(screen.getByRole('button', { name: 'Tháng sau' })).toBeEnabled();
  });

  it('bấm › đi tháng kế', async () => {
    const onChange = vi.fn();
    renderWithI18n(<MonthSwitcher value="2026-10" onChange={onChange} formatLabel={fmt} labels={labels} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tháng sau' }));
    expect(onChange).toHaveBeenCalledWith('2026-11');
  });

  it('có status thì hiện badge trạng thái kỳ; không có thì không', () => {
    const { unmount } = renderWithI18n(
      <MonthSwitcher value="2026-11" onChange={() => {}} formatLabel={fmt} labels={labels} status={{ tone: 'ok', label: 'Đang mở · hạn 10' }} />,
    );
    expect(screen.getByText('Đang mở · hạn 10')).toBeInTheDocument();
    unmount();
    renderWithI18n(<MonthSwitcher value="2026-11" onChange={() => {}} formatLabel={fmt} labels={labels} />);
    expect(screen.queryByText('Đang mở · hạn 10')).not.toBeInTheDocument();
  });
});
