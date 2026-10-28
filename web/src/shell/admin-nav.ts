export interface AdminPage {
  path: string;
  titleKey: string;
}

export interface AdminNavGroup {
  labelKey: string;
  pages: AdminPage[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    labelKey: 'nav.groups.monthly',
    pages: [
      { path: 'summary', titleKey: 'nav.summary' },
      { path: 'review', titleKey: 'nav.review' },
      { path: 'delivery', titleKey: 'nav.delivery' },
      { path: 'backlog', titleKey: 'nav.backlog' },
      { path: 'reports', titleKey: 'nav.reports' },
    ],
  },
  {
    labelKey: 'nav.groups.stock',
    pages: [
      { path: 'stock', titleKey: 'stock.title' },
      { path: 'catalog', titleKey: 'catalog.title' },
    ],
  },
  {
    labelKey: 'nav.groups.system',
    pages: [
      { path: 'users', titleKey: 'users.title' },
      { path: 'audit', titleKey: 'audit.title' },
      { path: 'config', titleKey: 'config.title' },
    ],
  },
];

// Nhóm món mở từ trang Danh mục, không có mục riêng trong sidebar (_SPEC.md)
export const ADMIN_HIDDEN_PAGES: AdminPage[] = [
  { path: 'categories', titleKey: 'catalog.categoriesTitle' },
];

export const ADMIN_PAGES: AdminPage[] = [
  ...ADMIN_NAV.flatMap((g) => g.pages),
  ...ADMIN_HIDDEN_PAGES,
];

export const ADMIN_HOME = 'catalog';
