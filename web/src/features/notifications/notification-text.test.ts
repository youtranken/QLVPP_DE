import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { notificationText } from './notification-text';
import type { NotificationView } from './notifications.api';

const n = (topic: string, params: Record<string, unknown>): NotificationView => ({
  id: 'n1',
  topic,
  params,
  link: null,
  created_at: '2026-11-01T01:00:00.000Z',
  read_at: null,
});

const SAMPLES: NotificationView[] = [
  n('period_open', { ym: '2026-11', deadline: '2026-11-10T17:00:00.000Z' }),
  n('reminder', { ym: '2026-11', deadline: '2026-11-10T17:00:00.000Z' }),
  n('period_locked', { ym: '2026-11', registered: 18, headcount: 25 }),
  n('low_stock', { name: 'Bút bi xanh', name_en: 'Blue pen', stock_qty: 3 }),
  n('request_delivered', { ym: '2026-11' }),
  n('line_cancelled', { ym: '2026-11', name: 'Bút bi xanh', name_en: 'Blue pen', unit: 'hop', qty: 2, reason: 'Hết hàng' }),
  n('custom_line_new', { ym: '2026-11', name: 'Bìa còng', person: 'An' }),
  n('line_review', { ym: '2026-11', action: 'accepted', name: 'Bìa còng' }),
  n('line_review', { ym: '2026-11', action: 'rejected', name: 'Bìa còng', note: 'Đã có trong kho' }),
  n('line_review', { ym: '2026-11', action: 'converted', name: 'Bìa còng', item_name: 'Bìa còng A4', item_name_en: 'A4 ring binder' }),
];

describe('notificationText', () => {
  const vi = i18n.getFixedT('vi');
  const en = i18n.getFixedT('en');

  it('period_open vi: "tháng 11" và hạn là ngày cuối theo giờ VN (hạn 17:00Z ngày 10 = 00:00 ngày 11)', () => {
    expect(notificationText(SAMPLES[0], vi, 'vi')).toBe('Kỳ đăng ký tháng 11 đã mở, hạn đăng ký đến hết 10/11.');
  });

  it('period_open en: "November"', () => {
    expect(notificationText(SAMPLES[0], en, 'en')).toBe('The November request period is open, register by the end of 10/11.');
  });

  it('line_cancelled: tên món và đơn vị theo ngôn ngữ', () => {
    expect(notificationText(SAMPLES[5], vi, 'vi')).toBe('Hành chính hủy phần còn nợ 2 hộp Bút bi xanh (tháng 11): Hết hàng');
    expect(notificationText(SAMPLES[5], en, 'en')).toBe('Admin cancelled the remaining 2 box of Blue pen (November): Hết hàng');
  });

  it('line_review có/không ghi chú chọn đúng câu', () => {
    expect(notificationText(SAMPLES[7], vi, 'vi')).toBe('Hành chính đã chấp nhận món "Bìa còng" (tháng 11).');
    expect(notificationText(SAMPLES[8], vi, 'vi')).toBe('Hành chính từ chối món "Bìa còng" (tháng 11): Đã có trong kho');
    expect(notificationText(SAMPLES[9], en, 'en')).toBe('The item "Bìa còng" (November) was added to the catalog as A4 ring binder.');
  });

  it('custom_line_new thiếu tên người → "Một người"', () => {
    expect(notificationText(n('custom_line_new', { ym: '2026-11', name: 'X', person: null }), vi, 'vi')).toBe(
      'Một người thêm món ngoài danh mục "X" (tháng 11).',
    );
  });

  it('topic lạ → câu chung, không để lộ khóa', () => {
    expect(notificationText(n('future_topic', {}), vi, 'vi')).toBe('Bạn có thông báo mới.');
  });

  it.each(SAMPLES.map((s, i) => [`${s.topic}#${i}`, s] as const))('en %s: không còn ký tự tiếng Việt có dấu ngoài dữ liệu người dùng', (_k, sample) => {
    const text = notificationText(sample, en, 'en');
    expect(text).not.toBe('');
    const scrubbed = text.replace(/Bìa còng|Hết hàng|Đã có trong kho|Bút bi xanh/g, '');
    expect(scrubbed).not.toMatch(/[ạ-ỹà-ýăâêôơưđ]/i);
  });

  it('vi: mọi topic ra chuỗi không rỗng và không còn {{', () => {
    for (const s of SAMPLES) {
      const text = notificationText(s, vi, 'vi');
      expect(text).not.toBe('');
      expect(text).not.toContain('{{');
    }
  });
});
