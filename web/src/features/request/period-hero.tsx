import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { CurrentPeriod, RequestView } from './request.api';
import { monthOf, useRequestFormat } from './request-format';

export function PeriodHero({
  period,
  saved,
  dirty,
  action,
}: {
  period: CurrentPeriod;
  saved: RequestView | null;
  dirty: boolean;
  action?: ReactNode;
}) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const status = saved
    ? t('request.hero.saved', { time: fmt.time(saved.updated_at), date: fmt.lastDay(period.deadline) })
    : t('request.hero.notSaved');
  return (
    <section className="rq-hero">
      <div className="rq-hero-text">
        <h1>{t('request.hero.title', { month: monthOf(period.ym) })}</h1>
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
      {action}
      <div className="rq-days">
        {period.days_left <= 1 ? (
          <span className="rq-days-last">{t('request.hero.lastDay')}</span>
        ) : (
          <>
            <b className="num">{period.days_left}</b>
            <span>{t('request.hero.daysLeft')}</span>
          </>
        )}
      </div>
    </section>
  );
}
