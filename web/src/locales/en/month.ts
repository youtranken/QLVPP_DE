import type vi from '@/locales/vi/month';
import type { Messages } from '@/locales/messages';

const month: Messages<typeof vi> = {
  month: {
    title: '{{month, MonthName}} period',
    search: 'Search people or departments',
    period: {
      label: 'Choose period',
      month: '{{month, MonthName}} {{year}}',
      prev: 'Previous month',
      next: 'Next month',
      status: { locked: 'Delivering', open: 'Signing up', past: 'Past' },
      toOpen: '{{month, MonthName}} sign-up',
      toLocked: '{{month, MonthName}} delivery',
    },
    steps: {
      label: 'Steps of the month',
      register: 'Sign-up',
      send: 'Send to supplier',
      arrive: 'Receiving',
      deliver: 'Delivery',
    },
    value: {
      sendTodo: 'Not sent',
      sent: 'Sent',
      noOrder: 'No order needed',
      noOrderArrive: 'No order sent to supplier',
      arrive: '{{done}}/{{total}} items',
      deliver: '{{done}}/{{total}} requests',
      none: '—',
    },
    chips: {
      label: 'Filter requests',
      all: 'All',
      noted: 'With notes',
      undelivered: 'Not fully delivered',
    },
    table: {
      team: 'Team',
      noDepartment: 'No department',
    },
    notes: {
      overMax: 'Over maximum',
      adjusted: 'D&E Admin adjusted',
      nothing: 'Nothing to deliver',
      custom: 'Off-catalog item',
    },
    left: {
      action: 'Handle',
      debt: 'See previous months owed',
    },
  },
};

export default month;
