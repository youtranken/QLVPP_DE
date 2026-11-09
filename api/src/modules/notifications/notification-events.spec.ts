import { eventIds } from './notification-events';

describe('eventIds — công thức event_id §9 (+F5)', () => {
  it.each([
    ['periodOpen', eventIds.periodOpen('2026-12'), 'period_open:2026-12'],
    ['reminder', eventIds.reminder('2026-12'), 'reminder:2026-12'],
    ['periodLocked', eventIds.periodLocked('2026-11'), 'period_locked:2026-11'],
    [
      'requestDelivered',
      eventIds.requestDelivered('r', 2),
      'request_delivered:r:2',
    ],
    ['lineReview', eventIds.lineReview('l1'), 'line_review:l1'],
    ['customLineNew', eventIds.customLineNew('l1'), 'custom_line_new:l1'],
    ['lowStock có nhập', eventIds.lowStock('i', 'm9'), 'low_stock:i:m9'],
    [
      'lowStock chưa nhập (null → 0)',
      eventIds.lowStock('i', null),
      'low_stock:i:0',
    ],
    ['lineCancelled', eventIds.lineCancelled('l1', 3), 'line_cancelled:l1:3'],
    [
      'leftWork',
      eventIds.leftWork('sub-1', '1762650000123'),
      'left-work:sub-1:1762650000123',
    ],
  ])('%s → %s', (_name, actual, expected) => {
    expect(actual).toBe(expected);
  });

  it('requestDelivered lần giao 1 và 2 ra hai event_id khác nhau', () => {
    expect(eventIds.requestDelivered('r', 1)).not.toBe(
      eventIds.requestDelivered('r', 2),
    );
  });

  it('lineCancelled khác cancelled_qty ra event_id khác (hủy lần hai vẫn báo)', () => {
    expect(eventIds.lineCancelled('l1', 2)).not.toBe(
      eventIds.lineCancelled('l1', 3),
    );
  });
});
