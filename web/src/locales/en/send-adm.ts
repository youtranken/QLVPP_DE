import type vi from '@/locales/vi/send-adm';
import type { Messages } from '@/locales/messages';

const sendAdm: Messages<typeof vi> = {
  sendAdm: {
    actions: { print: 'Review summary', xlsx: 'Export department Excel' },
    orders: {
      title: 'Quantities to request',
      item: 'Item',
      registered: 'Requested',
      backlog: 'Carried over',
      stock: 'In stock (reference)',
      need: 'Total requested',
      qty: 'Order',
      qtyLabel: 'Request: {{name}}',
      invalid: 'Max 1,000',
      overMax: 'Over 1,000, please check',
    },
    leave: {
      title: 'Discard edited order numbers?',
      body: "You edited {{n}} items but haven't opened Review summary and tapped Agree and print. Leaving will lose them.",
      stay: 'Stay',
      discard: 'Discard changes',
    },
    noOrder: {
      action: 'No supplier order needed this month',
      title: 'No supplier order needed this month?',
      body: 'Stock already covers everyone who requested. The Send to supplier and Receiving steps will count as done; you can still make an order later.',
      back: 'Back',
      ok: 'Confirm',
      failed: 'Could not save, try again later.',
    },
    confirm: {
      title: 'Save the supplier order?',
      replaceTitle: 'This replaces the copy printed at {{time}}',
      changes: 'Changed from the copy of {{time}}:',
      change: '{{name}} {{x}} → {{y}}',
      more: 'and {{n}} more items',
      back: 'Back',
    },
  },
};

export default sendAdm;
