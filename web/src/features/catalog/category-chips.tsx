import { useTranslation } from 'react-i18next';
import { categoryLabel } from './catalog.api';
import { NO_GROUP, type CategoryIndex } from './catalog-rows';

interface Props {
  index: CategoryIndex;
  counts: Map<string, number>;
  total: number;
  value: string | null;
  onChange: (cat: string | null) => void;
}

// Nhóm đã ngừng chỉ hiện khi còn món; "Chưa xếp nhóm" chỉ hiện khi có món lạc nhóm
export function CategoryChips({ index, counts, total, value, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const chips = index.ordered
    .filter((c) => c.active || counts.has(c.id))
    .map((c) => ({ key: c.id, label: categoryLabel(c, i18n.language), tone: index.tone.get(c.id) ?? 'g0' }));
  if (counts.has(NO_GROUP)) chips.push({ key: NO_GROUP, label: t('catalog.page.noCategory'), tone: 'g0' });
  return (
    <div role="group" aria-label={t('catalog.page.categoryFilter')} className="ct-chips">
      <button type="button" className="ct-chip" aria-pressed={value === null} onClick={() => onChange(null)}>
        {t('catalog.page.allCategories')}{' '}
        <span className="ct-chip__n num">{total}</span>
      </button>
      {chips.map((c) => (
        <button key={c.key} type="button" className="ct-chip" aria-pressed={value === c.key} onClick={() => onChange(value === c.key ? null : c.key)}>
          <span className="ct-dot" style={{ background: `var(--${c.tone}-ink)` }} aria-hidden="true" />
          {c.label}{' '}
          <span className="ct-chip__n num">{counts.get(c.key) ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
