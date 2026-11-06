import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { SEED_UNITS } from '@/test/fixtures-units';
import { notificationText } from './notification-text';
import type { NotificationView } from './notifications.api';

const bell = (params: Record<string, unknown>): NotificationView => ({
  id: 'n1',
  topic: 'line_adjusted',
  params,
  link: '/history/2026-12',
  created_at: '2026-12-13T02:10:00.000Z',
  read_at: null,
});
const unitNameIn = (lang: string) => (code: string) => {
  const u = SEED_UNITS.find((x) => x.code === code);
  return !u ? code : lang === 'en' && u.name_en ? u.name_en : u.name;
};
const text = (params: Record<string, unknown>, lang: 'vi' | 'en') =>
  notificationText(bell(params), i18n.getFixedT(lang), lang, unitNameIn(lang));

const PEN = { kind: 'adjust', name: 'Bút bi', name_en: 'Ballpoint pen', unit: 'cay' };
const cut = (before: number, after: number, reason_code = 'over_quota', reason_note: string | null = null) => ({
  ...PEN,
  before,
  after,
  reason_code,
  reason_note,
});
const TAPE = { kind: 'adm_out', name: 'Băng keo', name_en: null, unit: 'cuon', qty: 2, reason_code: 'adm_out_of_stock' };

describe('chuông ngày line_adjusted', () => {
  it('one vi/en: giảm một dòng, lý do theo mã', () => {
    const p = { ym: '2026-12', lines: [cut(5, 3)], more: 0 };
    expect(text(p, 'vi')).toBe('Hành chính giảm Bút bi 5 → 3 cây (phiếu tháng 12): Vượt định mức');
    expect(text(p, 'en')).toBe('Admin reduced Ballpoint pen 5 → 3 stick (December request): Over quota');
  });

  it('removed vi/en: bỏ dòng; lý do "other" hiện chính ghi chú, mã khác thì "nhãn: ghi chú"', () => {
    const other = { ym: '2026-12', lines: [cut(4, 0, 'other', 'phòng đã đủ')], more: 0 };
    expect(text(other, 'vi')).toBe('Hành chính bỏ Bút bi (4 cây) khỏi phiếu tháng 12: phòng đã đủ');
    const dup = { ym: '2026-12', lines: [cut(4, 0, 'duplicate', 'trùng phiếu An')], more: 0 };
    expect(text(dup, 'en')).toBe('Admin removed Ballpoint pen (4 stick) from your December request: Duplicate of another request: trùng phiếu An');
  });

  it('many vi/en: 1 giảm + 1 bỏ → đếm món', () => {
    const p = { ym: '2026-12', lines: [cut(5, 3), cut(2, 0, 'duplicate')], more: 0 };
    expect(text(p, 'vi')).toBe('Hành chính giảm 2 món trong phiếu tháng 12. Xem lý do trong Lịch sử.');
    expect(text(p, 'en')).toBe('Admin reduced 2 items in your December request. See History for reasons.');
  });

  it('5 dòng + more 1 → many đếm 6 món', () => {
    const p = { ym: '2026-12', lines: [1, 2, 3, 4, 5].map(() => cut(5, 3)), more: 1 };
    expect(text(p, 'vi')).toBe('Hành chính giảm 6 món trong phiếu tháng 12. Xem lý do trong Lịch sử.');
  });

  it('ADM hết hàng vi/en: "Băng keo (2 cuộn) không giao được: ADM hết hàng. Tháng sau cần thì đăng ký lại."', () => {
    const p = { ym: '2026-12', lines: [TAPE], more: 0 };
    expect(text(p, 'vi')).toBe('Băng keo (2 cuộn) không giao được: ADM hết hàng. Tháng sau cần thì đăng ký lại.');
    expect(text(p, 'en')).toBe("Băng keo (2 roll) couldn't be delivered: out of stock at ADM. Order again next month if you still need it.");
  });

  it('gộp cùng ngày: dòng giảm + dòng ADM hết hàng → hai câu trong một chuông', () => {
    const p = { ym: '2026-12', lines: [cut(5, 3), TAPE], more: 0 };
    expect(text(p, 'vi')).toBe(
      'Hành chính giảm Bút bi 5 → 3 cây (phiếu tháng 12): Vượt định mức Băng keo (2 cuộn) không giao được: ADM hết hàng. Tháng sau cần thì đăng ký lại.',
    );
  });

  it('chỉ dòng ADM hết hàng mà còn more → thêm câu "Còn n món khác"', () => {
    const p = { ym: '2026-12', lines: [1, 2, 3, 4, 5].map(() => TAPE), more: 2 };
    expect(text(p, 'vi')).toMatch(/đăng ký lại\. Còn 2 món khác — xem trong Lịch sử\.$/);
  });

  it('en: name_en null → tên vi', () => {
    const p = { ym: '2026-12', lines: [{ ...cut(5, 3), name_en: null }], more: 0 };
    expect(text(p, 'en')).toBe('Admin reduced Bút bi 5 → 3 stick (December request): Over quota');
  });

  it('thiếu lines hoặc ym hỏng → câu dự phòng', () => {
    expect(text({ ym: '2026-12', lines: [], more: 0 }, 'vi')).toBe('Hành chính đã giảm phiếu của bạn.');
    expect(text({ ym: 'x', lines: [cut(5, 3)], more: 0 }, 'en')).toBe('Admin reduced your request.');
  });
});
