import type vi from '@/locales/vi/nav';
import type { Messages } from '@/locales/messages';

const nav: Messages<typeof vi> = {
  nav: {
    main: 'Main navigation',
    sections: 'Sections',
    adminMenu: 'Admin menu',
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
    groups: {
      monthly: 'Monthly',
      stock: 'Catalog & cupboard',
      system: 'Manage',
    },
    month: 'Month period',
    catalog: 'Products',
    stock: 'Cupboard',
    users: 'Directory',
    review: 'Off-catalog items',
    arrivals: 'Receiving',
    delivery: 'Delivery',
    backlog: 'Outstanding',
    reports: 'Reports & ordering',
    categoriesUnits: 'Categories',
    badge: {
      review: '{{n}} items to review',
      delivery: '{{n}} people waiting',
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
