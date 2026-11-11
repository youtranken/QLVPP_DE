import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatVnStamp } from '@/lib/format-time';
import { GroupChips, ALL_GROUPS, type ChipGroup } from '@/ui/filter/group-chips';
import { SearchBox } from '@/ui/filter/search-box';
import { ListMeta } from '@/ui/list-meta';
import { Switch } from '@/ui/switch';
import { printPath } from '@/features/reports/reports.api';
import type { ArrivalFilter } from './arrival-rows';
import type { ArrivalsPlan } from './arrivals.api';

interface Props {
  // Bảng nhận chỉ hiện khi kỳ đã gửi NCC: luôn có bản in làm nguồn
  snapshot: NonNullable<ArrivalsPlan['snapshot']>;
  filter: ArrivalFilter;
  groups: ChipGroup[];
  counts: ReadonlyMap<string, number>;
  total: number;
  shown: number;
  shortCount: number;
  reducedCount: number;
  // partial: có nhóm đã tick không nhận đủ được → nút ghi "Nhận hàng"
  batch: { groups: number; items: number; partial: boolean };
  saveDisabled: boolean;
  onFilter: (patch: Record<string, string | null>) => void;
  onSave: () => void;
}

export function ArrivalsToolbar({ snapshot, filter, groups, counts, total, shown, shortCount, reducedCount, batch, saveDisabled, onFilter, onSave }: Props) {
  const { t } = useTranslation();
  return (
    <div className="ar-bar">
      <div className="ar-bar__row">
        <div className="ar-source">
          <Link to={printPath(snapshot.id)}>{t('arrivals.source', { time: formatVnStamp(snapshot.created_at) })}</Link>
          {reducedCount > 0 && <p className="ar-warn-text">{t('warn.W14head', { x: reducedCount })}</p>}
        </div>
        <div className="ar-save">
          <span className="ar-batch">{t('arrivals.batchPicked', { g: batch.groups, n: batch.items })}</span>
          <button type="button" className="btn btn--primary" disabled={saveDisabled} onClick={onSave}>
            {t(batch.partial ? 'arrivals.receivePickedPartial' : 'arrivals.receivePicked', { n: batch.groups })}
          </button>
        </div>
      </div>
      <div className="ar-bar__row">
        <SearchBox className="flt-search" label={t('arrivals.filter.search')} placeholder={t('arrivals.filter.search')} value={filter.q} onChange={(q) => onFilter({ q: q || null })} />
        <Switch checked={filter.short} text={t('arrivals.filter.short', { n: shortCount })} onChange={(on) => onFilter({ short: on ? '1' : null })} />
        <ListMeta>
          <p className="ar-count" aria-live="polite">
            {t('arrivals.filter.count', { x: shown, y: total })}
          </p>
        </ListMeta>
      </div>
      <GroupChips
        className="flt-chips"
        chipClassName="flt-chip"
        countClassName="flt-cnt"
        label={t('arrivals.filter.groups')}
        allLabel={t('arrivals.filter.all')}
        total={total}
        groups={groups}
        counts={counts}
        value={filter.g ?? ALL_GROUPS}
        onChange={(g) => onFilter({ g: g === ALL_GROUPS ? null : g })}
      />
    </div>
  );
}
