import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { categoryLabel, type Category } from '@/features/catalog/catalog.api';
import { groupTone } from '@/lib/group-tone';
import { NARROW_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { useUrlPatch } from '@/lib/use-url-patch';
import type { MemberItem } from './request.api';
import { FilterBar } from './filter-bar';
import { applyFilters, CLEAR_PATCH, filterPatch, groupCounts, itemGroupOf, parseFilter } from './item-filters';
import { ItemCard } from './item-card';
import type { CartLine } from './use-cart';

export function ItemGrid({
  items,
  categories,
  lineByKey,
  copy,
  onQty,
  onAddCustom,
}: {
  items: MemberItem[];
  categories: Category[];
  lineByKey: Map<string, CartLine>;
  copy?: ReactNode;
  onQty: (itemId: string, n: number) => void;
  onAddCustom: () => void;
}) {
  const { t, i18n } = useTranslation();
  const narrow = useMediaQuery(NARROW_QUERY);
  const [params, patch] = useUrlPatch();
  const groupOf = useMemo(() => itemGroupOf(categories, [t('request.grid.none', { lng: 'vi' }), t('request.grid.none', { lng: 'en' })]), [categories, t]);
  const groups = useMemo(() => groupCounts(items, categories, i18n.language, t('request.grid.none'), groupOf), [items, categories, i18n.language, t, groupOf]);
  const catInfo = useMemo(
    () => new Map(categories.map((c) => [c.id, { tone: groupTone(categories, c.id), label: categoryLabel(c, i18n.language) }])),
    [categories, i18n.language],
  );
  // Điện thoại: 169 món không đổ hết một trang, mặc định nhóm đầu; máy tính mặc định "Tất cả"
  const filter = parseFilter(params, groups.map((g) => g.id), narrow && groups[0] ? groups[0].id : 'all');
  const visible = applyFilters(items, filter, groupOf);
  // Lưới đã xếp theo nhóm, ảnh đã tô màu nhóm: nhãn nhóm chỉ cần khi kết quả tìm lẫn nhiều nhóm
  const searching = filter.q !== '';
  return (
    <section className="rq-catalog" aria-label={t('request.grid.label')}>
      <FilterBar
        filter={filter}
        groups={groups}
        total={items.length}
        shown={visible.length}
        copy={copy}
        onChange={(f) => patch(filterPatch(f), true)}
        onClear={() => patch(CLEAR_PATCH, true)}
      />
      <div className="rq-grid">
        {visible.map((item) => {
          const info = catInfo.get(item.category_id ?? '');
          return (
            <ItemCard
              key={item.id}
              item={item}
              line={lineByKey.get(item.id)}
              tone={info?.tone ?? 'g0'}
              groupLabel={info?.label ?? null}
              showGroup={searching}
              paused={!item.usable}
              onQty={(n) => onQty(item.id, n)}
            />
          );
        })}
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
