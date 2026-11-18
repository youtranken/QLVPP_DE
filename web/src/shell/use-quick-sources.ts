import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { categoryLabel, useAdminItems, useAllCategories } from '@/features/catalog/catalog.api';
import { userLabel } from '@/features/directory/directory.api';
import { useDirectoryUsers } from '@/features/directory/use-all-users';
import { ADMIN_NAV } from '@/shell/admin-nav';
import type { QuickEntry, QuickSources } from '@/shell/quick-search-index';

// Chỉ dùng dữ liệu web đã có (món, danh bạ, menu): không có endpoint tìm riêng
export function useQuickSources(q: string): { sources: QuickSources; loading: boolean } {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const items = useAdminItems();
  const categories = useAllCategories();
  const dir = useDirectoryUsers(q.trim());

  const itemEntries = useMemo<QuickEntry[]>(() => {
    const groupName = new Map((categories.data ?? []).map((c) => [c.id, categoryLabel(c, lang)]));
    return (items.data ?? []).map((i) => {
      const group = i.category_id ? groupName.get(i.category_id) : undefined;
      return {
        id: `item-${i.id}`,
        label: lang === 'en' && i.name_en ? i.name_en : i.name,
        hint: [group, t('nav.quickSearch.inStock', { n: i.stock_qty })].filter(Boolean).join(' · '),
        to: `/admin/catalog?item=${encodeURIComponent(i.id)}`,
        terms: [i.name, i.name_en, i.code],
      };
    });
  }, [items.data, categories.data, lang, t]);

  const peopleEntries = useMemo<QuickEntry[]>(
    () =>
      dir.users.map((u) => ({
        id: `person-${u.sub}`,
        label: userLabel(u),
        hint: u.department ?? undefined,
        to: `/admin/users?person=${encodeURIComponent(u.sub)}`,
        terms: [u.fullName, u.email, u.employeeCode],
      })),
    [dir.users],
  );

  const pageEntries = useMemo<QuickEntry[]>(
    () =>
      ADMIN_NAV.flatMap((g) =>
        g.pages.map((p) => ({ id: `page-${p.path}`, label: t(p.titleKey), hint: t(g.labelKey), to: `/admin/${p.path}`, terms: [t(p.titleKey)] })),
      ),
    [t],
  );

  const sources = useMemo<QuickSources>(
    () => ({
      items: itemEntries,
      people: peopleEntries,
      pages: pageEntries,
      shortcuts: [
        { when: 'items', make: (text) => ({ id: 'filter-stock', label: t('nav.quickSearch.filterStock', { q: text }), to: `/admin/stock?q=${encodeURIComponent(text)}`, terms: [] }) },
        { when: 'people', make: (text) => ({ id: 'filter-users', label: t('nav.quickSearch.filterUsers', { q: text }), to: `/admin/users?q=${encodeURIComponent(text)}`, terms: [] }) },
      ],
    }),
    [itemEntries, peopleEntries, pageEntries, t],
  );
  return { sources, loading: items.isPending || dir.loading };
}
