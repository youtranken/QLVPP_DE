import { useTranslation } from 'react-i18next';
import type { CurrentPeriod, RequestView } from './request.api';
import { monthOf, useRequestFormat } from './request-format';

// Kỳ khác năm hôm nay (tháng 11 đăng ký kỳ 1 năm sau) thì ghi năm để không nhầm tháng 1 năm nay
function monthYearOf(ym: string): string {
  const year = Number(ym.slice(0, 4));
  return year === new Date().getFullYear() ? String(monthOf(ym)) : `${monthOf(ym)}/${year}`;
}

export function PeriodHero({
  period,
  saved,
  dirty,
}: {
  period: CurrentPeriod;
  saved: RequestView | null;
  dirty: boolean;
}) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const last = period.days_left <= 1;
  const status = dirty
    ? t('request.hero.unsaved')
    : saved
    ? t('request.hero.saved', { time: fmt.time(saved.updated_at) })
    : t('request.hero.notSaved');
  const sub = !period.is_open
    ? t('request.hero.subLocked', { month: monthOf(period.ym) })
    : t(last ? 'request.hero.subLast' : 'request.hero.sub', { date: fmt.lastDay(period.deadline), count: period.days_left });
  return (
    <section className="rq-hero" aria-labelledby="rq-hero-title">
      <div className="rq-hero-text">
        {/* tabIndex -1: chỗ đặt focus khi thanh lưu nổi biến mất (giỏ trống) — xem focusPageHeading */}
        <h1 id="rq-hero-title" tabIndex={-1}>{t('request.hero.title', { month: monthYearOf(period.ym) })}</h1>
        <p className="rq-sub">
          {sub}
          {last && period.is_open && <> <b className="rq-last">{t('request.hero.lastDay')}</b></>}
        </p>
        <p className="rq-status">
          {dirty && <span className="rq-dot" aria-hidden="true" />}
          <span>{status}</span>
        </p>
      </div>
    </section>
  );
}
