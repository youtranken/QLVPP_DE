import { describe, expect, it } from 'vitest';
import { renderWithI18n, screen } from '@/test/test-utils';
import { PERIOD } from '@/test/request-api-stub';
import { PeriodHero } from './period-hero';

const hero = (days_left: number) =>
  renderWithI18n(<PeriodHero period={{ ...PERIOD, days_left }} saved={null} dirty={false} />);

describe('PeriodHero — số ngày còn lại', () => {
  it('days_left 2 → "2 ngày còn lại", chưa báo ngày cuối', () => {
    hero(2);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('ngày còn lại')).toBeInTheDocument();
    expect(screen.queryByText('Hôm nay là ngày cuối')).toBeNull();
  });

  it('days_left 1 → "Hôm nay là ngày cuối", không hiện số ngày', () => {
    hero(1);
    expect(screen.getByText('Hôm nay là ngày cuối')).toBeInTheDocument();
    expect(screen.queryByText('ngày còn lại')).toBeNull();
  });
});
