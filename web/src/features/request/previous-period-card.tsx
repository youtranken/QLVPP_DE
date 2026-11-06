import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMyRequest, type CurrentPeriod, type LineView } from './request.api';
import { counted, monthOf } from './request-format';

const done = (l: LineView) => l.delivered_qty + l.cancelled_qty >= l.qty;

export function PreviousPeriodCard({ previous }: { previous: CurrentPeriod['previous'] }) {
  const { t } = useTranslation();
  const delivering = !!previous?.delivering;
  const request = useMyRequest(delivering ? previous!.ym : undefined);
  if (!delivering || !request.data) return null;
  const lines = request.data.lines.filter(counted);
  return (
    <Link className="rq-prev" to={`/history/${previous!.ym}`}>
      <span className="rq-prev-dot" aria-hidden="true" />
      <span>
        {t('request.hero.previous', {
          month: monthOf(previous!.ym),
          done: lines.filter(done).length,
          total: lines.length,
        })}
      </span>
      <span>{t('request.hero.previousAction')} →</span>
    </Link>
  );
}
