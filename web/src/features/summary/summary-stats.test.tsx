import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { SummaryStats } from './summary-stats';
import { LOCKED, OPEN } from './summary-fixtures';
import type { PeriodSummary } from './summary.api';

const renderStats = (summary: PeriodSummary, props: Partial<Parameters<typeof SummaryStats>[0]> = {}) => {
  const onFilter = vi.fn();
  renderWithI18n(<SummaryStats summary={summary} outCount={2} filter={null} onFilter={onFilter} {...props} />);
  return onFilter;
};

describe('SummaryStats — 4 thẻ số liệu', () => {
  it('kỳ cũ registered=5 > headcount=4, unregistered=0 → "5/4", "0 chưa đăng ký", thanh đăng ký đầy đúng 100%', () => {
    renderStats({ ...LOCKED, registered: 5, headcount: 4, unregistered: 0 });
    const card = screen.getByRole('button', { name: /Phiếu đã đăng ký/ });
    expect(card).toHaveTextContent('5/4');
    expect(card).toHaveTextContent('0 chưa đăng ký');
    expect(card).not.toHaveTextContent('-1');
    const meter = card.querySelector('[data-meter] > span') as HTMLElement;
    expect(meter.style.width).toBe('100%');
  });

  it('registered=3, headcount=4 → thanh 75%; headcount=0 → thanh 0%, không NaN', () => {
    const { unmount } = renderWithI18n(<SummaryStats summary={{ ...OPEN, registered: 3, headcount: 4 }} outCount={0} filter={null} onFilter={() => {}} />);
    expect((document.querySelector('[data-meter] > span') as HTMLElement).style.width).toBe('75%');
    unmount();
    renderStats({ ...OPEN, registered: 0, headcount: 0, unregistered: 0 });
    expect((document.querySelector('[data-meter] > span') as HTMLElement).style.width).toBe('0%');
  });

  it('bấm thẻ đã lọc thì gọi onFilter cùng giá trị (trang tự bật/tắt); aria-pressed theo filter', async () => {
    const onFilter = renderStats(LOCKED, { filter: 'pending_delivery' });
    const card = screen.getByRole('button', { name: /Dòng chờ giao/ });
    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(card).toHaveTextContent('12');
    await userEvent.click(card);
    expect(onFilter).toHaveBeenCalledWith('pending_delivery');
  });

  it('kỳ mở: "Dòng chờ giao" là div (không button), số "—", "giao sau khi khóa 00:00 ngày 11/11"', () => {
    renderStats(OPEN);
    expect(screen.queryByRole('button', { name: /Dòng chờ giao/ })).toBeNull();
    const sub = screen.getByText('giao sau khi khóa 00:00 ngày 11/11');
    expect(sub.closest('.stat-card')?.tagName).toBe('DIV');
    expect(sub.closest('.stat-card')).toHaveTextContent('—');
  });

  it('"Món ngoài danh mục chờ xem" 3 món, "xem ở mục riêng" → custom_pending; "Món sắp hết" 4 · 2 hết hàng → low', async () => {
    const onFilter = renderStats(OPEN);
    const custom = screen.getByRole('button', { name: /Món ngoài danh mục chờ xem/ });
    expect(custom).toHaveTextContent('3');
    expect(custom).toHaveTextContent('xem ở mục riêng');
    await userEvent.click(custom);
    expect(onFilter).toHaveBeenLastCalledWith('custom_pending');
    const low = screen.getByRole('button', { name: /Món sắp hết/ });
    expect(low).toHaveTextContent('4');
    expect(low).toHaveTextContent('2 hết hàng');
    await userEvent.click(low);
    expect(onFilter).toHaveBeenLastCalledWith('low');
    await userEvent.click(screen.getByRole('button', { name: /Phiếu đã đăng ký/ }));
    expect(onFilter).toHaveBeenLastCalledWith('unregistered');
  });
});
