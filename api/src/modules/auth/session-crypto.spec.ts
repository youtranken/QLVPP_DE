import { createHash } from 'node:crypto';
import {
  hashSessionId,
  isSessionCookie,
  newSessionCookie,
  sessionRef,
} from './session-crypto';

describe('session-crypto', () => {
  it('cookie mới: 32 byte ngẫu nhiên base64url (43 ký tự), mỗi lần khác nhau', () => {
    const a = newSessionCookie();
    const b = newSessionCookie();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
    expect(a).not.toBe(b);
    expect(isSessionCookie(a)).toBe(true);
  });

  it('khóa DB = sha256 hex thường (không HMAC) của cookie; mã Nhật ký = 12 hex đầu', () => {
    const c = newSessionCookie();
    const hex = createHash('sha256').update(c).digest('hex');
    expect(hashSessionId(c)).toBe(hex);
    expect(sessionRef(c)).toBe(hex.slice(0, 12));
    expect(sessionRef(c)).toMatch(/^[0-9a-f]{12}$/);
  });

  it('cookie rác, UUID phiên cũ, hay chính hash trong DB đều không đúng dạng cookie', () => {
    const c = newSessionCookie();
    expect(isSessionCookie(hashSessionId(c))).toBe(false);
    expect(isSessionCookie('3f0c7a52-9d1e-4b8a-8c6f-1a2b3c4d5e6f')).toBe(false);
    expect(isSessionCookie('')).toBe(false);
    expect(isSessionCookie(`${c}x`)).toBe(false);
  });
});
