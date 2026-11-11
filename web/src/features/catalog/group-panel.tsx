import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { compareItems, orderKeyOf } from '@/lib/item-order';
import { matches } from '@/lib/search';
import { SearchBox } from '@/ui/filter/search-box';
import { ItemThumb } from '@/ui/item-thumb';
import { EmptyState, LoadError, Loading } from '@/ui/load-state';
import { OverlayPanel, type PanelNav } from '@/ui/overlay-panel';
import { usePanelToast } from '@/ui/panel-toast';
import type { ToastSpec } from '@/ui/toast-context';
import { Switch } from '@/ui/switch';
import type { Tone } from '@/lib/group-tone';
import { useUnitNames } from '@/features/units/units.api';
import { categoryLabel, type AdminItem, type Category } from './catalog.api';
import { ItemActiveSwitch } from './item-active-switch';

const SEARCH_FROM = 13;
const UNDO_MS = 5000;

interface Props {
  group: Category;
  tone: Tone;
  items: AdminItem[];
  loading: boolean;
  loadError: boolean;
  onRetry: () => void;
  busy: boolean;
  error: string | null;
  onToggleGroup: (c: Category, notify: (t: ToastSpec) => void) => void;
  onClose: () => void;
  refresh: () => Promise<unknown>;
  nav?: Omit<PanelNav, 'prevLabel' | 'nextLabel'>;
}

function useGroupItems(group: Category, items: AdminItem[]) {
  return useMemo(() => {
    const cats = new Map([[group.id, group]]);
    return items
      .filter((i) => i.category_id === group.id)
      .sort((a, b) => compareItems(orderKeyOf(a, cats), orderKeyOf(b, cats)));
  }, [group, items]);
}

export function GroupPanel({ group, tone, items, loading, loadError, onRetry, busy, error, onToggleGroup, onClose, refresh, nav }: Props) {
  const { t, i18n } = useTranslation();
  const unitName = useUnitNames();
  const hintId = useId();
  const [q, setQ] = useState('');
  const toast = usePanelToast(UNDO_MS);
  const all = useGroupItems(group, items);
  const shown = all.filter((i) => matches(i, q));
  const title = t('catalog.categories.panelTitle', { name: categoryLabel(group, i18n.language) });
  return (
    <OverlayPanel
      open
      onClose={onClose}
      title={title}
      saving={busy}
      nav={nav && { ...nav, prevLabel: t('catalog.categories.prevGroup'), nextLabel: t('catalog.categories.nextGroup') }}
    >
      <div className="gp">
        <div className="gp-head">
          <Switch
            checked={group.active}
            label={title}
            text={t(group.active ? 'catalog.categories.itemActive' : 'catalog.categories.itemInactive')}
            disabled={busy}
            onChange={() => onToggleGroup(group, toast.show)}
          />
          {!group.active && (
            <p id={hintId} className="gp-hint">
              {t('catalog.categories.enableGroupFirst')}
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="alert alert--danger">
            {error}
          </p>
        )}
        {all.length >= SEARCH_FROM && <SearchBox className="flt-search" value={q} onChange={setQ} label={t('catalog.list.search', { n: all.length })} placeholder={t('catalog.list.search', { n: all.length })} />}
        {loadError ? (
          <LoadError onRetry={onRetry} />
        ) : loading ? (
          <Loading />
        ) : all.length === 0 ? (
          <EmptyState
            title={t('catalog.categories.empty')}
            action={
              <Link className="btn" to="/admin/catalog">
                {t('catalog.title')}
              </Link>
            }
          />
        ) : (
          <ul className="gp-list">
            {shown.map((item) => {
              const name = categoryLabel(item, i18n.language);
              return (
                <li key={item.id} className="gp-row">
                  <ItemThumb fileId={item.image_file_id} alt={name} tone={tone} size={40} />
                  <span className="gp-row__text">
                    <span className="gp-row__name">{name}</span>
                    <small className="gp-row__unit">{unitName(item.unit)}</small>
                  </span>
                  <ItemActiveSwitch item={item} name={name} groupActive={group.active} hintId={hintId} refresh={refresh} notify={toast.show} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {toast.host}
    </OverlayPanel>
  );
}
