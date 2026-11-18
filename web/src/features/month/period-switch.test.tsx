import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderWithI18n, screen, userEvent, within } from '@/test/test-utils';
import { PeriodStatus, PeriodSwitch } from './period-switch';
import { periodFloor } from './use-month-params';

const OPEN = '2027-01';
const setup = (ym: string, earliestYm: string | null | undefined = '2026-10') => {
  const onChange = vi.fn();
  renderWithI18n(
    <>
      <PeriodStatus ym={ym} openYm={OPEN} />
      <PeriodSwitch ym={ym} openYm={OPEN} earliestYm={earliestYm} onChange={onChange} />
    </>,
  );
  return onChange;
};
const group = () => screen.getByRole('group', { name: 'Chọn kỳ' });

afterEach(() => void i18n.changeLanguage('vi'));

describe('PeriodSwitch', () => {
  // Chủ dự án 17/11: bỏ link nhảy kỳ ("Tháng 1 đang đăng ký →" / "← Tháng 12 đang giao") — chuyển kỳ bằng ‹ Tháng › là đủ
  it('kỳ đang giao: ‹ Tháng 12/2026 ›, chip "Đang giao", không có link nhảy kỳ', () => {
    setup('2026-12');
    expect(within(group()).getByText('Tháng 12/2026')).toBeInTheDocument();
    expect(screen.getByText('Đang giao')).toHaveClass('tag', 'tag--brand');
    expect(screen.queryByRole('button', { name: /đang đăng ký|đang giao/ })).toBeNull();
  });

  it('kỳ đang đăng ký: chip "Đang đăng ký", › tắt (trần là kỳ mở), không có link nhảy kỳ', () => {
    setup(OPEN);
    expect(screen.getByText('Đang đăng ký')).toHaveClass('tag--warn');
    expect(within(group()).getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /đang giao/ })).toBeNull();
  });

  it('kỳ cũ: chip "Đã qua"; ‹ tắt ở kỳ cũ nhất có phiếu', () => {
    setup('2026-10');
    expect(screen.getByText('Đã qua')).toHaveClass('tag');
    expect(within(group()).getByRole('button', { name: 'Tháng trước' })).toBeDisabled();
  });

  it('‹ › đi từng tháng một', async () => {
    const onChange = setup('2026-12');
    await userEvent.click(within(group()).getByRole('button', { name: 'Tháng trước' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-11');
    await userEvent.click(within(group()).getByRole('button', { name: 'Tháng sau' }));
    expect(onChange).toHaveBeenLastCalledWith(OPEN);
  });

  it('bảng năm-tháng: nhãn trạng thái từng tháng, tháng trước kỳ cũ nhất tắt, nhảy thẳng 12 → 1', async () => {
    const onChange = setup('2026-12');
    await userEvent.click(within(group()).getByRole('button', { name: /^Tháng 12\/2026, / }));
    const dialog = screen.getByRole('dialog', { name: 'Chọn năm-tháng' });
    expect(within(dialog).getByRole('button', { name: 'Tháng 12/2026 · Đang giao' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Tháng 11/2026 · Đã qua' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: 'Tháng 10/2026 · Đã qua' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: 'Tháng 9/2026' })).toBeDisabled();
    await userEvent.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('button', { name: 'Tháng 1/2027 · Đang đăng ký' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(OPEN);
  });

  it('chưa có kỳ nào có phiếu (null): sàn là kỳ đang giao; chưa tải (undefined): không chặn', () => {
    expect(periodFloor(OPEN, null)).toBe('2026-12');
    expect(periodFloor(OPEN, '2027-01')).toBe('2026-12');
    expect(periodFloor(OPEN, '2026-03')).toBe('2026-03');
    expect(periodFloor(OPEN, undefined)).toBeUndefined();
    setup('2026-12', null);
    expect(within(group()).getByRole('button', { name: 'Tháng trước' })).toBeDisabled();
  });

  it('tiếng Anh: tên tháng bằng chữ', async () => {
    await i18n.changeLanguage('en');
    setup('2026-12');
    expect(within(screen.getByRole('group', { name: 'Choose period' })).getByText('December 2026')).toBeInTheDocument();
    expect(screen.getByText('Delivering')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'January sign-up' })).toBeNull();
  });
});
