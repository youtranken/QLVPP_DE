import type vi from '@/locales/vi/directory';
import type { Messages } from '@/locales/messages';

const directory: Messages<typeof vi> = {
  directory: {
    picker: {
      searchHint: 'Type a name or email.',
      results: 'People found',
      empty: 'Nobody found.',
      locked: 'locked',
      change: 'Change person',
    },
  },
};

export default directory;
