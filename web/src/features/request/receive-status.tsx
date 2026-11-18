import { useTranslation } from 'react-i18next';
import type { ReceiveRow } from './receive-rows';

export function ReceiveStatus({ row }: { row: ReceiveRow }) {
  const { t } = useTranslation();
  if (row.state === 'paused') return <span className="rq-recv-st is-none">{t('common.paused')}</span>;
  if (row.state === 'none') return <span className="rq-recv-st is-none">{t('request.receive.none')}</span>;
  if (row.state === 'received') return <span className="rq-recv-st is-ok">{t('request.receive.received', { a: row.received, b: row.toGive })}</span>;
  return <span className="rq-recv-st is-wait">{t('request.receive.waiting', { n: row.waiting })}</span>;
}
