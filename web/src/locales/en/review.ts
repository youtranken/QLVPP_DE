import type vi from '@/locales/vi/review';
import type { Messages } from '@/locales/messages';

const review: Messages<typeof vi> = {
  review: {
    filters: {
      label: 'Status',
      pending: 'To review',
      accepted: 'Accepted',
      converted: 'Added to catalog',
      rejected: 'Rejected',
    },
    page: {
      description: 'Items staff added to their requests — check each one before buying.',
      note: 'Accept = buy separately this once. Add to catalog = everyone can order it from next period.',
    },
    period: 'Period',
    allPeriods: 'All periods',
    month: 'Month {{month}}/{{year}}',
    empty: {
      pending: 'Nothing left to review',
      pendingAction: 'See accepted items',
      accepted: 'No item accepted yet',
      converted: 'No item added to the catalog yet',
      rejected: 'No item rejected yet',
    },
    staleNotice: 'This line was just handled — the list has been refreshed.',
    card: {
      imageAlt: 'Photo of {{name}} sent by staff',
      noImage: 'No photo',
      qty: '{{qty}} {{unit}}',
      note: '“{{note}}”',
      qtyPeriod: '{{qty}} {{unit}} · Request {{month}}/{{year}}',
      who: '{{name}} · {{department}} · added {{at}}',
      badge: { accepted: 'Accepted', converted: 'Added to catalog', rejected: 'Rejected' },
      decision: {
        accepted: 'Bought separately this once — not added to the catalog.',
        converted: 'In the catalog — everyone can order it from next period.',
        rejected: 'Reason: {{reason}}',
      },
      justNow: 'just now',
      noDepartment: 'No department',
      unknownUser: 'Deleted user',
      previouslyAccepted: 'Accepted last period → consider adding to catalog',
    },
    actions: {
      label: 'Handle {{name}}',
      accept: 'Accept',
      convert: 'Add to catalog',
      reject: 'Reject',
      named: '{{action}} — {{name}}',
      unitMismatch: 'The catalog item uses a different unit than the original line — check quantity {{qty}}.',
    },
    status: {
      accepted: 'Accepted',
      converted: 'Added to catalog',
      rejected: 'Rejected',
      rejectedWhy: 'Rejected: {{reason}}',
    },
    toast: {
      accepted: 'Accepted {{name}}',
      rejected: 'Rejected {{name}}',
      converted: 'Added {{name}} to the catalog',
      linked: 'Linked {{name}} to {{item}}',
    },
    accept: {
      title: 'Accept “{{name}}”?',
      body: 'The line is bought and delivered as requested; no catalog item is created.',
      bodyFor:
        'Admin will buy {{qty}} {{unit}} for {{who}}’s request of month {{month}}. The item is not added to the catalog — next month staff must add it again.',
      ok: 'Accept',
    },
    reject: {
      title: 'Reject “{{name}}”',
      reason: 'Reason',
      hint: 'At least 3 characters. Write it for the requester to read.',
      submit: 'Reject',
    },
    convert: {
      title: 'Add “{{name}}” to catalog',
      mode: 'Attach line to',
      modeNew: 'New item',
      modeExisting: 'Existing item',
      existing: 'Catalog item',
      search: 'Search catalog items',
      noMatch: 'No matching item',
      countsIn: 'counted in {{unit}} · {{category}}',
      noCategory: 'no category',
      existingPlaceholder: 'Choose an item…',
      existingOption: '{{name}} ({{unit}})',
      unitMismatch: 'Unit differs from the original line ({{unit}}) — quantity {{qty}} will count in the new unit.',
      unitMismatchExisting:
        'Staff asked in “{{from}}”, {{item}} is counted in “{{to}}”. Quantity stays {{qty}} — check with {{who}}.',
      whoFallback: 'the requester',
      imageFromStaff: 'The photo staff sent is used as the item photo; change it later in Catalog.',
      submit: 'Add to catalog',
    },
    back: 'Back',
    saving: 'Saving…',
    errors: {
      LINE_ALREADY_REVIEWED: 'This line was just handled elsewhere.',
      LINE_NOT_FOUND: 'This line is no longer on the request',
      REASON_REQUIRED: 'Enter a reason (at least 3 characters).',
      ITEM_NOT_FOUND: 'This item is no longer in the catalog — choose another.',
      ITEM_INACTIVE: 'This item is retired — choose another.',
      CATEGORY_REQUIRED: 'Choose a category for the new item.',
      NAME_REQUIRED: 'Enter the item name.',
      VALIDATION: 'Some details are invalid, please check.',
      UNKNOWN: 'Could not save, please try again.',
    },
  },
};

export default review;
