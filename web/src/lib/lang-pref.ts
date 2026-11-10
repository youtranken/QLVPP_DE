// Ưu tiên ngôn ngữ phía trình duyệt (chuẩn PMH ID mục 7a). Không side effect khi import.
//
// Tài khoản PMH ID là nơi DUY NHẤT giữ ngôn ngữ của người dùng (claim `locale`, đổi qua
// PUT /api/me/locale). Trình duyệt chỉ giữ hai thứ KHÔNG phải ngôn ngữ của ai:
// - `vpp_lang` (localStorage) = ngôn ngữ dùng gần nhất — cho màn chưa đăng nhập (F5, đăng xuất, màn
//   đăng nhập) và làm `ui_locales`.
// - `vpp_lang_pending` (sessionStorage, hạn 15') = bấm VI/EN ở màn đăng nhập VPP; /me đầu tiên sau
//   đăng nhập trong tab này lấy một lần — khác claim và mới hơn thì áp + lưu vào PMH ID.
// Storage bị chặn: giữ trong bộ nhớ trang (đúng trong trang đó, mất khi tải lại).
export type AppLanguage = 'vi' | 'en';

const LAST_USED_KEY = 'vpp_lang'; // chỉ lưu ngôn ngữ — không bao giờ token
const PENDING_KEY = 'vpp_lang_pending';
export const PENDING_TTL_MS = 15 * 60 * 1000;

const memory = new Map<string, string>();
type Area = 'local' | 'session';
const area = (a: Area): Storage => (a === 'local' ? localStorage : sessionStorage);
const memKey = (a: Area, key: string) => `${a}:${key}`;

function read(key: string, a: Area = 'local'): string | null {
  try {
    return area(a).getItem(key);
  } catch {
    return memory.get(memKey(a, key)) ?? null;
  }
}
function write(key: string, value: string, a: Area = 'local'): void {
  memory.set(memKey(a, key), value);
  try {
    area(a).setItem(key, value);
  } catch {
    // giữ trong bộ nhớ trang
  }
}
function remove(key: string, a: Area = 'local'): void {
  memory.delete(memKey(a, key));
  try {
    area(a).removeItem(key);
  } catch {
    // bỏ qua
  }
}
function asLanguage(v: string | null): AppLanguage | null {
  return v === 'vi' || v === 'en' ? v : null;
}

// Chỉ cho test: xoá giá trị dự phòng trong bộ nhớ
export function resetMemoryForTest(): void {
  memory.clear();
}

// vi | en từ giá trị bất kỳ ("en-US", "en_US" → en); thiếu/lạ → vi
export function normalizeLanguage(raw: unknown): AppLanguage {
  if (typeof raw !== 'string') return 'vi';
  const primary = raw.trim().toLowerCase().replace(/_/g, '-').split('-')[0];
  return primary === 'en' ? 'en' : 'vi';
}

export function lastUsedLanguage(): AppLanguage | null {
  return asLanguage(read(LAST_USED_KEY));
}
export function rememberLastUsed(lang: AppLanguage): void {
  write(LAST_USED_KEY, lang);
}
// Ngôn ngữ app đang dùng (gửi PMH ID qua `ui_locales`)
export function currentLanguage(): AppLanguage {
  return lastUsedLanguage() ?? 'vi';
}

export interface PendingChoice {
  lang: AppLanguage;
  // Lúc bấm theo đồng hồ máy (ms epoch) — đổi sang giờ máy chủ ở /me (pendingAtServerSec)
  at: number;
}

// Bấm VI/EN ở màn đăng nhập (chưa biết là ai) — chờ /me đầu tiên sau đăng nhập trong tab này
export function setPendingChoice(lang: AppLanguage, now = Date.now()): void {
  write(PENDING_KEY, JSON.stringify({ lang, at: now }), 'session');
}

// Lấy (một lần) lựa chọn chờ còn hạn; luôn xoá. Hỏng/lạ/quá hạn → null
export function takePendingChoice(now = Date.now()): PendingChoice | null {
  const raw = read(PENDING_KEY, 'session');
  if (raw === null) return null;
  remove(PENDING_KEY, 'session');
  try {
    const v = JSON.parse(raw) as { lang?: unknown; at?: unknown };
    const lang = typeof v.lang === 'string' ? asLanguage(v.lang) : null;
    const at = typeof v.at === 'number' ? v.at : Number.NaN;
    const fresh = Number.isFinite(at) && now - at >= 0 && now - at <= PENDING_TTL_MS;
    return lang && fresh ? { lang, at } : null;
  } catch {
    return null;
  }
}

// Lệch giờ máy chủ − giờ máy (ms), đo ngay khi nhận /me. Ưu tiên `serverTime` (ms); thiếu/lạ → header
// `Date` (giây — lệch tối đa ~1 s về phía "cũ hơn", tức nghiêng về PMH ID); không có gì → 0.
export function serverClockOffsetMs(serverTime: unknown, serverDate: string | null | undefined, now = Date.now()): number {
  if (typeof serverTime === 'number' && Number.isFinite(serverTime) && serverTime > 0) {
    return serverTime - now;
  }
  const parsed = typeof serverDate === 'string' ? Date.parse(serverDate) : Number.NaN;
  return Number.isFinite(parsed) ? parsed - now : 0;
}

// pendingAt theo GIỜ MÁY CHỦ, giây epoch, làm tròn xuống (docs 7a)
export function pendingAtServerSec(atMs: number, offsetMs: number): number {
  return Math.floor((atMs + offsetMs) / 1000);
}

// Lựa chọn ở màn đăng nhập có MỚI HƠN lần đặt cuối ở PMH ID không: `locale_updated_at` null/thiếu ⇒
// lựa chọn thắng; `locale_updated_at >= pendingAt` ⇒ PMH ID thắng (người dùng bấm ở PMH ID sau)
export function pendingIsNewer(pendingAtSec: number, localeUpdatedAt: unknown): boolean {
  if (typeof localeUpdatedAt !== 'number' || !Number.isFinite(localeUpdatedAt)) return true;
  return localeUpdatedAt < pendingAtSec;
}
