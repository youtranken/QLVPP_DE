import type vi from '@/locales/vi/nav';
import type { Messages } from '@/locales/messages';

const nav: Messages<typeof vi> = {
  nav: {
    main: 'Main navigation',
    sections: 'Sections',
    adminMenu: 'Admin menu',
    breadcrumb: 'Breadcrumb',
    userMenu: 'Account and language',
    register: 'Order',
    history: 'History',
    me: 'Me',
    mobile: {
      openMenu: 'Open admin menu',
      menuTitle: 'Admin menu',
      menuBrand: 'QLVPP · D&E Admin',
      closeMenu: 'Close menu',
      avatar: '{{name}}, {{role}}',
      lockedMonth: '{{month, MonthName}} {{year}} · locked',
      currentPeriod: 'Current period: {{month, monthName}} · open',
    },
    quickSearch: {
      shortcut: 'Ctrl K',
      esc: 'Esc',
      label: 'Quick search',
      placeholder: 'Item, person or page',
      results: 'Quick search results',
      groups: { items: 'Items', people: 'People', pages: 'Go to' },
      inStock: 'cupboard {{n}}',
      filterStock: 'Cupboard › filter "{{q}}"',
      filterUsers: 'Directory › filter "{{q}}"',
      tooShort: 'Type at least {{n}} characters to find an item, person or page.',
      loading: 'Loading lists…',
      empty: 'No item, person or page matches "{{q}}".',
    },
    groups: {
      monthly: 'Monthly',
      stock: 'Catalog & cupboard',
      system: 'Manage',
    },
    today: 'Today',
    month: 'Month period',
    catalog: 'Products',
    stock: 'Cupboard',
    users: 'Directory',
    arrivals: 'Receiving',
    delivery: 'Delivery',
    backlog: 'Outstanding',
    reports: 'Reports & ordering',
    categoriesUnits: 'Categories',
    badge: {
      review: '{{n}} people with non-catalog items awaiting review',
      delivery: '{{n}} people yet to receive',
      stock: '{{n}} items short for waiting staff',
    },
    periodCard: {
      title: 'Period: {{month, monthName}}',
      registered: '{{registered}}/{{headcount}} signed up',
      name: 'Current sign-up period: {{month, monthName}} · open · {{detail}}',
      nameWithCount: 'Current sign-up period: {{month, monthName}} · open · {{registered}}/{{headcount}} signed up · {{detail}}',
      daysLeft: '{{n}} days left · locks {{lock}}',
      lastDay: 'Today is the last day · locks {{lock}}',
    },
  },
};

export default nav;
