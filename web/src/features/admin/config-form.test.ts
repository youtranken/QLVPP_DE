import { describe, expect, it } from 'vitest';
import { CONFIG } from './config-fixtures';
import { previewMonth } from './config-calendar';
import { contactSpec, newBox, periodSpec, signersSpec } from './config-form';

const period = (over: Partial<Record<'registration_last_day' | 'reminder_days_left' | 'default_max_qty', string>>) => ({
  ...periodSpec.fromConfig(CONFIG),
  ...over,
});

describe('previewMonth', () => {
  it('12/2026: 31 ngày, ngày 1 rơi vào thứ Ba → 1 ô trống đầu tuần', () => {
    const m = previewMonth('2026-12', 10, 3);
    expect(m.days).toHaveLength(31);
    expect(m.leadingBlanks).toBe(1);
  });

  it('hạn 10: ngày 9 mở, ngày 10 hạn, ngày 11 khóa', () => {
    const { days } = previewMonth('2026-12', 10, 3);
    expect(days[8].kind).toBe('open');
    expect(days[9].kind).toBe('deadline');
    expect(days[10].kind).toBe('locked');
  });

  it.each([
    [1, 10],
    [3, 8],
    [7, 4],
  ])('nhắc trước %i ngày (tính cả hôm nay) với hạn 10 → tô ngày %i', (reminder, day) => {
    const marked = previewMonth('2026-12', 10, reminder).days.filter((d) => d.reminder).map((d) => d.day);
    expect(marked).toEqual([day]);
  });

  it.each([0, 8, null])('nhắc %s (ngoài 1–7) → không tô ngày nào', (reminder) => {
    expect(previewMonth('2026-12', 10, reminder).days.some((d) => d.reminder)).toBe(false);
  });

  it('hạn 3: nhắc 2 tô ngày 2, nhắc 3 (không nhỏ hơn hạn) không tô', () => {
    expect(previewMonth('2026-12', 3, 2).days.filter((d) => d.reminder).map((d) => d.day)).toEqual([2]);
    expect(previewMonth('2026-12', 3, 3).days.some((d) => d.reminder)).toBe(false);
  });

  it('tháng 2/2027 có 28 ngày, hạn 28 → không ngày nào khóa', () => {
    const { days } = previewMonth('2027-02', 28, 3);
    expect(days).toHaveLength(28);
    expect(days.some((d) => d.kind === 'locked')).toBe(false);
  });
});

describe('periodSpec', () => {
  it('chỉ đưa vào bản vá khóa đã đổi; "07" bằng 7 không tính là đổi', () => {
    expect(periodSpec.patchOf(period({ registration_last_day: '010' }), CONFIG)).toEqual({});
    expect(periodSpec.patchOf(period({ reminder_days_left: '4' }), CONFIG)).toEqual({ reminder_days_left: 4 });
  });

  it.each(['2', '29', '3', '28'])('ngày hạn %s là số nguyên → không chặn ở client (server quyết)', (v) => {
    expect(periodSpec.validate(period({ registration_last_day: v }))).toEqual({});
  });

  it.each(['', '1.5', 'abc'])('ngày hạn "%s" không phải số → lỗi ô', (v) => {
    expect(periodSpec.validate(period({ registration_last_day: v }))).toEqual({ registration_last_day: 'config.errors.registration_last_day' });
  });

  it.each([
    ['1', {}],
    ['999', {}],
    ['0', { default_max_qty: 'config.errors.default_max_qty' }],
    ['1000', { default_max_qty: 'config.errors.default_max_qty' }],
  ])('tối đa mặc định %s', (v, expected) => {
    expect(periodSpec.validate(period({ default_max_qty: v }))).toEqual(expected);
  });

  it.each([
    ['2', 'config.errors.registration_last_day'],
    ['3', 'config.errors.lastDayBelowReminder'],
    ['28', 'config.errors.lastDayBelowReminder'],
    ['29', 'config.errors.registration_last_day'],
  ])('server từ chối ngày hạn %s → %s', (v, key) => {
    expect(periodSpec.errorOf('registration_last_day', period({ registration_last_day: v }))).toEqual({ registration_last_day: key });
  });

  it('lỗi không gắn được ô (mạng, mã khác) → lỗi cả khối', () => {
    expect(periodSpec.errorOf(null, period({}))).toEqual({ form: 'config.errors.UNKNOWN' });
  });
});

describe('signersSpec', () => {
  const boxes = (titles: string[]) => titles.map((title) => newBox({ title, title_en: '', name: '' }));

  it.each([
    ['a'.repeat(60), {}],
    ['a'.repeat(61), { 'signature_boxes.0.title': 'config.errors.boxTitle' }],
    ['   ', { 'signature_boxes.0.title': 'config.errors.boxTitle' }],
  ])('chức danh dài %#', (title, expected) => {
    expect(signersSpec.validate(boxes([title]))).toEqual(expected);
  });

  it('người ký 200 qua, 201 lỗi ở đúng hàng', () => {
    const d = [newBox({ title: 'A', title_en: '', name: 'a'.repeat(200) }), newBox({ title: 'B', title_en: '', name: 'a'.repeat(201) })];
    expect(signersSpec.validate(d)).toEqual({ 'signature_boxes.1.name': 'config.errors.signer' });
  });

  it('bản vá gửi mảng đã trim, không kèm id; không đổi thì rỗng', () => {
    const same = signersSpec.fromConfig(CONFIG);
    expect(signersSpec.patchOf(same, CONFIG)).toEqual({});
    same[0] = { ...same[0], name: '  An  ' };
    expect(signersSpec.patchOf(same, CONFIG)).toEqual({ signature_boxes: [{ ...CONFIG.signature_boxes[0], name: 'An' }, CONFIG.signature_boxes[1]] });
  });

  it('field signature_boxes (số ô) → lỗi cả khối; signature_boxes.2.name → ô hàng 3', () => {
    expect(signersSpec.errorOf('signature_boxes', [])).toEqual({ form: 'config.errors.boxes' });
    expect(signersSpec.errorOf('signature_boxes.2.name', [])).toEqual({ 'signature_boxes.2.name': 'config.errors.signer' });
  });
});

describe('contactSpec', () => {
  it('liên hệ 500 qua, 501 lỗi; công tắc chỉ gửi khi đổi', () => {
    expect(contactSpec.validate({ admin_contact: 'a'.repeat(500), low_stock_notify: true })).toEqual({});
    expect(contactSpec.validate({ admin_contact: 'a'.repeat(501), low_stock_notify: true })).toEqual({ admin_contact: 'config.errors.admin_contact' });
    expect(contactSpec.patchOf({ admin_contact: CONFIG.admin_contact, low_stock_notify: false }, CONFIG)).toEqual({ low_stock_notify: false });
  });
});
