import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import vi from '@/locales/vi';
import en from '@/locales/en';
import {
  currentLanguage,
  normalizeLanguage,
  pendingAtServerSec,
  pendingIsNewer,
  rememberLastUsed,
  serverClockOffsetMs,
  setPendingChoice,
  takePendingChoice,
} from '@/lib/lang-pref';
import type { AppLanguage } from '@/lib/lang-pref';
import { saveLocaleToIdp } from '@/lib/locale-sync';

export type Lang = AppLanguage;

// Ngôn ngữ theo tài khoản PMH ID (docs 7a). Trạng thái của TRANG đang mở (mất khi tải lại):
// - `session`: đã tải /me; `idp` = phiên SSO (/me có `locale`) — chỉ khi đó mới lưu vào PMH ID;
//   SA local / tài khoản thử / dev chỉ đổi tại chỗ như trước.
// - `pageChoice`: người dùng đã chọn trong trang này — /me xử lý lại không hoàn tác nó.
// - `saving`: lượt lưu đang chạy — bấm tiếp thì huỷ lượt cũ.
let session: { csrfToken: string | null; idp: boolean } | null = null;
let pageChoice: AppLanguage | null = null;
let saving: AbortController | null = null;

// Thứ tự LẦN BẤM gửi kèm mỗi lượt lưu: `page` ngẫu nhiên theo lần tải trang, `seq` tăng dần
function newPageId(): string {
  const rand = Math.random().toString(36).slice(2, 12).padEnd(10, '0');
  return `${Date.now().toString(36)}-${rand}`;
}
let pageId = newPageId();
let clickSeq = 0;

// Chỉ cho test: như tải lại trang
export function resetLanguageStateForTest(): void {
  session = null;
  pageChoice = null;
  saving?.abort();
  saving = null;
  pageId = newPageId();
  clickSeq = 0;
}

// Ngôn ngữ trình duyệt nhớ (màn chưa đăng nhập)
export function savedLanguage(): Lang {
  return currentLanguage();
}

function applyDocumentLanguage(lang: Lang): void {
  document.documentElement.lang = lang;
  document.title = i18n.t('app.title');
}

// Một chỗ đổi ngôn ngữ: i18next + <html lang>/title + nhớ "dùng gần nhất" (chỉ để hiển thị)
async function applyLanguage(lang: Lang): Promise<void> {
  rememberLastUsed(lang);
  await i18n.changeLanguage(lang);
  applyDocumentLanguage(lang);
}

function save(lang: Lang): void {
  saving?.abort();
  const controller = new AbortController();
  saving = controller;
  clickSeq += 1;
  void saveLocaleToIdp(lang, session?.csrfToken ?? null, controller.signal, { page: pageId, seq: clickSeq }).finally(
    () => {
      if (saving === controller) saving = null;
    },
  );
}

// Người dùng bấm VI/EN: đổi giao diện NGAY. Phiên SSO ⇒ lưu vào tài khoản PMH ID (nền, lỗi thì trang
// vẫn giữ lựa chọn). Chưa đăng nhập ⇒ lựa chọn chờ trong tab (xử lý ở /me sau đăng nhập).
export function setLanguage(lang: Lang): Promise<void> {
  if (!session) {
    setPendingChoice(lang);
  } else {
    pageChoice = lang;
    if (session.idp) save(lang);
  }
  return applyLanguage(lang);
}

// Sau khi tải /me: ngôn ngữ = `locale` (claim tài khoản PMH ID). Lựa chọn chờ từ màn đăng nhập khác
// claim VÀ mới hơn `locale_updated_at` ⇒ áp + lưu PMH ID; cũ hơn ⇒ theo claim. Luôn bỏ lựa chọn chờ.
// `locale` null (SA local / tài khoản thử / dev) ⇒ giữ ngôn ngữ đang dùng (hoặc lựa chọn chờ).
export async function applySignedInLanguage(
  me: { locale?: unknown; localeUpdatedAt?: unknown; csrfToken?: string | null; serverTime?: unknown },
  opts: { serverDate?: string | null } = {},
): Promise<void> {
  // Đo lệch NGAY khi nhận /me (trước mọi await) — gần lúc máy chủ ghi serverTime nhất
  const offsetMs = serverClockOffsetMs(me.serverTime, opts.serverDate);
  const idp = me.locale !== null && me.locale !== undefined;
  session = { csrfToken: me.csrfToken ?? null, idp };
  if (pageChoice) {
    await applyLanguage(pageChoice);
    return;
  }
  const pending = takePendingChoice();
  if (!idp) {
    if (pending) {
      pageChoice = pending.lang;
      await applyLanguage(pending.lang);
    }
    return;
  }
  const claim = normalizeLanguage(me.locale);
  if (
    pending &&
    pending.lang !== claim &&
    pendingIsNewer(pendingAtServerSec(pending.at, offsetMs), me.localeUpdatedAt)
  ) {
    pageChoice = pending.lang;
    save(pending.lang);
    await applyLanguage(pending.lang);
    return;
  }
  await applyLanguage(claim);
}

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      vi: { translation: vi },
      en: { translation: en },
    },
    lng: currentLanguage(),
    fallbackLng: 'vi',
    interpolation: { escapeValue: false },
  })
  .then(() => applyDocumentLanguage(currentLanguage()));

// Bản tiếng Anh gọi tháng bằng tên ("January") thay "month 1": chuỗi en dùng {{month, monthName}} giữa câu,
// {{month, MonthName}} đầu câu. Giá trị không phải số tháng 1–12 thì giữ kiểu cũ "month x" để không mất nghĩa
const MONTH_NAME = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' });
export function monthName(value: unknown, capital = false): string {
  const n = Number(value);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return MONTH_NAME.format(new Date(Date.UTC(2000, n - 1, 1)));
  return `${capital ? 'Month' : 'month'} ${String(value)}`;
}
i18n.services.formatter?.add('monthName', (value) => monthName(value));
i18n.services.formatter?.add('MonthName', (value) => monthName(value, true));

export default i18n;
