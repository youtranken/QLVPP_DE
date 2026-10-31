import type { IconName } from '@/ui/icon';

export type AdminBadgeKey = 'review' | 'delivery' | 'stock';

export interface AdminPage {
  path: string;
  titleKey: string;
  icon: IconName;
  badge?: AdminBadgeKey;
  ownHeader?: boolean;
}

export interface AdminNavGroup {
  labelKey: string;
  pages: AdminPage[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    labelKey: 'nav.groups.monthly',
    pages: [
      { path: 'summary', titleKey: 'nav.summary', icon: 'dash', ownHeader: true },
      { path: 'review', titleKey: 'nav.review', icon: 'pkgplus', badge: 'review', ownHeader: true },
      { path: 'delivery', titleKey: 'nav.delivery', icon: 'truck', badge: 'delivery', ownHeader: true },
      { path: 'backlog', titleKey: 'nav.backlog', icon: 'receipt', ownHeader: true },
      { path: 'reports', titleKey: 'nav.reports', icon: 'printer', ownHeader: true },
    ],
  },
  {
    labelKey: 'nav.groups.stock',
    pages: [
      { path: 'stock', titleKey: 'stock.title', icon: 'warehouse', badge: 'stock', ownHeader: true },
      { path: 'catalog', titleKey: 'catalog.title', icon: 'layers', ownHeader: true },
      { path: 'categories', titleKey: 'nav.categories', icon: 'filter', ownHeader: true },
      { path: 'units', titleKey: 'nav.units', icon: 'sheet', ownHeader: true },
    ],
  },
  {
    labelKey: 'nav.groups.system',
    pages: [
      { path: 'users', titleKey: 'users.title', icon: 'users', ownHeader: true },
      { path: 'audit', titleKey: 'audit.title', icon: 'scroll' },
      { path: 'config', titleKey: 'config.title', icon: 'sliders' },
    ],
  },
];

export function adminPageOf(pathname: string): { page: AdminPage; group: AdminNavGroup } | undefined {
  const seg = pathname.split('/')[2] ?? '';
  for (const group of ADMIN_NAV) {
    const page = group.pages.find((p) => p.path === seg);
    if (page) return { page, group };
  }
  return undefined;
}

export const ADMIN_HOME = 'summary';
