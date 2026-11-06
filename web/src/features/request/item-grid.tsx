import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { categoryLabel, type Category } from '@/features/catalog/catalog.api';
import { groupTone } from '@/lib/group-tone';
import { NARROW_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { useUrlPatch } from '@/lib/use-url-patch';
import type { MemberItem } from './request.api';
import { FilterBar } from './filter-bar';
import { applyFilters, CLEAR_PATCH, filterPatch, groupCounts, parseFilter } from './item-filters';
import { ItemCard } from './item-card';
import type { CartLine } from './use-cart';

export function ItemGrid({
  items,
  categories,
  lineByKey,
  favIds,
  copy,
  onQty,
  locked,
  onAddCustom,
}: {
  items: MemberItem[];
  categories: Category[];
  lineByKey: Map<string, CartLine>;
  favIds?: ReadonlySet<string>;
  copy?: ReactNode;
  onQty: (itemId: string, n: number) => void;
  locked: boolean;
  onAddCustom: () => void;
}) {
  const { t, i18n } = useTranslation();
  const narrow = useMediaQuery(NARROW_QUERY);
  const [params, patch] = useUrlPatch();
  const categoryIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);
  const groups = useMemo(
    () => groupCounts(items, categories, i18n.language, t('request.grid.none'), categoryIds),
    [items, categories, i18n.language, t, categoryIds],
  );
  const catInfo = useMemo(
    () => new Map(categories.map((c) => [c.id, { tone: groupTone(categories, c.id), label: categoryLabel(c, i18n.language) }])),
    [categories, i18n.language],
  );
  // Điện thoại: 169 món không đổ hết một trang, mặc định nhóm đầu (R-C2); máy tính mặc định "Tất cả"
  const filter = parseFilter(params, groups.map((g) => g.id), narrow && groups[0] ? groups[0].id : 'all');
  const visible = applyFilters(items, { lines: [...lineByKey.values()] }, filter, i18n.language, favIds, categoryIds);
  const pickedCount = useMemo(() => items.filter((i) => lineByKey.has(i.id)).length, [items, lineByKey]);
  return (
    <section className="rq-catalog" aria-label={t('request.grid.label')}>
      <FilterBar
        filter={filter}
        groups={groups}
        total={items.length}
        shown={visible.length}
        pickedCount={pickedCount}
        copy={copy}
        onChange={(f) => patch(filterPatch(f), true)}
        onClear={() => patch(CLEAR_PATCH, true)}
        onAddCustom={onAddCustom}
      />
      <div className="rq-grid">
        {visible.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            line={lineByKey.get(item.id)}
            tone={catInfo.get(item.category_id ?? '')?.tone ?? 'g0'}
            groupLabel={catInfo.get(item.category_id ?? '')?.label ?? null}
            locked={locked}
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
