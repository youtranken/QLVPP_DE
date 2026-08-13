import type { CookieOptions } from 'express';
import { jwtVerify, SignJWT } from 'jose';
import type { AppConfig } from '../infra/config/env';

/** Cookie phiên BFF — giá trị chính là `app_sessions.id`. */
export const SESSION_COOKIE = 'vpp_sid';

/** Cookie tạm giữ state/nonce/PKCE giữa /auth/login và /auth/callback. */
export const TRANSACTION_COOKIE = 'vpp_oidc_tx';

/** Cửa sổ cho phép hoàn tất một lượt đăng nhập. */
const TRANSACTION_TTL_SECONDS = 10 * 60;

/**
 * `secure` chỉ bật ở production: dev chạy http://localhost nên cookie secure sẽ bị trình duyệt bỏ.
 * `sameSite=lax` để cookie vẫn được gửi khi IdP redirect GET về /auth/callback.
 */
export function sessionCookieOptions(config: AppConfig, maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function transactionCookieOptions(config: AppConfig): CookieOptions {
  return sessionCookieOptions(config, TRANSACTION_TTL_SECONDS * 1000);
}

function secretKey(config: AppConfig): Uint8Array {
  return new TextEncoder().encode(config.SESSION_SECRET);
}

/** Ký payload của lượt đăng nhập thành JWT (HS256) để cookie không thể bị sửa. */
export async function signTransaction(
  config: AppConfig,
  payload: Record<string, string>,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TRANSACTION_TTL_SECONDS}s`)
    .sign(secretKey(config));
}

/** Đọc lại lượt đăng nhập; trả null nếu chữ ký sai hoặc đã hết hạn. */
export async function readTransaction(
  config: AppConfig,
  token: string | undefined,
): Promise<Record<string, string> | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(config));
    return payload as Record<string, string>;
  } catch {
    return null;
  }
}
