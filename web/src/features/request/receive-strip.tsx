import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { receiveRows, receiveSummary } from './receive-rows';
import { useMyRequest, type CurrentPeriod } from './request.api';
import { monthOf } from './request-format';

// Một dải duy nhất, cùng cách đếm "còn chờ" với Lịch sử; "Xem" mở thẳng Lịch sử tháng đó
export function ReceiveStrip({ period }: { period: CurrentPeriod }) {
  const { t, i18n } = useTranslation();
  const prev = period.previous?.delivering ? period.previous.ym : undefined;
  const request = useMyRequest(prev);
  const older = (period.owed ?? []).filter((o) => o.ym !== prev && o.items > 0);
  const sum = request.data ? receiveSummary(receiveRows(request.data, t, i18n.language)) : null;
  const main = prev && sum;
  if (!main && older.length === 0) return null;
  return (
    <div className="rq-recv-strip">
      <span className="rq-recv-dot" aria-hidden="true" />
      <p>
        {main && (
          <>
            <b>{t('request.receive.stripHead', { month: monthOf(prev) })}</b> ·{' '}
            {sum.waiting > 0 ? t('request.receive.stripWaiting', { count: sum.waiting }) : t('request.receive.stripDone')}
          </>
        )}
        {older.map((o, i) => (
          <span key={o.ym}>
            {(main || i > 0) && ' · '}
            <Link to={`/history/${o.ym}`}>{t('request.receive.older', { month: monthOf(o.ym), count: o.items })}</Link>
          </span>
        ))}
      </p>
      {main && (
        <Link className="rq-recv-open" to={`/history/${prev}`}>
          {t('request.receive.view')}
        </Link>
      )}
    </div>
  );
}
