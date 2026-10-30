import type vi from '@/locales/vi/nav';
import type { Messages } from '@/locales/messages';

const nav: Messages<typeof vi> = {
  nav: {
    main: 'Main navigation',
    sections: 'Sections',
    adminMenu: 'Admin menu',
    openMenu: 'Open admin menu',
    userMenu: 'Account and language',
    register: 'Order',
    history: 'History',
    me: 'Me',
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
    badge: {
      review: '{{n}} items to review',
      delivery: '{{n}} lines to deliver',
      stock: '{{n}} items running low',
    },
    periodCard: {
      title: 'Period {{month}} is open',
      daysLeft: '{{n}} days left · locks 00:00 on {{date}}',
      lastDay: 'Today is the last day · locks 00:00 on {{date}}',
    },
  },
};

export default nav;
