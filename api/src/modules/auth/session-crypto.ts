import { createHash, randomBytes } from 'node:crypto';

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
