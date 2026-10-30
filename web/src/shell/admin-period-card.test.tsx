import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/lib/i18n';
import { renderWithI18n, screen } from '@/test/test-utils';
import type { CurrentPeriod } from '@/features/request/request.api';
import { AdminPeriodCard } from '@/shell/admin-period-card';

const period = (days_left: number): CurrentPeriod => ({
  ym: '2026-11',
  deadline: '2026-11-10T17:00:00.000Z',
  is_open: true,
  days_left,
  previous: null,
});

const renderCard = (p: CurrentPeriod) =>
  renderWithI18n(
    <MemoryRouter>
      <AdminPeriodCard period={p} />
    </MemoryRouter>,
  );

describe('AdminPeriodCard', () => {
  it('days_left=2 → "còn 2 ngày · khóa 00:00 ngày 11/11", bấm về Tổng hợp kỳ', () => {
    renderCard(period(2));
    const card = screen.getByRole('link', { name: /Kỳ tháng 11 đang mở/ });
    expect(card).toHaveAttribute('href', '/admin/summary');
    expect(card).toHaveTextContent('còn 2 ngày · khóa 00:00 ngày 11/11');
    expect(card).not.toHaveTextContent('Hôm nay là ngày cuối');
  });

  it('days_left=1 → "Hôm nay là ngày cuối · khóa 00:00 ngày 11/11"', () => {
    renderCard(period(1));
    const card = screen.getByRole('link', { name: /Kỳ tháng 11 đang mở/ });
    expect(card).toHaveTextContent('Hôm nay là ngày cuối · khóa 00:00 ngày 11/11');
    expect(card).not.toHaveTextContent('còn 1 ngày');
  });

  it('tiếng Anh: tiêu đề và hạn đổi theo ngôn ngữ', async () => {
    await i18n.changeLanguage('en');
    try {
      renderCard(period(2));
      expect(screen.getByRole('link', { name: /Period 11 is open/ })).toHaveTextContent('2 days left · locks 00:00 on 11/11');
    } finally {
      await i18n.changeLanguage('vi');
    }
  });
});
