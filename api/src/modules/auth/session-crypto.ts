import { createHash, randomBytes } from 'node:crypto';
import {
  decryptSecret,
  encryptSecret,
  hasEncKey,
} from '../../common/crypto-secret';

// Cookie phiên: 256 bit ngẫu nhiên, base64url (43 ký tự). Chỉ trình duyệt giữ giá trị này.
export function newSessionCookie(): string {
  return randomBytes(32).toString('base64url');
}

const SESSION_COOKIE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

// Lọc cookie rác (kể cả UUID của phiên cũ trước 0125) trước khi chạm DB
export function isSessionCookie(value: string): boolean {
  return SESSION_COOKIE_PATTERN.test(value);
}

// Khóa DB = sha256 hex của cookie: lộ bảng sessions/backup không dùng lại được làm cookie.
// Mọi tra/sửa/xóa phiên đi qua hàm này — không lưu cookie thô ở đâu.
export function hashSessionId(cookie: string): string {
  return createHash('sha256').update(cookie).digest('hex');
}

// Mã phiên trong Nhật ký/log: 12 ký tự đầu của hash — đối chiếu được với sessions.id_hash
export function sessionRef(cookie: string): string {
  return hashSessionId(cookie).slice(0, 12);
}

// Token PMH ID trong bảng sessions (refresh/access/id token): có CONFIG_ENC_KEY → 'v1:' AES-GCM, AAD = id_hash
// của phiên (chép token sang dòng khác thì không giải mã được); không có khóa (chỉ dev — prod từ chối khởi
// động) → 'p:' nguyên văn.
export function sealToken(
  plain: string | null | undefined,
  idHash: string,
): string | null {
  if (!plain) return null;
  return hasEncKey() ? `v1:${encryptSecret(plain, idHash)}` : `p:${plain}`;
}

// null khi không đọc được (đổi/mất khóa, sai dòng, bị sửa, 'p:' ở production) → phiên coi như không có token
export function openToken(
  sealed: string | null,
  idHash: string,
): string | null {
  if (!sealed) return null;
  if (sealed.startsWith('p:')) {
    return process.env.NODE_ENV === 'production' ? null : sealed.slice(2);
  }
  if (!sealed.startsWith('v1:') || !hasEncKey()) return null;
  try {
    return decryptSecret(sealed.slice(3), idHash);
  } catch {
    return null;
  }
}
