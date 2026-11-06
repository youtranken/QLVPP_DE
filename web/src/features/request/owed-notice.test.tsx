import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderWithI18n, screen } from '@/test/test-utils';
import viRequest from '@/locales/vi/request';
import viNotifications from '@/locales/vi/notifications';
import type { OwedPeriod } from './request.api';
import { OwedNotice } from './owed-notice';

afterEach(() => {
  void i18n.changeLanguage('vi');
});

const NOV: OwedPeriod = {
  ym: '2026-11',
  items: 1,
  units: 2,
  lines: [{ name: 'Bút bi', name_en: 'Ballpoint pen', unit: 'cay', qty: 2 }],
};
const DEC: OwedPeriod = {
  ym: '2026-12',
  items: 2,
  units: 3,
  lines: [
    { name: 'Băng keo', name_en: null, unit: 'cuon', qty: 1 },
    { name: 'Bìa còng', name_en: null, unit: 'cai', qty: 2 },
  ],
};

const show = (owed: OwedPeriod[]) =>
  renderWithI18n(
    <MemoryRouter>
      <OwedNotice owed={owed} />
    </MemoryRouter>,
  );

describe('OwedNotice — mọi kỳ còn chờ nhận', () => {
  it('Tháng 11 còn 2 Bút bi + Tháng 12 còn 2 món → một dải, link Xem → /history', () => {
    show([NOV, DEC]);
    expect(screen.getByText(/Bạn còn chờ nhận/)).toHaveTextContent(
      'Bạn còn chờ nhận Tháng 11: Bút bi 2 · Tháng 12: 2 món. Không cần đăng ký lại.',
    );
    expect(screen.getByRole('link', { name: 'Xem' })).toHaveAttribute('href', '/history');
  });

  it('chỉ một kỳ → link thẳng tới tháng đó', () => {
    show([DEC]);
    expect(screen.getByText(/Bạn còn chờ nhận/)).toHaveTextContent('Bạn còn chờ nhận Tháng 12: 2 món. Không cần đăng ký lại.');
    expect(screen.getByRole('link', { name: 'Xem' })).toHaveAttribute('href', '/history/2026-12');
  });

  it('tiếng Anh: tên món name_en; thiếu name_en thì tên vi', async () => {
    await i18n.changeLanguage('en');
    show([NOV, { ...DEC, items: 1, lines: [DEC.lines[0]] }]);
    expect(screen.getByText(/still waiting/)).toHaveTextContent(
      'You are still waiting for Month 11: Ballpoint pen 2 · Month 12: Băng keo 1. No need to order again.',
    );
  });

  it('không kỳ nào còn chờ → không hiện gì', () => {
    show([]);
    expect(screen.queryByText(/Bạn còn chờ nhận/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Xem' })).toBeNull();
  });
});

// Nhân viên chỉ thấy "còn chờ nhận"; "nợ" là chữ của Hành chính
describe('chữ phía nhân viên không có "nợ"', () => {
  const texts = (v: unknown): string[] =>
    typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(texts) : [];
  const hasDebt = (s: string) => /(^|[^\p{L}])nợ([^\p{L}]|$)/iu.test(s);
  const STAFF_BELLS = ['line_cancelled', 'line_cancelledNoReason', 'line_adjusted', 'request_delivered'];

  it('locales/vi/request.ts', () => {
    expect(texts(viRequest).filter(hasDebt)).toEqual([]);
  });

  it('chuông gửi nhân viên trong locales/vi/notifications.ts', () => {
    const { topics, fallback } = viNotifications.notifications as unknown as Record<string, Record<string, unknown>>;
    const staff = STAFF_BELLS.flatMap((k) => [...texts(topics[k]), ...texts(fallback[k])]);
    expect(staff.length).toBeGreaterThan(5);
    expect(staff.filter(hasDebt)).toEqual([]);
  });
});
