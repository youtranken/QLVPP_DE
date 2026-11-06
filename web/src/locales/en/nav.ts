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
      menuBrand: 'VPP Công trình · Admin team',
      closeMenu: 'Close menu',
      avatar: '{{name}}, {{role}}',
      lockedMonth: 'Month {{month}}/{{year}} · locked',
      currentPeriod: 'Current period: month {{month}} · open',
    },
    groups: {
      monthly: 'Monthly',
      stock: 'Catalog & cupboard',
      system: 'Manage',
    },
    home: 'This month',
    summary: 'Period summary',
    catalog: 'Catalog items',
    stock: 'Cupboard',
    users: 'Staff',
    review: 'Off-catalog items',
    arrivals: 'Goods arriving',
    sendAdm: 'Send to ADM',
    delivery: 'Delivery',
    backlog: 'Outstanding',
    reports: 'Reports & print',
    categoriesUnits: 'Groups & units',
    badge: {
      review: '{{n}} items to review',
      delivery: '{{n}} people waiting',
      stock: '{{n}} items short for waiting staff',
    },
    periodCard: {
      title: 'Period: month {{month}}',
      registered: '{{registered}}/{{headcount}} signed up',
      name: 'Current sign-up period: month {{month}} · open · {{detail}}',
      nameWithCount: 'Current sign-up period: month {{month}} · open · {{registered}}/{{headcount}} signed up · {{detail}}',
      daysLeft: '{{n}} days left · locks {{lock}}',
      lastDay: 'Today is the last day · locks {{lock}}',
    },
  },
};

export default nav;
