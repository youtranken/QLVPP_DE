import type vi from '@/locales/vi/notifications';
import type { Messages } from '@/locales/messages';

const notifications: Messages<typeof vi> = {
  notifications: {
    title: 'Notifications',
    bell: 'Notifications, {{count}} unread',
    markAllRead: 'Mark all as read',
    empty: 'No notifications yet',
    loadMore: 'Show more',
    markError: 'Could not mark as read — try again.',
    loadError: 'Could not load notifications — try again.',
    someone: 'Someone',
    unreadMark: 'Unread',
    month: 'month {{month}}',
    topics: {
      period_open: 'The {{month}} request period is open, register by the end of {{deadline}}.',
      reminder: 'You have not registered for {{month}} yet — register by the end of {{deadline}}.',
      period_locked: '{{month}} is locked: {{registered}}/{{headcount}} people registered.',
      low_stock: '{{name}} is running low, {{stock_qty}} left.',
      request_delivered: 'Your {{month}} request has been fully delivered.',
      line_cancelled: 'Admin cancelled the remaining {{qty}} {{unit}} of {{name}} ({{month}}): {{reason}}',
      custom_line_new: '{{person}} added an off-catalog item "{{name}}" ({{month}}).',
      line_review: {
        accepted: 'Admin accepted the item "{{name}}" ({{month}}).',
        acceptedNote: 'Admin accepted the item "{{name}}" ({{month}}): {{note}}',
        converted: 'The item "{{name}}" ({{month}}) was added to the catalog as {{item}}.',
        rejected: 'Admin rejected the item "{{name}}" ({{month}}).',
        rejectedNote: 'Admin rejected the item "{{name}}" ({{month}}): {{note}}',
      },
      unknown: 'You have a new notification.',
    },
  },
};

export default notifications;
