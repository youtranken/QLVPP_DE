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
      {/* Có nhóm được chọn thì trạng thái chọn + nút nhận hàng loạt THẾ CHỖ dòng đếm "Đang hiện x/y" ở cuối hàng ô tìm:
          cùng một ô, cùng chiều cao → tick/bỏ tick không đẩy chip và bảng xuống */}
      <div className="toolbar ar-tools">
        <SearchBox urlParam="q" className="flt-search" label={t('arrivals.filter.search')} placeholder={t('arrivals.filter.search')} value={filter.q} onChange={(q) => onFilter({ q: q || null })} />
        <Switch checked={filter.short} text={t('arrivals.filter.short', { n: shortCount })} onChange={(on) => onFilter({ short: on ? '1' : null })} />
        <ListMeta>
          {/* Màn rộng: ô này chỉ hiện một trong hai. Màn điện thoại thanh nhận hàng loạt nổi ở đáy nên dòng đếm vẫn ở lại, khỏi để trống một hàng */}
          <p className={batch.groups > 0 ? 'ar-count ar-count--picked' : 'ar-count'} aria-live="polite">
            {t('arrivals.filter.count', { x: shown, y: total })}
          </p>
          {batch.groups > 0 && (
            <div className="ar-save">
              <span className="ar-batch" aria-live="polite">
                {t('arrivals.batchPicked', { g: batch.groups, n: batch.items })}
              </span>
              <button type="button" className="btn btn--primary" disabled={saveDisabled} onClick={onSave}>
                {t(batch.partial ? 'arrivals.receivePickedPartial' : 'arrivals.receivePicked', { n: batch.groups })}
              </button>
            </div>
          )}
        </ListMeta>
      </div>
      <GroupChips
        className="flt-chips"
        fade
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
