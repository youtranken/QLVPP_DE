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
    period: 'Period',
    allPeriods: 'All periods',
    month: 'Month {{month}}/{{year}}',
    empty: 'Nothing here',
    emptyPending: 'Nothing left to review',
    staleNotice: 'This line was just handled — the list has been refreshed.',
    card: {
      imageAlt: 'Photo of {{name}}',
      noImage: 'No photo',
      qty: '{{qty}} {{unit}}',
      note: '“{{note}}”',
      who: '{{name}} · {{department}}',
      noDepartment: 'No department',
      unknownUser: 'Deleted user',
      period: 'Request {{month}}/{{year}}',
      previouslyAccepted: 'Accepted last period → consider adding to catalog',
    },
    actions: {
      label: 'Handle {{name}}',
      accept: 'Accept',
      convert: 'Add to catalog…',
      reject: 'Reject…',
      named: '{{action}} — {{name}}',
      unitMismatch: 'The catalog item uses a different unit than the original line — check quantity {{qty}}.',
    },
    status: {
      accepted: 'Accepted',
      converted: 'Added to catalog',
      rejected: 'Rejected',
      rejectedWhy: 'Rejected: {{reason}}',
    },
    accept: {
      title: 'Accept “{{name}}”?',
      body: 'The line is bought and delivered as requested; no catalog item is created.',
      ok: 'Accept',
    },
    reject: {
      title: 'Reject “{{name}}”',
      reason: 'Reason',
      hint: 'The requester will see this reason (at least 3 characters).',
      submit: 'Reject',
    },
    convert: {
      title: 'Add “{{name}}” to catalog',
      mode: 'Attach line to',
      modeNew: 'New item',
      modeExisting: 'Existing item',
      existing: 'Catalog item',
      existingPlaceholder: 'Choose an item…',
      existingOption: '{{name}} ({{unit}})',
      unitMismatch: 'Unit differs from the original line ({{unit}}) — quantity {{qty}} will count in the new unit.',
      submit: 'Add to catalog',
    },
    saving: 'Saving…',
    errors: {
      LINE_ALREADY_REVIEWED: 'This line was just handled',
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
