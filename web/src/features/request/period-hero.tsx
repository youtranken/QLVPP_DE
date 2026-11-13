import { useTranslation } from 'react-i18next';
import type { CurrentPeriod, RequestView } from './request.api';
import { monthOf, useRequestFormat } from './request-format';

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
  const status = saved
    ? t('request.hero.saved', { time: fmt.time(saved.updated_at), date: fmt.lastDay(period.deadline) })
    : t('request.hero.notSaved');
  const sub = !period.is_open
    ? t('request.hero.subLocked', { month: monthOf(period.ym) })
    : t(last ? 'request.hero.subLast' : 'request.hero.sub', { date: fmt.lastDay(period.deadline), count: period.days_left });
  return (
    <section className="rq-hero" aria-labelledby="rq-hero-title">
      <div className="rq-hero-text">
        {/* tabIndex -1: chỗ đặt focus khi thanh lưu nổi biến mất (giỏ trống) — xem focusPageHeading */}
        <h1 id="rq-hero-title" tabIndex={-1}>{t('request.hero.title', { month: monthOf(period.ym) })}</h1>
        <p className="rq-sub">
          {sub}
          {last && period.is_open && <> <b className="rq-last">{t('request.hero.lastDay')}</b></>}
        </p>
        <p className="rq-status">
          {dirty && (
            <>
              <span className="rq-dot" aria-hidden="true" />
              <span className="sr-only">{t('request.hero.unsaved')}</span>
            </>
          )}
          <span>{status}</span>
        </p>
      </div>
    </section>
  );
}
