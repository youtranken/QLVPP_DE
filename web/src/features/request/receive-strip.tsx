import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ReceiveDialog } from './receive-dialog';
import { receiveRows, receiveSummary } from './receive-rows';
import { useMyRequest, type CurrentPeriod } from './request.api';
import { monthOf } from './request-format';

// Một dải duy nhất: phiếu kỳ trước đang giao (mở popup nhận hàng) + các tháng cũ hơn còn chờ là liên kết (D7)
export function ReceiveStrip({ period }: { period: CurrentPeriod }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
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
        {main && t('request.receive.strip', { month: monthOf(prev), ...sum })}
        {older.map((o, i) => (
          <span key={o.ym}>
            {(main || i > 0) && ' · '}
            <Link to={`/history/${o.ym}`}>{t('request.receive.older', { month: monthOf(o.ym), k: o.items })}</Link>
          </span>
        ))}
      </p>
      {main && (
        <button type="button" className="rq-recv-open" onClick={() => setOpen(true)}>
          {t('request.receive.view')}
        </button>
      )}
      {open && prev && <ReceiveDialog ym={prev} onClose={() => setOpen(false)} />}
    </div>
  );
}
