// Ngôn ngữ PMH ID (chuẩn đồng bộ danh bạ, mục 7a): claim `locale` ("vi" | "en", mặc định "vi")
// và tham số OIDC `ui_locales` (danh sách cách nhau khoảng trắng, ưu tiên trước).
export type AppLocale = 'vi' | 'en';

const SUPPORTED: readonly AppLocale[] = ['vi', 'en'];
// Thẻ BCP 47 đơn giản ("en", "en-US") — chặn ký tự lạ trước khi chuyển tiếp sang IdP
const TAG = /^[a-z]{2,3}(-[a-z0-9]{1,8})*$/;
const MAX_UI_LOCALES_LENGTH = 100;

function supported(tag: string): AppLocale | undefined {
  // "en_US" (kiểu POSIX) ≡ "en-US"
  const t = tag.trim().toLowerCase().replace(/_/g, '-');
  if (!TAG.test(t)) return undefined;
  const primary = t.split('-')[0] as AppLocale;
  return SUPPORTED.includes(primary) ? primary : undefined;
}

// MỘT thẻ, chặt (≤35 ký tự, không khoảng trắng) → vi | en; còn lại → undefined
export function parseLocaleTag(raw: unknown): AppLocale | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  if (!v || v.length > 35 || /\s/.test(v)) return undefined;
  return supported(v);
}

// Claim `locale` → vi | en; thiếu / lạ / sai kiểu → "vi"
export function normalizeLocale(raw: unknown): AppLocale {
  return (typeof raw === 'string' && supported(raw)) || 'vi';
}

// Claim `locale_updated_at` (giây epoch) → số; thiếu / null / lạ → null (= chưa từng đặt)
export function normalizeLocaleUpdatedAt(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0
    ? Math.floor(raw)
    : null;
}

// Query `ui_locales` từ web → giá trị hỗ trợ đầu tiên; không có → undefined (không gửi IdP)
export function parseUiLocales(raw: unknown): AppLocale | undefined {
  if (typeof raw !== 'string' || raw.length > MAX_UI_LOCALES_LENGTH) {
    return undefined;
  }
  for (const tag of raw.split(/\s+/)) {
    const hit = parseLocaleTag(tag);
    if (hit) return hit;
  }
  return undefined;
}
