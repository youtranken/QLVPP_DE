import type vi from '@/locales/vi/profile';
import type { Messages } from '@/locales/messages';

const profile: Messages<typeof vi> = {
  profile: {
    title: 'Me',
    menu: 'Account',
    openMenu: 'Open account for {{name}}',
    email: 'Email',
    employeeCode: 'Employee ID',
    dataFromPmhId: 'Data comes from PMH ID and cannot be edited in the app.',
  },
};

export default profile;
