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
    month: '{{month, monthName}}',
    topics: {
      period_open: 'The {{month}} request period is open, register by the end of {{deadline}}.',
      reminder: 'You have not registered for {{month}} yet — register by the end of {{deadline}}.',
      period_locked: '{{month}} is locked: {{registered}}/{{headcount}} people registered.',
      period_lockedCustom: '{{month}} is closed: {{registered}}/{{headcount}} registered · {{custom}} off-catalog items to review.',
      low_stock: '{{name}} is running low, {{stock_qty}} left.',
      request_delivered: 'Your {{month}} request has been fully delivered.',
      line_cancelled: 'D&E Admin cancelled the remaining {{qty}} {{unit}} of {{name}} ({{month}}): {{reason}}',
      line_cancelledNoReason: 'D&E Admin cancelled the remaining {{qty}} {{unit}} of {{name}} ({{month}}).',
      custom_line_new: '{{person}} added an off-catalog item "{{name}}" ({{month}}).',
      line_review: {
        accepted: 'D&E Admin accepted the item "{{name}}" ({{month}}).',
        acceptedNote: 'D&E Admin accepted the item "{{name}}" ({{month}}): {{note}}',
        converted: 'The item "{{name}}" ({{month}}) was added to the catalog as {{item}}.',
        rejected: 'D&E Admin rejected the item "{{name}}" ({{month}}).',
        rejectedNote: 'D&E Admin rejected the item "{{name}}" ({{month}}): {{note}}',
      },
      line_adjusted: {
        one: 'D&E Admin reduced {{name}} {{before}} → {{after}} {{unit}} ({{month}} request): {{reason}}',
        removed: 'D&E Admin removed {{name}} ({{before}} {{unit}}) from your {{month}} request: {{reason}}',
        many: 'D&E Admin reduced {{n}} items in your {{month}} request. See History for reasons.',
        admOut: "{{name}} ({{qty}} {{unit}}) couldn't be delivered: out of stock at the supplier. Order again next month if you still need it.",
        more: '{{n}} more items — see History.',
      },
      user_left_with_work: {
        locked: '{{name}} was locked but still has {{work}}.',
        deleted: '{{name}} was deleted but still has {{work}}.',
        no_access: '{{name}} lost access to VPP but still has {{work}}.',
        owed_one: '{{count}} undelivered item ({{months}})',
        owed_other: '{{count}} undelivered items ({{months}})',
        months_one: '{{count}} month',
        months_other: '{{count}} months',
        pending_one: '{{count}} off-catalog item awaiting review',
        pending_other: '{{count}} off-catalog items awaiting review',
        open: 'Has a request in the open period.',
      },
      unknown: 'You have a new notification.',
    },
    fallback: {
      line_adjusted: 'D&E Admin reduced your request.',
      period_open: 'A new request period is open.',
      reminder: 'You have not registered for this period yet — register before the deadline.',
      period_locked: 'The request period is locked.',
      low_stock: 'An item is running low.',
      request_delivered: 'Your request has been fully delivered.',
      line_cancelled: 'D&E Admin cancelled the remaining quantity of an item.',
      custom_line_new: 'There is a new off-catalog item to review.',
      line_review: 'D&E Admin reviewed your off-catalog item.',
      user_left_with_work: 'Someone lost access to VPP but still has pending work.',
    },
  },
};

export default notifications;
