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
      { path: 'month', titleKey: 'nav.month', icon: 'calendar', badge: 'review' },
      { path: 'reports', titleKey: 'nav.reports', icon: 'printer' },
      { path: 'arrivals', titleKey: 'nav.arrivals', icon: 'pkg' },
      { path: 'delivery', titleKey: 'nav.delivery', icon: 'truck', badge: 'delivery' },
      { path: 'backlog', titleKey: 'nav.backlog', icon: 'receipt' },
    ],
  },
  {
    labelKey: 'nav.groups.stock',
    pages: [
      { path: 'catalog', titleKey: 'nav.catalog', icon: 'layers' },
      { path: 'stock', titleKey: 'nav.stock', icon: 'warehouse', badge: 'stock' },
      { path: 'issues', titleKey: 'nav.issues', icon: 'move' },
      { path: 'categories', titleKey: 'nav.categoriesUnits', icon: 'filter' },
    ],
  },
  {
    labelKey: 'nav.groups.system',
    pages: [
      { path: 'users', titleKey: 'nav.users', icon: 'users' },
      { path: 'audit', titleKey: 'audit.title', icon: 'scroll' },
      { path: 'config', titleKey: 'config.title', icon: 'sliders' },
    ],
  },
];

export const ADMIN_HOME = 'month';
