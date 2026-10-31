import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUnitNames } from '@/features/units/units.api';
import { groupTone } from '@/lib/group-tone';
import { ItemThumb } from '@/ui/item-thumb';
import { categoryLabel, type AdminItem, type Category } from '@/features/catalog/catalog.api';

export function ConvertExisting({ items, categories, selectedId, error, onPick }: {
  items: AdminItem[];
  categories: Category[];
  selectedId: string;
  error?: string;
  onPick: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const unitName = useUnitNames();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, query]);
  const categoryOf = (id: string | null) => categories.find((c) => c.id === id);
  return (
    <div className="a-form-wide rv-existing">
      <input
        type="search"
        className="a-input"
        aria-label={t('review.convert.search')}
        placeholder={t('review.convert.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error && (
        <p role="alert" className="ff-error">
          {error}
        </p>
      )}
      {shown.length === 0 ? (
        <p className="ff-hint">{t('review.convert.noMatch')}</p>
      ) : (
        <ul className="rv-pick">
          {shown.map((i) => {
            const cat = categoryOf(i.category_id);
            return (
              <li key={i.id}>
                <button type="button" aria-pressed={i.id === selectedId} onClick={() => onPick(i.id)}>
                  <ItemThumb fileId={i.image_file_id} alt="" tone={groupTone(categories, i.category_id)} size={36} />
                  <span className="rv-pick__text">
                    <span className="rv-pick__name">{i.name}</span>
                    <span className="rv-pick__meta">
                      {t('review.convert.countsIn', {
                        unit: unitName(i.unit),
                        category: cat ? categoryLabel(cat, i18n.language) : t('review.convert.noCategory'),
                      })}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
