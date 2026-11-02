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
      backToList: 'Back to request list',
      avatar: '{{name}}, {{role}}',
      lockedMonth: 'Month {{month}}/{{year}} · locked',
    },
    groups: {
      monthly: 'Monthly',
      stock: 'Stock & catalog',
      system: 'System',
    },
    summary: 'Period summary',
    review: 'Off-catalog items',
    delivery: 'Delivery',
    backlog: 'Outstanding',
    reports: 'Reports & print',
    categories: 'Categories',
    units: 'Units',
    badge: {
      review: '{{n}} items to review',
      delivery: '{{n}} lines to deliver',
      stock: '{{n}} items running low',
    },
    periodCard: {
      title: 'Period {{month}} is open',
      label: 'Current sign-up period',
      state: 'Month {{month}} · open',
      name: 'Current sign-up period: month {{month}} · open · {{detail}}',
      daysLeft: '{{n}} days left · locks 00:00 on {{date}}',
      lastDay: 'Today is the last day · locks 00:00 on {{date}}',
    },
  },
};

export default nav;
