import type vi from '@/locales/vi/nav';
import type { Messages } from '@/locales/messages';

const nav: Messages<typeof vi> = {
  nav: {
    main: 'Main navigation',
    sections: 'Sections',
    adminMenu: 'Admin menu',
    openMenu: 'Open menu',
    register: 'Order',
    history: 'History',
    me: 'Me',
    toAdmin: 'VPP Admin',
    groups: {
      monthly: 'Monthly',
      stock: 'Stock & catalog',
      system: 'System',
      personal: 'Personal',
    },
    summary: 'Period summary',
    review: 'Off-catalog items',
    delivery: 'Delivery',
    backlog: 'Outstanding',
    reports: 'Reports & print',
    myRequest: 'My request',
  },
};

export default nav;
