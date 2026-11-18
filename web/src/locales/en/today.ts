import type vi from '@/locales/vi/today';
import type { Messages } from '@/locales/messages';

const today: Messages<typeof vi> = {
  today: {
    title: 'Today',
    greet: '{{greeting}}, {{name}}',
    greeting: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
    summary: {
      none: '{{date}} · nothing to handle',
      work_one: '{{date}} · {{count}} task to handle',
      work_other: '{{date}} · {{count}} tasks to handle',
      urgent_one: '{{count}} urgent',
      urgent_other: '{{count}} urgent',
    },
    openMonth: 'Open Month period',
    openDelivery: 'Open Delivery',
    tilesLabel: 'Task counts',
    tileError: 'Could not load',
    tiles: {
      none: 'Nothing to do',
      review: { label: 'Off-catalog items awaiting review', hint: 'people · period {{month}} · oldest {{days}} days' },
      ready: { label: 'Ready to deliver', hint: 'people · cupboard covers the whole order' },
      arrivals: { label: 'Supplier goods not arrived', hint: 'items · sent to supplier {{date}}', notSent: 'not sent to supplier' },
      backlog: { label: 'Owed from earlier months', hint: 'people · {{months}} months' },
      period: { label: 'Period {{month}} open for orders', labelPlain: 'Open period', hint: 'locks {{lock}} · {{days}} days left' },
      low: { label: 'Cupboard running low', hint: 'items below minimum' },
      left: { label: 'Leavers with items left', hint: 'not received' },
    },
    attention: {
      title: 'Needs attention',
      empty: 'Nothing needs attention',
      waiting: 'Awaiting review {{days}} days',
      custom: '{{name}} (off-catalog)',
      leftTag: 'Has left',
      leftQty: '{{qty}} units not received',
      review: 'Review',
      open: 'Open order',
    },
  },
};

export default today;
