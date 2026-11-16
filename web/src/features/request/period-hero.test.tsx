import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen } from '@/test/test-utils';
import { PERIOD } from '@/test/request-api-stub';
import { PeriodHero } from './period-hero';

const hero = (days_left: number) =>
  renderWithI18n(<PeriodHero period={{ ...PERIOD, days_left }} saved={null} dirty={false} />);

describe('PeriodHero — số ngày còn lại', () => {
  it('days_left 2 → câu "…còn 2 ngày.", chưa báo ngày cuối', () => {
    hero(2);
    expect(screen.getByText('Chọn món, bấm Lưu phiếu. Bạn sửa được tới 23:59 ngày 10/11, còn 2 ngày.')).toBeInTheDocument();
    expect(screen.queryByText('Hôm nay là ngày cuối')).toBeNull();
  });

  it('days_left 1 → "Hôm nay là ngày cuối", không hiện số ngày', () => {
    hero(1);
    expect(screen.getByText('Hôm nay là ngày cuối')).toBeInTheDocument();
    expect(screen.queryByText(/còn 1 ngày/)).toBeNull();
  });

  it('days_left 6 → "còn 6 ngày"; h1 là "Đăng ký văn phòng phẩm tháng 11"', () => {
    hero(6);
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng ký văn phòng phẩm tháng 11' })).toBeInTheDocument();
    expect(screen.getByText(/còn 6 ngày\./)).toBeInTheDocument();
  });

  it('kỳ khóa (is_open false) → "Kỳ tháng 11 đã khóa sổ — phiếu chỉ xem."', () => {
    renderWithI18n(<PeriodHero period={{ ...PERIOD, is_open: false, days_left: 0 }} saved={null} dirty={false} />);
    expect(screen.getByText('Kỳ tháng 11 đã khóa sổ — phiếu chỉ xem.')).toBeInTheDocument();
    expect(screen.queryByText(/còn 0 ngày/)).toBeNull();
  });
});

describe('PeriodHero — năm và trạng thái lưu', () => {
  afterEach(() => vi.useRealTimers());

  it('kỳ 2027-01 khi hôm nay 11/2026 → "tháng 1/2027"; kỳ 2026-12 cùng năm → "tháng 12" (không ghi năm)', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-16T03:00:00Z') });
    const { unmount } = renderWithI18n(<PeriodHero period={{ ...PERIOD, ym: '2027-01' }} saved={null} dirty={false} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng ký văn phòng phẩm tháng 1/2027' })).toBeInTheDocument();
    unmount();
    renderWithI18n(<PeriodHero period={{ ...PERIOD, ym: '2026-12' }} saved={null} dirty={false} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng ký văn phòng phẩm tháng 12' })).toBeInTheDocument();
  });

  it('đã lưu nhưng đang sửa → hiện "Có thay đổi chưa lưu", không còn "Đã lưu …"; không sửa → "Đã lưu …"', () => {
    const saved = { updated_at: '2026-11-05T11:32:00Z' } as never;
    const { unmount } = renderWithI18n(<PeriodHero period={PERIOD} saved={saved} dirty />);
    expect(screen.getByText('Có thay đổi chưa lưu')).toBeVisible();
    expect(screen.queryByText(/Đã lưu/)).toBeNull();
    unmount();
    renderWithI18n(<PeriodHero period={PERIOD} saved={saved} dirty={false} />);
    expect(screen.getByText(/^Đã lưu 18:32/)).toBeInTheDocument();
  });
});
