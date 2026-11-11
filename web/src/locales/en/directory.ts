import type vi from '@/locales/vi/directory';
import type { Messages } from '@/locales/messages';

const directory: Messages<typeof vi> = {
  directory: {
    picker: {
      searchHint: 'Type a name or email to search',
      count_one: '{{count}} person found',
      count_other: '{{count}} people found',
      results: 'People found',
      empty: 'Nobody found.',
      locked: 'locked',
      change: 'Change person',
    },
    person: {
      loading: '…',
      former: 'Former user',
      system: 'System (automatic)',
    },
  },
};

export default directory;
