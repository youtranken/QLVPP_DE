import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState, LoadError, Loading } from '@/ui/load-state';
import { MemberPage } from '@/shell/member-page';
import { useCurrentPeriod } from './request.api';
import { deliveryState, useMyHistory, type DeliveryState, type HistoryItem } from './history.api';
import { Chip, type ChipTone } from './history-chip';
import { LatestLines } from './history-lines';
import { IssuesSection } from './issues-section';
import './history.m1.css';

const TONE: Record<DeliveryState, ChipTone> = { done: 'ok', owed: 'warn', undelivered: 'warn', cancelled: 'muted', none: 'muted' };

type TagItem = Pick<HistoryItem, 'line_count' | 'total_qty' | 'delivered_qty' | 'remaining_qty' | 'owed_line_count' | 'removed_all'>;

// "Còn chờ k món" đếm DÒNG còn chờ (cùng cách với OwedNotice); server đếm sẵn nên không tải phiếu từng tháng
export function DeliveryTag({ item }: { item: TagItem }) {
  const { t } = useTranslation();
  if (item.removed_all) return <Chip tone="muted">{t('request.history.delivery.removedAll')}</Chip>;
  const state = deliveryState(item);
  if (state === 'owed' || state === 'undelivered') {
    const k = item.owed_line_count;
    return <Chip tone="warn">{k > 0 ? t('request.history.delivery.owed', { k }) : t('request.history.delivery.waiting')}</Chip>;
  }
  // Chỉ có món chờ/từ chối (total 0) thì không có trạng thái giao; hết phiếu mới là "Không có phiếu"
  if (state === 'none' && item.line_count > 0) return null;
  return <Chip tone={TONE[state]}>{t(`request.history.delivery.${state}`)}</Chip>;
}

const customSummary = (c: HistoryItem['custom']) =>
  (['pending', 'accepted', 'converted', 'rejected'] as const).filter((k) => c[k] > 0).map((k) => ({ key: k, n: c[k] }));

function HistoryCard({ item, open, withLines }: { item: HistoryItem; open: boolean; withLines: boolean }) {
  const { t } = useTranslation();
  const [year, month] = item.period_ym.split('-');
  const custom = customSummary(item.custom);
  return (
    <li className="hs-card">
      <Link className="hs-row" to={open ? '/' : `/history/${item.period_ym}`}>
        <span className="hs-month">{t('request.history.month', { month: Number(month), year })}</span>
        <span className="hs-sum">{t('request.history.summary', { kinds: item.line_count, units: item.total_qty })}</span>
        {open ? <Chip tone="open">{t('request.history.open')}</Chip> : <DeliveryTag item={item} />}
        {custom.length > 0 && (
          <span className="hs-custom">
            {custom.map((c) => t(`request.history.customCount.${c.key}`, { n: c.n })).join(' · ')}
          </span>
        )}
      </Link>
      {withLines && <LatestLines ym={item.period_ym} />}
    </li>
  );
}

export function HistoryPage() {
  const { t } = useTranslation();
  const history = useMyHistory();
  const period = useCurrentPeriod();
  const items = history.data?.pages.flatMap((p) => p.items) ?? [];
  const isOpen = (ym: string) => !!period.data?.is_open && period.data.ym === ym;
  // Chưa biết kỳ đang mở thì chưa chọn tháng để liệt kê dòng (tránh vẽ sai rồi GET thừa phiếu kỳ đang mở)
  const latestClosed = period.isPending ? undefined : items.find((i) => !isOpen(i.period_ym) && i.line_count > 0)?.period_ym;
  return (
    <MemberPage title={t('request.history.title')} subtitle={t('request.history.subtitle')}>
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
              <HistoryCard key={item.period_ym} item={item} open={isOpen(item.period_ym)} withLines={item.period_ym === latestClosed} />
            ))}
          </ul>
          {history.hasNextPage && (
            <button type="button" className="hs-more" disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>
              {t('request.history.more')}
            </button>
          )}
        </>
      )}
      <IssuesSection />
    </MemberPage>
  );
}
