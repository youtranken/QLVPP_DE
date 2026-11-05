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
  collapsible?: boolean;
  pages: AdminPage[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    labelKey: 'nav.groups.monthly',
    pages: [
      { path: 'summary', titleKey: 'nav.summary', icon: 'dash' },
      { path: 'delivery', titleKey: 'nav.delivery', icon: 'truck', badge: 'delivery' },
      { path: 'arrivals', titleKey: 'nav.arrivals', icon: 'pkg' },
      { path: 'reports', titleKey: 'nav.reports', icon: 'printer' },
    ],
  },
  {
    labelKey: 'nav.groups.stock',
    pages: [
      { path: 'catalog', titleKey: 'nav.catalog', icon: 'layers' },
      { path: 'stock', titleKey: 'nav.stock', icon: 'warehouse', badge: 'stock' },
      { path: 'review', titleKey: 'nav.review', icon: 'pkgplus', badge: 'review' },
      { path: 'categories', titleKey: 'nav.categories', icon: 'filter' },
      { path: 'units', titleKey: 'nav.units', icon: 'sheet' },
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
  {
    labelKey: 'nav.groups.later',
    collapsible: true,
    pages: [
      { path: 'backlog', titleKey: 'nav.backlog', icon: 'receipt' },
      { path: 'delivery/classic', titleKey: 'nav.deliveryClassic', icon: 'truck' },
    ],
  },
];

export const ADMIN_HOME = 'summary';
