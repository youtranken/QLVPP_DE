import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState, LoadError, Loading } from '@/ui/load-state';
import { useCurrentPeriod } from './request.api';
import { deliveryState, useMyHistory, type HistoryItem } from './history.api';
import { IssuesSection } from './issues-section';
import './history.css';

const TONE = { done: 'tag--ok', owed: 'tag--warn', undelivered: '', cancelled: 'tag--danger', none: '' } as const;

export function DeliveryTag({ item }: { item: Pick<HistoryItem, 'total_qty' | 'delivered_qty' | 'remaining_qty'> }) {
  const { t } = useTranslation();
  const state = deliveryState(item);
  if (state === 'none') return null;
  return <span className={`tag ${TONE[state]}`}>{t(`request.history.delivery.${state}`, { k: item.remaining_qty })}</span>;
}

const customSummary = (c: HistoryItem['custom']) =>
  (['pending', 'accepted', 'converted', 'rejected'] as const).filter((k) => c[k] > 0).map((k) => ({ key: k, n: c[k] }));

function HistoryRow({ item, open }: { item: HistoryItem; open: boolean }) {
  const { t } = useTranslation();
  const [year, month] = item.period_ym.split('-');
  const custom = customSummary(item.custom);
  return (
    <li>
      <Link className="hs-row" to={open ? '/' : `/history/${item.period_ym}`}>
        <span className="hs-month">{t('request.history.month', { month: Number(month), year })}</span>
        <span className="hs-sum">{t('request.history.summary', { kinds: item.line_count, units: item.total_qty })}</span>
        {open ? <span className="tag tag--info">{t('request.history.open')}</span> : <DeliveryTag item={item} />}
        {custom.length > 0 && (
          <span className="hs-custom">
            {custom.map((c) => t(`request.history.customCount.${c.key}`, { n: c.n })).join(' · ')}
          </span>
        )}
      </Link>
    </li>
  );
}

export function HistoryPage() {
  const { t } = useTranslation();
  const history = useMyHistory();
  const period = useCurrentPeriod();
  const items = history.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="hs-page">
      <h1 className="page-title">{t('request.history.title')}</h1>
      {history.isPending ? (
        <Loading />
      ) : history.isError ? (
        <LoadError onRetry={() => void history.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={t('request.history.empty')}
          hint={t('request.history.emptyHint')}
          action={
            <Link className="btn btn--primary" to="/">
              {t('request.history.toRegister')}
            </Link>
          }
        />
      ) : (
        <>
          <ul className="hs-list">
            {items.map((item) => (
              <HistoryRow key={item.period_ym} item={item} open={!!period.data?.is_open && period.data.ym === item.period_ym} />
            ))}
          </ul>
          {history.hasNextPage && (
            <button type="button" className="btn hs-more" disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>
              {t('request.history.more')}
            </button>
          )}
        </>
      )}
      <IssuesSection />
    </div>
  );
}
