import type vi from '@/locales/vi/send-adm';
import type { Messages } from '@/locales/messages';

const sendAdm: Messages<typeof vi> = {
  sendAdm: {
    title: 'Send to ADM, {{month}} period',
    description: 'The form follows the ADM department sheet. Print it for the Head of Dept. to sign, then send the Excel for ADM to paste into the department column.',
    unlocked: 'The {{month}} period is not locked yet, reopens after {{deadline}}.',
    unlockedNoDate: 'The {{month}} period is not locked yet.',
    actions: { print: 'Print for signing', xlsx: 'Export department Excel' },
    checklist: {
      title: 'Check before sending',
      unregistered: '{{n}} people have not registered',
      unregisteredOk: 'Everyone has registered',
      unregisteredLink: 'Period summary',
      outside: '{{n}} off-catalog items not approved yet',
      outsideOk: 'No off-catalog items waiting for review',
      outsideLink: 'Off-catalog items',
      deducted: 'Cabinet stock already deducted',
    },
    orders: {
      title: 'Quantities to request',
      note: 'Equals registrations plus backlog, minus cabinet stock. Edit to ask for extra; enter 0 to drop an item from the form.',
      label: 'Quantities to request by item',
      item: 'Item',
      need: 'Need',
      stock: 'Cabinet',
      qty: 'Request',
      qtyLabel: 'Request: {{name}}',
      invalid: 'From 0 to 99,999.',
      outside: 'Off-catalog',
      empty: 'No items to request for this period.',
    },
    preview: {
      label: 'A4 form preview, {{month}}/{{year}}',
    },
  },
};

export default sendAdm;
