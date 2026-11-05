import { useTranslation } from 'react-i18next';
import { CATALOG_TABS, type CatalogTab, type CatalogViewMode } from './catalog-tabs';

interface Props {
  value: CatalogTab;
  counts: Record<CatalogTab, number>;
  onChange: (tab: CatalogTab) => void;
}

export function CatalogTabBar({ value, counts, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('catalog.grid.tabsLabel')} className="ct-tabs">
      {CATALOG_TABS.map((tab) => (
        <button key={tab} type="button" className="ct-tab" aria-pressed={value === tab} onClick={() => onChange(tab)}>
          {t(`catalog.grid.tabs.${tab}`)} <span className="ct-tab__n">{counts[tab]}</span>
        </button>
      ))}
    </div>
  );
}

export function ViewSwitch({ value, onChange }: { value: CatalogViewMode; onChange: (v: CatalogViewMode) => void }) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('catalog.grid.viewLabel')} className="ct-tabs ct-tabs--view">
      {(['grid', 'table'] as const).map((v) => (
        <button key={v} type="button" className="ct-tab" aria-pressed={value === v} onClick={() => onChange(v)}>
          {t(`catalog.grid.${v}View`)}
        </button>
      ))}
    </div>
  );
}
