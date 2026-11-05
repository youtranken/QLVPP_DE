import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/lib/i18n';
import { jsonResponse, renderWithI18n, screen } from '@/test/test-utils';
import type { CurrentPeriod } from '@/features/request/request.api';
import { AdminPeriodCard } from '@/shell/admin-period-card';

const period = (days_left: number): CurrentPeriod => ({
  ym: '2026-11',
  deadline: '2026-11-10T17:00:00.000Z',
  is_open: true,
  days_left,
  previous: null,
});

afterEach(() => vi.unstubAllGlobals());

const stubSummary = (res: () => Response) => vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(res())));

const renderCard = (p: CurrentPeriod) =>
  renderWithI18n(
    <MemoryRouter>
      <AdminPeriodCard period={p} />
    </MemoryRouter>,
  );

describe('AdminPeriodCard', () => {
  it('ghi rõ "Kỳ đăng ký hiện tại" để không nhầm với tháng đang xem; days_left=2 → "còn 2 ngày · khóa 00:00 ngày 11/11", bấm về Tổng hợp kỳ', () => {
    renderCard(period(2));
    const card = screen.getByRole('link', { name: /^Kỳ đăng ký hiện tại: tháng 11 · đang mở/ });
    expect(card).toHaveTextContent('Kỳ tháng 11');
    expect(card).toHaveAttribute('href', '/admin/summary');
    expect(card).toHaveTextContent('còn 2 ngày · khóa 00:00 ngày 11/11');
    expect(card).not.toHaveTextContent('Hôm nay là ngày cuối');
  });

  it('có số đăng ký → "32/40 đã đăng ký" và thanh tiến độ 32/40', async () => {
    stubSummary(() => jsonResponse(200, { registered: 32, headcount: 40 }));
    renderCard(period(2));
    expect(await screen.findByText('32/40 đã đăng ký')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '32');
    expect(bar).toHaveAttribute('aria-valuemax', '40');
  });

  it('summary lỗi → không có thanh, vẫn thấy "Kỳ tháng 11" và hạn', async () => {
    const f = vi.fn(() => Promise.resolve(jsonResponse(500, null)));
    vi.stubGlobal('fetch', f);
    renderCard(period(2));
    await vi.waitFor(() => expect(f).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText('Kỳ tháng 11')).toBeInTheDocument();
    expect(screen.getByText(/còn 2 ngày/)).toBeInTheDocument();
  });

  it('headcount 0 → không có thanh (không chia 0)', async () => {
    const f = vi.fn(() => Promise.resolve(jsonResponse(200, { registered: 0, headcount: 0 })));
    vi.stubGlobal('fetch', f);
    renderCard(period(2));
    await vi.waitFor(() => expect(f).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText(/đã đăng ký/)).toBeNull();
  });

  it('days_left=1 → "Hôm nay là ngày cuối · khóa 00:00 ngày 11/11"', () => {
    renderCard(period(1));
    const card = screen.getByRole('link', { name: /^Kỳ đăng ký hiện tại: tháng 11 · đang mở/ });
    expect(card).toHaveTextContent('Hôm nay là ngày cuối · khóa 00:00 ngày 11/11');
    expect(card).not.toHaveTextContent('còn 1 ngày');
  });

  it('tiếng Anh: tiêu đề và hạn đổi theo ngôn ngữ', async () => {
    await i18n.changeLanguage('en');
    try {
      renderCard(period(2));
      expect(screen.getByRole('link', { name: /^Current sign-up period: month 11 · open/ })).toHaveTextContent('2 days left · locks 00:00 on 11/11');
    } finally {
      await i18n.changeLanguage('vi');
    }
  });
});
