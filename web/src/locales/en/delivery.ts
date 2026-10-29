import type vi from '@/locales/vi/delivery';
import type { Messages } from '@/locales/messages';

const delivery: Messages<typeof vi> = {
  delivery: {
    month: '{{month}}/{{year}}',
    monthNav: 'Choose delivery month',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    showAll: 'Also show fully delivered requests',
    requests: 'Requests to deliver',
    empty: 'No requests left to deliver this month.',
    emptyAll: 'No requests this month.',
    noDepartment: 'No department',
    more: 'Show more',
    lines: 'Lines of {{name}}’s request',
    line: {
      qty: 'Deliver now',
      deliver: 'Deliver',
      qtyLabel: 'Deliver now {{name}}',
      deliverLabel: 'Deliver {{name}}',
      progress: 'delivered {{done}}/{{total}}',
      cancelled: 'cancelled {{n}}',
      remaining: '{{n}} left',
      done: 'Fully delivered',
      pending: 'Awaiting review — cannot deliver yet',
      rejected: 'Rejected',
      min: 'At least 1',
      max: 'At most {{max}}',
      invalid: 'Enter a whole number',
      available: 'Only {{available}} in stock',
      exceeds: 'Only {{remaining}} left to deliver',
      failed: 'Could not deliver — try again.',
    },
    all: {
      button: 'Deliver all',
      sending: 'Delivering…',
      delivered: 'Delivered {{n}} lines',
      failedList: 'Not delivered',
      failed: 'Not delivered: {{name}} — {{reason}}',
      skippedList: 'Skipped',
      skipped: '{{name}} — {{reason}}',
      reasons: {
        STOCK_INSUFFICIENT: 'only {{available}} in stock',
        LINE_NOT_REVIEWED: 'Awaiting review — cannot deliver yet',
        LINE_REJECTED: 'Rejected',
      },
    },
    notice: {
      STALE_UPDATE: 'This line was just delivered elsewhere — numbers updated',
      PERIOD_NOT_LOCKED: 'Period not locked yet — deliver after 00:00 on the 11th',
      LINE_NOT_REVIEWED: 'Line not reviewed yet — request reloaded.',
      LINE_REJECTED: 'Line was just rejected — request reloaded.',
      LINE_NOT_FOUND: 'Line is no longer on the request — request reloaded.',
      REQUEST_NOT_FOUND: 'Request not found.',
      UNKNOWN: 'Could not deliver — try again.',
    },
  },
};

export default delivery;
