import type vi from '@/locales/vi/home';
import type { Messages } from '@/locales/messages';

const home: Messages<typeof vi> = {
  home: {
    greeting: 'Hello {{name}}',
    stepsLabel: 'The 4 steps of the month',
    period: {
      label: 'Choose period',
      locked: 'Delivering period (month {{month}})',
      current: 'Sign-up period (month {{month}})',
    },
    hero: {
      titleStep: 'Month {{month}} is at the {{step}} step',
      titleDone: 'Month {{month}} is done',
      titleRegister: 'Month {{month}} is taking sign-ups',
      subDone: 'All 4 steps are done. Only closing the period is left.',
      subRegister: 'Locks automatically at 00:00 on {{date}}. Then print the ADM form.',
      sub: {
        register: 'Sign-ups are still open.',
        send: 'The period is locked. Print the form for signing or export Excel for ADM.',
        arrive: 'Enter the quantities ADM sent so they are added to the cabinet.',
        deliver: 'Goods are in. Deliver person by person, shortfalls become backlog.',
      },
    },
    step: {
      register: 'Sign-up',
      send: 'Send to ADM',
      arrive: 'Goods in',
      deliver: 'Delivery',
      later: 'After the period locks',
    },
    value: {
      register: '{{value}}',
      sendTodo: 'Not sent',
      sendDone: 'Sent',
      arriveTodo: '{{value}}',
      arriveDone: 'Fully stocked',
      deliverTodo: '{{value}}',
      deliverDone: 'All delivered',
      none: '—',
    },
    note: {
      registerOpen: 'Taking sign-ups',
      registerDone: 'Locked',
      sendTodo: 'Print for signing, export Excel',
      sendDone: '{{n}} saved copies',
      arriveTodo: 'units short against the cabinet',
      arriveDone: 'No item is short',
      deliverTodo: 'lines waiting to deliver',
      deliverDone: 'No line is waiting',
    },
    cta: {
      register: 'View summary',
      send: 'Open Send to ADM',
      arrive: 'Enter goods in',
      deliver: 'Open Delivery',
    },
    progress: '{{value}}% signed up',
    unregistered: {
      title: '{{n}} people have not signed up for month {{month}}',
      hint: 'Due 23:59 on day {{day}}. Remind early to make the ADM order.',
      more: 'and {{n}} others',
      copy: 'Copy reminder',
      all: 'See everyone',
    },
    custom: {
      title: '{{n}} out-of-catalog items waiting for review',
      open: 'Review waiting items',
    },
    low: {
      title: '{{n}} items in the cabinet running low',
      open: 'Open cabinet',
      stock: '{{n}} left',
    },
  },
};

export default home;
