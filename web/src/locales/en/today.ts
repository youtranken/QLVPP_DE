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
      review: { label: 'Off-catalog items awaiting review', hint_one: 'people · period {{month}} · oldest {{count}} day', hint_other: 'people · period {{month}} · oldest {{count}} days' },
      ready: { label: 'Ready to deliver', hint: 'people · cupboard covers the whole order' },
      arrivals: { label: 'Supplier goods not arrived', hint: 'items · sent to supplier {{date}}', notSent: 'not sent to supplier' },
      backlog: { label: 'Owed from earlier months', hint_one: 'people · {{count}} month', hint_other: 'people · {{count}} months' },
      period: { label: 'Period {{month}} open for orders', labelPlain: 'Open period', hint_one: 'locks {{lock}} · {{count}} day left', hint_other: 'locks {{lock}} · {{count}} days left' },
      low: { label: 'Cupboard running low', hint: 'items below minimum' },
      left: { label: 'Leavers with items left', hint: 'not received' },
    },
    attention: {
      title: 'Needs attention',
      empty: 'Nothing needs attention',
      waiting_one: 'Awaiting review {{count}} day',
      waiting_other: 'Awaiting review {{count}} days',
      custom: '{{name}} (off-catalog)',
      leftTag: 'Has left',
      leftQty_one: '{{count}} unit not received',
      leftQty_other: '{{count}} units not received',
      review: 'Review',
      open: 'Open order',
      error: { review: 'Could not load items awaiting review — try again.', people: 'Could not load leavers with items left — try again.' },
    },
  },
};

export default today;
