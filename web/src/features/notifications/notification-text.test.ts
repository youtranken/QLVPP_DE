import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { SEED_UNITS } from '@/test/fixtures-units';
import { notificationText as render } from './notification-text';
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
  n('user_left_with_work', { name: 'Bìa còng', reason: 'locked', owed_lines: 3, owed_months: 2, pending_lines: 1, open_request: true }),
];

const unitNameIn = (lang: string) => (code: string) => {
  const u = SEED_UNITS.find((x) => x.code === code);
  return !u ? code : lang === 'en' && u.name_en ? u.name_en : u.name;
};
const notificationText = (n: NotificationView, t: typeof i18n.t, lang: string) => render(n, t, lang, unitNameIn(lang));

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
    expect(notificationText(SAMPLES[5], vi, 'vi')).toBe('Adm D&E hủy phần còn chờ nhận 2 hộp Bút bi xanh (tháng 11): Hết hàng');
    expect(notificationText(SAMPLES[5], en, 'en')).toBe('D&E Admin cancelled the remaining 2 box of Blue pen (November): Hết hàng');
  });

  it('line_review có/không ghi chú chọn đúng câu', () => {
    expect(notificationText(SAMPLES[7], vi, 'vi')).toBe('Adm D&E đã chấp nhận món "Bìa còng" (tháng 11).');
    expect(notificationText(SAMPLES[8], vi, 'vi')).toBe('Adm D&E từ chối món "Bìa còng" (tháng 11): Đã có trong kho');
    expect(notificationText(SAMPLES[9], en, 'en')).toBe('The item "Bìa còng" (November) was added to the catalog as A4 ring binder.');
  });

  it('line_review app tự ghi Không mua: lý do đi bằng note_code, dịch theo ngôn ngữ người đọc', () => {
    const auto = n('line_review', { ym: '2026-11', action: 'rejected', name: 'Bìa còng', note_code: 'not_approved' });
    expect(notificationText(auto, vi, 'vi')).toBe('Adm D&E từ chối món "Bìa còng" (tháng 11): Sản phẩm không được duyệt mua tháng này. Bạn có thể đăng ký lại sau');
    expect(notificationText(auto, en, 'en')).toBe('D&E Admin rejected the item "Bìa còng" (November): This item was not approved for purchase this month. You can register it again later');
  });

  it('line_review note_code lạ → câu từ chối không lý do', () => {
    expect(notificationText(n('line_review', { ym: '2026-11', action: 'rejected', name: 'Bìa còng', note_code: 'xyz' }), vi, 'vi')).toBe('Adm D&E từ chối món "Bìa còng" (tháng 11).');
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

  describe('thiếu tham số → câu dự phòng theo topic, không ra câu gãy', () => {
    const cases: [string, Record<string, unknown>, string, string][] = [
      ['period_open', { ym: '2026-11' }, 'Kỳ đăng ký mới đã mở.', 'A new request period is open.'],
      ['period_open', { deadline: '2026-11-10T17:00:00.000Z' }, 'Kỳ đăng ký mới đã mở.', 'A new request period is open.'],
      ['reminder', { ym: '2026-11', deadline: null }, 'Bạn chưa đăng ký kỳ này — nhớ đăng ký trước hạn.', 'You have not registered for this period yet — register before the deadline.'],
      ['period_locked', { ym: '2026-10' }, 'Kỳ đăng ký đã khóa.', 'The request period is locked.'],
      ['period_locked', { ym: '2026-10', registered: 3 }, 'Kỳ đăng ký đã khóa.', 'The request period is locked.'],
      ['low_stock', { name: 'Bút' }, 'Có món sắp hết kho.', 'An item is running low.'],
      ['low_stock', { stock_qty: 2 }, 'Có món sắp hết kho.', 'An item is running low.'],
      ['request_delivered', {}, 'Phiếu của bạn đã được giao đủ.', 'Your request has been fully delivered.'],
      ['line_cancelled', { ym: '2026-11', qty: 2 }, 'Adm D&E đã hủy phần còn chờ nhận của một món.', 'D&E Admin cancelled the remaining quantity of an item.'],
      ['custom_line_new', { ym: '2026-11', person: 'An' }, 'Có món ngoài danh mục mới cần xem.', 'There is a new off-catalog item to review.'],
      ['line_review', { action: 'accepted', name: 'Bìa' }, 'Adm D&E đã xem món ngoài danh mục của bạn.', 'D&E Admin reviewed your off-catalog item.'],
      ['line_review', { ym: '2026-11', action: 'converted', name: 'Bìa' }, 'Adm D&E đã xem món ngoài danh mục của bạn.', 'D&E Admin reviewed your off-catalog item.'],
      ['period_open', { ym: 'abc', deadline: '2026-11-10T17:00:00.000Z' }, 'Kỳ đăng ký mới đã mở.', 'A new request period is open.'],
    ];
    it.each(cases)('%s %j', (topic, params, viText, enText) => {
      expect(notificationText(n(topic, params), vi, 'vi')).toBe(viText);
      expect(notificationText(n(topic, params), en, 'en')).toBe(enText);
    });

    it('period_locked custom_pending > 0 → thêm "· N món ngoài danh mục chờ xem"; = 0 → câu thường', () => {
      const locked = (custom_pending: number) => n('period_locked', { ym: '2026-10', registered: 6, headcount: 8, custom_pending });
      expect(notificationText(locked(2), vi, 'vi')).toBe('Kỳ tháng 10 đã khóa: 6/8 người đã đăng ký · 2 món ngoài danh mục chờ xem.');
      expect(notificationText(locked(2), en, 'en')).toBe('October is closed: 6/8 registered · 2 off-catalogue items to review.');
      expect(notificationText(locked(0), vi, 'vi')).toBe('Kỳ tháng 10 đã khóa: 6/8 người đã đăng ký.');
    });

    it('period_locked có registered = 0 vẫn là câu đầy đủ (0 không phải thiếu)', () => {
      expect(notificationText(n('period_locked', { ym: '2026-10', registered: 0, headcount: 25 }), vi, 'vi')).toBe('Kỳ tháng 10 đã khóa: 0/25 người đã đăng ký.');
    });

    it('line_cancelled thiếu lý do → câu kết thúc bằng dấu chấm, không có ": " treo', () => {
      const text = notificationText(n('line_cancelled', { ym: '2026-11', name: 'Bút bi xanh', unit: 'hop', qty: 2 }), vi, 'vi');
      expect(text).toBe('Adm D&E hủy phần còn chờ nhận 2 hộp Bút bi xanh (tháng 11).');
    });
  });
});
