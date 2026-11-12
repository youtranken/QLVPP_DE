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

// Dòng phụ dưới tiêu đề: nguồn đối chiếu là bản in đã gửi NCC; chỉ cụm "Xem bản in" là liên kết
export function ArrivalsSource({ snapshot }: { snapshot: NonNullable<ArrivalsPlan['snapshot']> }) {
  const { t } = useTranslation();
  return (
    <>
      {t('arrivals.sourceAt', { time: formatVnStamp(snapshot.created_at) })} · <Link to={printPath(snapshot.id)}>{t('arrivals.sourcePrint')}</Link>
    </>
  );
}

export function ArrivalsToolbar({ filter, groups, counts, total, shown, shortCount, reducedCount, batch, saveDisabled, onFilter, onSave }: Props) {
  const { t } = useTranslation();
  return (
    <div className="ar-bar">
      {reducedCount > 0 && <p className="ar-warn-text">{t('warn.W14head', { x: reducedCount })}</p>}
      {/* Chọn nhóm rồi mới hiện trạng thái chọn + nút nhận hàng loạt, cùng hàng với ô tìm: không chiếm một hàng trống */}
      <div className="toolbar ar-tools">
        <SearchBox className="flt-search" label={t('arrivals.filter.search')} placeholder={t('arrivals.filter.search')} value={filter.q} onChange={(q) => onFilter({ q: q || null })} />
        <Switch checked={filter.short} text={t('arrivals.filter.short', { n: shortCount })} onChange={(on) => onFilter({ short: on ? '1' : null })} />
        <ListMeta>
          <p className="ar-count" aria-live="polite">
            {t('arrivals.filter.count', { x: shown, y: total })}
          </p>
        </ListMeta>
        {batch.groups > 0 && (
          <div className="ar-save">
            <span className="ar-batch">{t('arrivals.batchPicked', { g: batch.groups, n: batch.items })}</span>
            <button type="button" className="btn btn--primary" disabled={saveDisabled} onClick={onSave}>
              {t(batch.partial ? 'arrivals.receivePickedPartial' : 'arrivals.receivePicked', { n: batch.groups })}
            </button>
          </div>
        )}
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
