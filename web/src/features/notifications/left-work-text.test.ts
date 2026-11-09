import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { notificationText } from './notification-text';
import type { NotificationView } from './notifications.api';

const bell = (params: Record<string, unknown>): NotificationView => ({
  id: 'n1',
  topic: 'user_left_with_work',
  params,
  link: '/admin/delivery?person=s1',
  created_at: '2026-11-09T02:10:00.000Z',
  read_at: null,
});
const text = (params: Record<string, unknown>, lang: 'vi' | 'en') =>
  notificationText(bell(params), i18n.getFixedT(lang), lang, (c) => c);

const FULL = { name: 'Nguyễn Văn A', reason: 'locked', owed_lines: 3, owed_months: 2, pending_lines: 1, open_request: true };

describe('chuông user_left_with_work (Hành chính)', () => {
  it('vi/en đủ: ai, vì sao, còn gì, có phiếu kỳ đang mở', () => {
    expect(text(FULL, 'vi')).toBe(
      'Nguyễn Văn A bị khoá nhưng còn 3 món chưa nhận (2 tháng), 1 món ngoài danh mục chờ duyệt. Có phiếu kỳ đang mở.',
    );
    expect(text(FULL, 'en')).toBe(
      'Nguyễn Văn A was locked but still has 3 undelivered items (2 months), 1 off-catalog item awaiting review. Has a request in the open period.',
    );
  });

  it('lý do xoá / mất quyền; phần bằng 0 không in; số ít en', () => {
    expect(text({ ...FULL, reason: 'deleted', pending_lines: 0, open_request: false }, 'vi')).toBe(
      'Nguyễn Văn A bị xoá nhưng còn 3 món chưa nhận (2 tháng).',
    );
    expect(text({ ...FULL, reason: 'no_access', owed_lines: 0, owed_months: 0, open_request: false }, 'vi')).toBe(
      'Nguyễn Văn A mất quyền vào VPP nhưng còn 1 món ngoài danh mục chờ duyệt.',
    );
    expect(text({ ...FULL, owed_lines: 1, owed_months: 1, pending_lines: 0, open_request: false }, 'en')).toBe(
      'Nguyễn Văn A was locked but still has 1 undelivered item (1 month).',
    );
  });

  it('thiếu tên / lý do lạ / không còn việc → câu dự phòng', () => {
    for (const p of [{ ...FULL, name: '' }, { ...FULL, reason: 'weird' }, { ...FULL, owed_lines: 0, pending_lines: 0 }]) {
      expect(text(p, 'vi')).toBe('Một người mất quyền vào VPP nhưng còn việc dở.');
      expect(text(p, 'en')).toBe('Someone lost access to VPP but still has pending work.');
    }
  });
});
