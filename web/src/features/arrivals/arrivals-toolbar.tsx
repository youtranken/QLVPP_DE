import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatVnStamp } from '@/lib/format-time';
import { GroupChips, ALL_GROUPS, type ChipGroup } from '@/ui/filter/group-chips';
import { GroupedCombobox, type ComboOption } from '@/ui/filter/grouped-combobox';
import { SearchBox } from '@/ui/filter/search-box';
import { Switch } from '@/ui/switch';
import { printPath } from '@/features/reports/reports.api';
import type { ArrivalFilter } from './arrival-rows';
import type { ArrivalsPlan } from './arrivals.api';

interface Props {
  plan: ArrivalsPlan;
  filter: ArrivalFilter;
  groups: ChipGroup[];
  counts: ReadonlyMap<string, number>;
  total: number;
  shown: number;
  shortCount: number;
  reducedCount: number;
  batch: { items: number; units: number };
  saveDisabled: boolean;
  candidates: ComboOption[];
  onFilter: (patch: Record<string, string | null>) => void;
  onSave: () => void;
  onAdd: (id: string) => void;
}

export function ArrivalsToolbar({ plan, filter, groups, counts, total, shown, shortCount, reducedCount, batch, saveDisabled, candidates, onFilter, onSave, onAdd }: Props) {
  const { t } = useTranslation();
  return (
    <div className="ar-bar">
      <div className="ar-bar__row">
        <div className="ar-source">
          {plan.snapshot ? (
            <Link to={printPath(plan.snapshot.id)}>{t('arrivals.source', { time: formatVnStamp(plan.snapshot.created_at) })}</Link>
          ) : plan.no_order ? (
            <p className="ar-note-line">{t('arrivals.noOrder', { time: formatVnStamp(plan.no_order.at) })}</p>
          ) : (
            <p className="ar-note-line">{t('arrivals.noSnapshot')}</p>
          )}
          {reducedCount > 0 && <p className="ar-warn-text">{t('warn.W14head', { x: reducedCount })}</p>}
        </div>
        <div className="ar-save">
          <span className="ar-batch">{t('arrivals.batch', { n: batch.items, u: batch.units })}</span>
          <button type="button" className="btn btn--primary" disabled={saveDisabled} onClick={onSave}>
            {t('arrivals.save')}
          </button>
        </div>
      </div>
      <div className="ar-bar__row">
        <SearchBox className="flt-search" label={t('arrivals.filter.search')} placeholder={t('arrivals.filter.search')} value={filter.q} onChange={(q) => onFilter({ q: q || null })} />
        <Switch checked={filter.short} text={t('arrivals.filter.short', { n: shortCount })} onChange={(on) => onFilter({ short: on ? '1' : null })} />
        <GroupedCombobox options={candidates} onPick={onAdd} label={t('arrivals.add.search')} placeholder={t('arrivals.add.search')} noMatch={t('arrivals.add.noMatch')} />
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
      <p className="ar-legend">{t('arrivals.status.legend')}</p>
      <p className="ar-count" aria-live="polite">
        {t('arrivals.filter.count', { x: shown, y: total })}
      </p>
    </div>
  );
}
