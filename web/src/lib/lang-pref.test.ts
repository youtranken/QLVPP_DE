import { beforeEach, describe, expect, it } from 'vitest';
import {
  PENDING_TTL_MS,
  currentLanguage,
  normalizeLanguage,
  pendingAtServerSec,
  pendingIsNewer,
  resetMemoryForTest,
  serverClockOffsetMs,
  setPendingChoice,
  takePendingChoice,
} from '@/lib/lang-pref';

const T0 = 1_762_000_000_000; // ms

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetMemoryForTest();
});

describe('lang-pref (docs 7a)', () => {
  it('normalizeLanguage: en/en-US/en_US → en; thiếu/lạ → vi', () => {
    expect(normalizeLanguage('en')).toBe('en');
    expect(normalizeLanguage('en-US')).toBe('en');
    expect(normalizeLanguage('EN_us')).toBe('en');
    expect(normalizeLanguage('vi')).toBe('vi');
    expect(normalizeLanguage('fr')).toBe('vi');
    expect(normalizeLanguage(undefined)).toBe('vi');
    expect(normalizeLanguage(null)).toBe('vi');
  });

  it('currentLanguage: vpp_lang en/vi; lạ/thiếu → vi', () => {
    expect(currentLanguage()).toBe('vi');
    localStorage.setItem('vpp_lang', 'en');
    expect(currentLanguage()).toBe('en');
    localStorage.setItem('vpp_lang', 'de');
    expect(currentLanguage()).toBe('vi');
  });

  it('lựa chọn chờ: lấy một lần rồi xoá; quá 15 phút / hỏng → null', () => {
    setPendingChoice('en', T0);
    expect(takePendingChoice(T0 + 1000)).toEqual({ lang: 'en', at: T0 });
    expect(takePendingChoice(T0 + 1000)).toBeNull();
    setPendingChoice('en', T0);
    expect(takePendingChoice(T0 + PENDING_TTL_MS + 1)).toBeNull();
    sessionStorage.setItem('vpp_lang_pending', '{hỏng');
    expect(takePendingChoice(T0)).toBeNull();
    sessionStorage.setItem('vpp_lang_pending', JSON.stringify({ lang: 'fr', at: T0 }));
    expect(takePendingChoice(T0)).toBeNull();
  });

  it('lệch giờ: ưu tiên serverTime (ms), dự phòng header Date, không có → 0', () => {
    expect(serverClockOffsetMs(T0 + 120_000, null, T0)).toBe(120_000);
    expect(serverClockOffsetMs(undefined, new Date(T0 - 60_000).toUTCString(), T0)).toBe(-60_000);
    expect(serverClockOffsetMs('x', 'không phải ngày', T0)).toBe(0);
  });

  it('pendingAt theo giờ máy chủ, giây, làm tròn xuống — máy người dùng chậm 3 phút vẫn đúng', () => {
    // bấm lúc T0 theo máy (chậm 180 s so với máy chủ)
    expect(pendingAtServerSec(T0 + 999, 180_000)).toBe(Math.floor(T0 / 1000) + 180);
  });

  it('mới hơn thắng: locale_updated_at null/thiếu hoặc < pendingAt ⇒ lựa chọn chờ; ≥ pendingAt ⇒ PMH ID', () => {
    const p = 1_762_000_100;
    expect(pendingIsNewer(p, null)).toBe(true);
    expect(pendingIsNewer(p, undefined)).toBe(true);
    expect(pendingIsNewer(p, p - 1)).toBe(true);
    expect(pendingIsNewer(p, p)).toBe(false);
    expect(pendingIsNewer(p, p + 30)).toBe(false);
  });
});
