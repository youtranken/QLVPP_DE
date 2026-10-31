import type { IconName } from '@/ui/icon';

export type AdminBadgeKey = 'review' | 'delivery' | 'stock';

export interface AdminPage {
  path: string;
  titleKey: string;
  icon: IconName;
  badge?: AdminBadgeKey;
}

export interface AdminNavGroup {
  labelKey: string;
  pages: AdminPage[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    labelKey: 'nav.groups.monthly',
    pages: [
      { path: 'summary', titleKey: 'nav.summary', icon: 'dash' },
      { path: 'review', titleKey: 'nav.review', icon: 'pkgplus', badge: 'review' },
      { path: 'delivery', titleKey: 'nav.delivery', icon: 'truck', badge: 'delivery' },
      { path: 'backlog', titleKey: 'nav.backlog', icon: 'receipt' },
      { path: 'reports', titleKey: 'nav.reports', icon: 'printer' },
    ],
  },
  {
    labelKey: 'nav.groups.stock',
    pages: [
      { path: 'stock', titleKey: 'stock.title', icon: 'warehouse', badge: 'stock' },
      { path: 'catalog', titleKey: 'catalog.title', icon: 'layers' },
      { path: 'categories', titleKey: 'nav.categories', icon: 'filter' },
      { path: 'units', titleKey: 'nav.units', icon: 'sheet' },
    ],
  },
  {
    labelKey: 'nav.groups.system',
    pages: [
      { path: 'users', titleKey: 'users.title', icon: 'users' },
      { path: 'audit', titleKey: 'audit.title', icon: 'scroll' },
      { path: 'config', titleKey: 'config.title', icon: 'sliders' },
    ],
  },
];

export const ADMIN_HOME = 'summary';
