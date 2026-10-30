import type vi from '@/locales/vi/profile';
import type { Messages } from '@/locales/messages';

const profile: Messages<typeof vi> = {
  profile: {
    title: 'Me',
    account: 'Account',
    fullName: 'Full name',
    email: 'Email',
    department: 'Department',
    employeeCode: 'Employee ID',
    dataFromPmhId: 'Data comes from PMH ID and cannot be edited in the app',
    role: 'Role',
  },
};

export default profile;
