import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/icon';
import { CUSTOM_STATUSES, type HistoryItem } from './history.api';
import { Chip } from './history-chip';
import { DeliveryTag } from './history-delivery-tag';
import { historyYearGroups } from './history-year-groups';
import { IssuesSection } from './issues-section';

const customSummary = (c: HistoryItem['custom']) => CUSTOM_STATUSES.filter((k) => c[k] > 0).map((k) => ({ key: k, n: c[k] }));

function MasterItem({ item, open, selected }: { item: HistoryItem; open: boolean; selected: boolean }) {
  const { t } = useTranslation();
  const custom = customSummary(item.custom);
  return (
    <li>
      <Link className="hs-m-row" to={open ? '/' : `/history/${item.period_ym}`} aria-current={selected ? 'page' : undefined}>
        <span className="hs-month">{t('request.history.monthShort', { month: Number(item.period_ym.slice(5)) })}</span>
        <span className="hs-sum">{t('request.history.masterSum', { count: item.catalog.line_count, units: t('request.unitCount', { count: item.catalog.qty }) })}</span>
        {open ? <Chip tone="open">{t('request.history.open')}</Chip> : <DeliveryTag item={item} />}
        {custom.length > 0 && <span className="hs-custom">{custom.map((c) => t(`request.history.customCount.${c.key}`, { count: c.n })).join(' · ')}</span>}
        <Icon name="chevr" className="hs-m-chev" size={18} />
      </Link>
    </li>
  );
}

interface Props {
  items: HistoryItem[];
  selected: string | undefined;
  isOpen: (ym: string) => boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
}

// Cột trái Lịch sử: năm → tháng có phiếu, rồi Nhận lẻ
export function HistoryMaster({ items, selected, isOpen, hasMore, loadingMore, onMore }: Props) {
  const { t } = useTranslation();
  return (
    <nav className="hs-master" aria-label={t('request.history.title')}>
      {historyYearGroups(items).map((g) => (
        <section key={g.year} className="hs-year" aria-labelledby={`hs-year-${g.year}`}>
          <h2 id={`hs-year-${g.year}`} className="hs-year-title">
            {g.year}
          </h2>
          <ul className="hs-m-list">
            {g.items.map((item) => (
              <MasterItem key={item.period_ym} item={item} open={isOpen(item.period_ym)} selected={item.period_ym === selected} />
            ))}
          </ul>
        </section>
      ))}
      {hasMore && (
        <button type="button" className="hs-more" disabled={loadingMore} onClick={onMore}>
          {t('request.history.more')}
        </button>
      )}
      <IssuesSection />
    </nav>
  );
}
