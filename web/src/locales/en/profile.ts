import type vi from '@/locales/vi/profile';
import type { Messages } from '@/locales/messages';

const profile: Messages<typeof vi> = {
  profile: {
    title: 'Me',
    menu: 'Account',
    openMenu: 'Open account for {{name}}',
    email: 'Email',
    employeeCode: 'Employee ID',
    support: 'Contact D&E Admin for support.',
  },
};

export default profile;
