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
    <div role="group" aria-label={t('catalog.grid.tabsLabel')} className="ct-seg">
      {CATALOG_TABS.map((tab) => (
        <button key={tab} type="button" className="ct-seg__opt" aria-pressed={value === tab} onClick={() => onChange(tab)}>
          {t(`catalog.grid.tabs.${tab}`)} <span className="ct-seg__n num">{counts[tab]}</span>
        </button>
      ))}
    </div>
  );
}

export function ViewSwitch({ value, onChange }: { value: CatalogViewMode; onChange: (v: CatalogViewMode) => void }) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('catalog.grid.viewLabel')} className="ct-seg ct-seg--view">
      {(['grid', 'table'] as const).map((v) => (
        <button key={v} type="button" className="ct-seg__opt" aria-pressed={value === v} onClick={() => onChange(v)}>
          {t(`catalog.grid.${v}View`)}
        </button>
      ))}
    </div>
  );
}
