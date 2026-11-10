import { Injectable, Logger } from '@nestjs/common';
import { isIP } from 'node:net';
import { parseLocaleTag } from './locale';
import type { AppLocale } from './locale';

// Đặt ngôn ngữ của tài khoản PMH ID (docs 7a — tài khoản PMH ID là nơi DUY NHẤT giữ ngôn ngữ):
// PUT {origin issuer}/api/me/locale, Bearer = access token CỦA NGƯỜI DÙNG. Gọi server-to-server
// (PMH ID không bật CORS). Không ném — trả kết quả để caller quyết. Sau DI token để test thay bằng giả.
export const IDP_LOCALE_CLIENT = 'IDP_LOCALE_CLIENT';

export type IdpLocaleFailure =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_locale'
  | 'rate_limited'
  | 'unavailable';

export type IdpLocaleResult =
  // `locale` = giá trị PMH ID báo đã lưu (undefined nếu body thiếu/lạ)
  | { ok: true; locale: AppLocale | undefined }
  | { ok: false; reason: IdpLocaleFailure; retryAfterSec?: number };

export interface IdpLocaleOptions {
  // IP người dùng như VPP thấy (req.ip theo trust proxy) — PMH ID ghi "(do ứng dụng báo)"
  userIp?: string;
}

export interface IdpLocaleApi {
  putLocale(
    accessToken: string,
    locale: AppLocale,
    opts?: IdpLocaleOptions,
  ): Promise<IdpLocaleResult>;
}

const FETCH_TIMEOUT_MS = 5_000;

// Gốc API PMH ID = origin của PMH_ISSUER_URL (bỏ path /oidc). Thiếu/hỏng → null
export function pmhIdApiBase(): string | null {
  const raw = process.env.PMH_ISSUER_URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

// Retry-After: số giây hoặc HTTP-date → giây chờ (≥ 0, làm tròn lên); thiếu/hỏng → undefined
export function parseRetryAfterSec(
  header: string | null | undefined,
  now = Date.now(),
): number | undefined {
  const v = header?.trim();
  if (!v) return undefined;
  if (/^\d+(\.\d+)?$/.test(v)) return Math.ceil(Number(v));
  if (!/[a-z]/i.test(v)) return undefined;
  const at = Date.parse(v);
  return Number.isNaN(at)
    ? undefined
    : Math.max(0, Math.ceil((at - now) / 1000));
}

@Injectable()
export class IdpLocaleClient implements IdpLocaleApi {
  private readonly logger = new Logger(IdpLocaleClient.name);

  async putLocale(
    accessToken: string,
    locale: AppLocale,
    opts: IdpLocaleOptions = {},
  ): Promise<IdpLocaleResult> {
    const base = pmhIdApiBase();
    if (!base) return { ok: false, reason: 'unavailable' };
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    // isIP chặn cả chuỗi nhiều IP / ký tự xuống dòng
    if (opts.userIp && isIP(opts.userIp) !== 0) {
      headers['X-PMH-User-IP'] = opts.userIp;
    }
    let res: Response;
    let text: string;
    try {
      res = await fetch(`${base}/api/me/locale`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ locale }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      text = await res.text(); // đọc hết body — không treo kết nối keep-alive
    } catch (error) {
      this.logger.warn(
        `PMH ID /api/me/locale không liên lạc được: ${(error as Error).name}`,
      );
      return { ok: false, reason: 'unavailable' };
    }
    if (res.ok) {
      let saved: unknown;
      try {
        saved = (JSON.parse(text) as { locale?: unknown }).locale;
      } catch {
        saved = undefined;
      }
      return { ok: true, locale: parseLocaleTag(saved) };
    }
    switch (res.status) {
      case 401:
        return { ok: false, reason: 'unauthorized' };
      case 403:
        return { ok: false, reason: 'forbidden' };
      case 400:
        return { ok: false, reason: 'invalid_locale' };
      case 429:
        return {
          ok: false,
          reason: 'rate_limited',
          retryAfterSec: parseRetryAfterSec(res.headers.get('retry-after')),
        };
      default:
        this.logger.warn(`PMH ID /api/me/locale trả HTTP ${res.status}`);
        return { ok: false, reason: 'unavailable' };
    }
  }
}
