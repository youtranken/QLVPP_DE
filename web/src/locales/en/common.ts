import type vi from '@/locales/vi/common';
import type { Messages } from '@/locales/messages';

const common: Messages<typeof vi> = {
  app: {
    title: 'VPP Construction',
    adminTitle: 'VPP Admin',
    logoLetter: 'V',
  },
  common: {
    loading: 'Loading…',
    checkingSession: 'Checking your session…',
    systemError: 'Cannot reach the server — try again in a few minutes.',
    retry: 'Retry',
    reload: 'Reload page',
    loadError: 'Could not load data — try again.',
    chunkError: 'The app was just updated — reload the page to use the new version.',
    notFoundTitle: 'Page not found',
    notFoundHint: 'The page you are looking for does not exist or has moved.',
    backHome: 'Back to home',
    noPermission: 'This page is for the Admin team.',
    skipToContent: 'Skip to content',
    confirmTitle: 'Confirm',
    confirmOk: 'OK',
    cancel: 'Cancel',
    close: 'Close',
    discardTitle: 'Discard unsaved changes?',
    discardBody: 'What you just entered will be lost.',
    discardOk: 'Discard changes',
    discardKeep: 'Keep editing',
    selectAll: 'Select all',
    selectRow: 'Select row',
    stepper: {
      decrease: 'Decrease {{label}}',
      increase: 'Increase {{label}}',
    },
    empty: '—',
    roles: {
      member: 'Staff',
      admin: 'Admin team',
      sa: 'Technical admin',
    },
    languages: {
      label: 'Language',
      vi: 'Tiếng Việt',
      en: 'English',
    },
  },
};

export default common;
