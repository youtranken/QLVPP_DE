import type { AppLanguage } from '@/lib/lang-pref';

export interface SaveLocaleResult {
  saved: boolean;
  reason?: string;
}

// Lần bấm phía trình duyệt — api xếp thứ tự theo đây, không theo thứ tự request tới
export interface LocaleClick {
  page: string;
  seq: number;
}

// Lưu ngôn ngữ vào tài khoản PMH ID qua backend VPP (PUT /api/auth/me/locale → PMH ID). Không ném,
// không chặn giao diện: lỗi chỉ console.warn (chuỗi ASCII — log kỹ thuật, không phải câu chữ UI), giao diện giữ lựa chọn. fetch thô (không qua api-client)
// để lỗi ở đây không kích hoạt luồng "phiên hết hạn".
export async function saveLocaleToIdp(
  lang: AppLanguage,
  csrfToken: string | null,
  signal?: AbortSignal,
  click?: LocaleClick,
): Promise<SaveLocaleResult> {
  try {
    const res = await fetch('/api/auth/me/locale', {
      method: 'PUT',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      body: JSON.stringify({ locale: lang, ...click }),
    });
    if (!res.ok) {
      console.warn(`[locale] VPP HTTP ${res.status} saving to PMH ID`);
      return { saved: false, reason: `http_${res.status}` };
    }
    const body = (await res.json()) as SaveLocaleResult;
    // stale/superseded = có lần bấm mới hơn — đúng, không phải lỗi
    if (!body.saved && body.reason !== 'stale' && body.reason !== 'superseded') {
      console.warn(`[locale] not saved to PMH ID: ${body.reason ?? 'unknown'}`);
    }
    return { saved: Boolean(body.saved), reason: body.reason };
  } catch (error) {
    if (signal?.aborted) return { saved: false, reason: 'aborted' };
    console.warn(`[locale] VPP unreachable: ${(error as Error).message}`);
    return { saved: false, reason: 'network' };
  }
}
