import { createHash } from 'node:crypto';
import {
  hashSessionId,
  isSessionCookie,
  newSessionCookie,
  openToken,
  sealToken,
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

  describe('sealToken/openToken — token PMH ID trong bảng sessions', () => {
    const saved = process.env.CONFIG_ENC_KEY;
    afterEach(() => {
      if (saved === undefined) delete process.env.CONFIG_ENC_KEY;
      else process.env.CONFIG_ENC_KEY = saved;
    });

    it('có CONFIG_ENC_KEY → v1: AES-GCM, không chứa token thô, mở lại đúng; mỗi lần niêm khác nhau', () => {
      process.env.CONFIG_ENC_KEY = 'a'.repeat(44);
      const sealed = sealToken('rt-bi-mat-123');
      expect(sealed).toMatch(/^v1:/);
      expect(sealed).not.toContain('rt-bi-mat-123');
      expect(openToken(sealed)).toBe('rt-bi-mat-123');
      expect(sealToken('rt-bi-mat-123')).not.toBe(sealed);
    });

    it('không có khóa → p: nguyên văn (chỉ dev), mở được', () => {
      delete process.env.CONFIG_ENC_KEY;
      expect(sealToken('at-1')).toBe('p:at-1');
      expect(openToken('p:at-1')).toBe('at-1');
    });

    it('null/rỗng → null; đổi khóa, mất khóa, bị sửa, tiền tố lạ → null (không ném)', () => {
      expect(sealToken(null)).toBeNull();
      expect(sealToken('')).toBeNull();
      expect(openToken(null)).toBeNull();
      process.env.CONFIG_ENC_KEY = 'a'.repeat(44);
      const sealed = sealToken('id-token-x')!;
      process.env.CONFIG_ENC_KEY = 'b'.repeat(44);
      expect(openToken(sealed)).toBeNull();
      delete process.env.CONFIG_ENC_KEY;
      expect(openToken(sealed)).toBeNull();
      process.env.CONFIG_ENC_KEY = 'a'.repeat(44);
      expect(openToken(`${sealed.slice(0, -2)}AA`)).toBeNull();
      expect(openToken('id-token-x')).toBeNull();
    });
  });
});
