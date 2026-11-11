import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconChevronRight } from '@/ui/icons';
import type { HistoryItem } from './history.api';
import { Chip } from './history-chip';
import { DeliveryTag } from './history-delivery-tag';
import { historyYearGroups } from './history-year-groups';
import { IssuesSection } from './issues-section';

const customSummary = (c: HistoryItem['custom']) =>
  (['pending', 'accepted', 'converted', 'rejected'] as const).filter((k) => c[k] > 0).map((k) => ({ key: k, n: c[k] }));

// Số món chỉ đếm món trong danh mục; món ngoài danh mục đã có dòng riêng (hs-custom) nên không cộng hai lần
const catalogCount = (item: Pick<HistoryItem, 'line_count' | 'custom'>) =>
  Math.max(0, item.line_count - item.custom.pending - item.custom.accepted - item.custom.converted - item.custom.rejected);

function MasterItem({ item, open, selected }: { item: HistoryItem; open: boolean; selected: boolean }) {
  const { t } = useTranslation();
  const custom = customSummary(item.custom);
  return (
    <li>
      <Link className="hs-m-row" to={open ? '/' : `/history/${item.period_ym}`} aria-current={selected ? 'page' : undefined}>
        <span className="hs-month">{t('request.history.monthShort', { month: Number(item.period_ym.slice(5)) })}</span>
        <span className="hs-sum">{t('request.history.masterSum', { kinds: catalogCount(item), units: item.total_qty })}</span>
        {open ? <Chip tone="open">{t('request.history.open')}</Chip> : <DeliveryTag item={item} />}
        {custom.length > 0 && <span className="hs-custom">{custom.map((c) => t(`request.history.customCount.${c.key}`, { n: c.n })).join(' · ')}</span>}
        <IconChevronRight className="hs-m-chev" width={18} height={18} />
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
