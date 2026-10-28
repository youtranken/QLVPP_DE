import type vi from '@/locales/vi/request';
import type { Messages } from '@/locales/messages';

const request: Messages<typeof vi> = {
  request: {
    hero: {
      title: 'Month {{month}} order',
      daysLeft: 'days left',
      lastDay: 'Today is the last day',
      saved: 'Saved {{time}} · editable until end of {{date}}',
      notSaved: 'No order saved this month yet',
      unsaved: 'You have unsaved changes.',
    },
    grid: {
      label: 'Item catalog',
      search: 'Search items',
      searchPlaceholder: 'Search items…',
      categories: 'Item groups',
      all: 'All',
      addOther: 'Add another item',
      missingTitle: 'Can’t find what you need?',
      missingAction: 'Add it here',
      unitMax: '{{unit}} · max {{max}}/month',
      adminAdded: 'Added by Admin · {{qty}}',
      empty: 'No matching items — try another word or tap “Add another item”.',
      loadItemsError: 'Could not load the catalog — try again.',
    },
    cart: {
      title: 'My order',
      empty: 'Nothing picked yet — tap + on an item to add it.',
      total: '{{kinds}} items · {{units}} units',
      qty: '{{qty}} {{unit}}',
      custom: 'Not in catalog',
      adminAdded: 'Added by Admin',
      adminAddedHint: 'This line was added by Admin — contact them to change it',
      remove: 'Remove {{name}}',
      addOther: 'Add another item',
      save: 'Save order',
      saveDirty: '{{n}} unsaved change(s) · Save',
      count: '{{n}} items',
    },
    confirm: {
      title: 'Save month {{month}} order?',
      hint: 'You can still edit until the end of {{date}}.',
      emptyHint: 'The order has no items left — saving removes this month’s order.',
      back: 'Keep editing',
      submit: 'Save order',
      saving: 'Saving…',
    },
    toast: {
      saved: 'Month {{month}} order saved',
    },
    stale: {
      title: 'Your order was just updated elsewhere',
      body: 'It was changed on another device or by Admin. Your cart stays here so you can compare — tap “Reload” to get the latest version and pick again.',
      reload: 'Reload',
      keep: 'Review my cart',
    },
    errors: {
      PERIOD_LOCKED: 'Month {{month}} is closed — reload the page to order for month {{next}}.',
      LINES_EMPTY: 'Pick at least one item, then save.',
      DUPLICATE_ITEM: 'An item appears twice — reload the page, then save.',
      UNKNOWN: 'Not saved — check your connection and try again.',
      line: {
        QTY_INVALID: 'Quantity must be at least 1.',
        QTY_EXCEEDS_MAX: 'Max {{max}}/month.',
        QTY_BELOW_DELIVERED: 'Cannot be less than what was delivered.',
        ITEM_INACTIVE: 'This item was discontinued — remove it, then save again.',
        ITEM_NOT_FOUND: 'This item no longer exists — remove it, then save again.',
        ADMIN_ONLY_ITEM: 'Only Admin can order this item — remove it, then save again.',
        DUPLICATE_ITEM: 'This item is already in your order.',
        LINE_READONLY: 'This line is read-only — contact Admin to change it.',
        LINE_NOT_FOUND: 'This line no longer exists — reload the page.',
        IMAGE_REQUIRED: 'Items outside the catalog need a photo.',
        UNIT_REQUIRED: 'Choose a unit.',
        FILE_FORBIDDEN: 'This photo cannot be used — take another one.',
        OTHER: 'This line is not valid — please check it.',
      },
    },
  },
};

export default request;
