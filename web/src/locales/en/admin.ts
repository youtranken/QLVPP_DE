import type vi from '@/locales/vi/admin';
import type { Messages } from '@/locales/messages';

const admin: Messages<typeof vi> = {
  users: {
    title: 'Directory',
  },
  audit: {
    title: 'Audit log',
  },
  config: {
    title: 'Settings',
  },
};

export default admin;
