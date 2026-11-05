import type vi from '@/locales/vi/arrivals';
import type { Messages } from '@/locales/messages';

const arrivals: Messages<typeof vi> = {
  arrivals: {
    title: 'Goods arriving, {{month}} period',
    description: 'Enter the quantity that arrived per item. Boxes are prefilled with To buy; enter 0 to skip an item that has not arrived. Stock is added on save.',
    unlocked: 'The {{month}} period is not locked yet, come back after {{deadline}}.',
    unlockedNoDate: 'The {{month}} period is not locked yet.',
    stats: {
      toReceive: 'Items to receive',
      toReceiveSub: 'Items still short in stock',
      units: 'Total units arriving',
      unitsSub: 'Added to stock on save',
      done: 'Items covered',
      doneSub: 'Arrival covers To buy',
      unit: 'items',
      unitsUnit: 'units',
    },
    table: {
      label: 'Goods arriving by item',
      item: 'Item',
      waiting: 'Awaiting',
      stock: 'In stock',
      qty: 'Arriving now',
      status: 'Status',
      after: 'Stock after save',
      qtyLabel: 'Arriving now: {{name}}',
      empty: 'Nothing needs receiving. Use Add another item if goods arrived outside the list.',
    },
    tag: { short: 'Short', over: 'Over', exact: 'Covered' },
    errors: {
      invalid: 'Enter a whole number, 0 or more',
      max: 'At most 99,999',
    },
    add: {
      open: 'Add another item',
      pick: 'Choose item',
      pickPlaceholder: 'Pick an item from the catalogue',
      confirm: 'Add to table',
      none: 'Every catalogue item is already in the table.',
    },
    note: { label: 'Batch note (optional)', placeholder: 'e.g. ADM split batch 2, A4 paper due next week' },
    reset: 'Reset suggested numbers',
    save: 'Save arrivals',
    saving: 'Saving…',
    saved: 'Added {{n}} items to stock.',
    savedNext: 'Next: Delivery',
    toDelivery: 'Delivery',
    stale: 'Stock just changed, check the numbers and save again',
    saveFailed: 'Could not save the arrivals. Try again later.',
    outside: '{{n}} items outside the catalogue are delivered directly, not through stock',
  },
};

export default arrivals;
