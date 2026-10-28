import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { categoryLabel, type Category } from '@/features/catalog/catalog.api';
import { IconSearch } from '@/ui/icons';
import type { MemberItem } from './request.api';
import { matchesSearch, tintOf } from './request-format';
import { ItemCard } from './item-card';
import type { CartLine } from './use-cart';

export function ItemGrid({
  items,
  categories,
  lineByKey,
  onQty,
  onAddCustom,
}: {
  items: MemberItem[];
  categories: Category[];
  lineByKey: Map<string, CartLine>;
  onQty: (itemId: string, n: number) => void;
  onAddCustom?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const visible = items.filter(
    (i) =>
      (!categoryId || i.category_id === categoryId) &&
      (!query.trim() || matchesSearch(`${i.name} ${i.name_en ?? ''} ${i.pack_note ?? ''}`, query)),
  );
  const chip = (id: string | null, label: string) => (
    <button
      key={id ?? 'all'}
      type="button"
      className="rq-chip"
      aria-pressed={categoryId === id}
      onClick={() => setCategoryId(id)}
    >
      {label}
    </button>
  );
  return (
    <section className="rq-catalog" aria-label={t('request.grid.label')}>
      <div className="rq-tools">
        <label className="rq-search">
          <IconSearch />
          <input
            type="search"
            aria-label={t('request.grid.search')}
            placeholder={t('request.grid.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button type="button" className="rq-add-other" onClick={onAddCustom}>
          + {t('request.grid.addOther')}
        </button>
        <div className="rq-chips" role="group" aria-label={t('request.grid.categories')}>
          {chip(null, t('request.grid.all'))}
          {categories.map((c) => chip(c.id, categoryLabel(c, i18n.language)))}
        </div>
      </div>
      {visible.length === 0 && <p className="rq-empty">{t('request.grid.empty')}</p>}
      <div className="rq-grid">
        {visible.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            line={lineByKey.get(item.id)}
            tint={tintOf(item.category_id, categories)}
            onQty={(n) => onQty(item.id, n)}
          />
        ))}
        <button type="button" className="rq-card rq-card-more" onClick={onAddCustom}>
          <span className="rq-card-more-ic" aria-hidden="true">
            +
          </span>
          <b>{t('request.grid.missingTitle')}</b>
          <span>{t('request.grid.missingAction')}</span>
        </button>
      </div>
    </section>
  );
}
