import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { parseLocalSa } from './local-sa-env';
import type { LocalSaConfig } from './local-sa-env';
import { AuditWriterService } from '../audit/audit-writer.service';
import { LoginLockout } from './login-lockout';

export { GLOBAL_MAX, IP_MAX, PAIR_MAX } from './login-lockout';

const KEYLEN = 64;
const SALT_BYTES = 16;

export function hashPassword(pw: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(pw, salt, KEYLEN);
  return `scrypt.${salt.toString('hex')}.${hash.toString('hex')}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const parts = stored.split('.');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const expected = Buffer.from(parts[2], 'hex');
  if (expected.length === 0) {
    return false;
  }
  const actual = scryptSync(pw, Buffer.from(parts[1], 'hex'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

@Injectable()
export class LocalSaService {
  private readonly logger = new Logger(LocalSaService.name);
  private readonly config: LocalSaConfig | null = parseLocalSa(process.env);
  private readonly lockout = new LoginLockout(() => this.globalLocked());

  constructor(@Optional() private readonly audit?: AuditWriterService) {}

  // Dò rải IP chạm trần toàn cục: mọi đăng nhập SA bị chặn tới khi cửa sổ 15′ trôi qua — báo để IT biết
  private globalLocked(): void {
    this.logger.warn(
      'Đăng nhập SA tạm khóa toàn cục: quá nhiều lần sai (dò tên/mật khẩu rải IP)',
    );
    void this.audit?.append({
      actor: 'system',
      action: 'auth.sa_lockout_global',
      detail: { window_min: 15 },
    });
  }

  attemptLogin(
    username: string,
    password: string,
    ip: string,
  ): 'ok' | 'bad' | 'locked' {
    return this.lockout.attempt(ip, username, () =>
      this.verifyCredentials(username, password),
    );
  }

  // Ô đăng nhập gõ chữ không phải email: gõ sai tính vào cùng ngân sách lockout với sa-login (theo IP + toàn cục)
  identify(name: string, ip: string): 'password' | 'invalid' | 'locked' {
    if (this.lockout.isLocked(ip, name)) return 'locked';
    if (this.isSaUsername(name)) return 'password';
    this.lockout.recordFailure(ip, name);
    return 'invalid';
  }

  // So băm cùng độ dài bằng timingSafeEqual: thời gian không phụ thuộc gõ đúng bao nhiêu ký tự đầu
  isSaUsername(name: string): boolean {
    const digest = (v: string) => createHash('sha256').update(v).digest();
    const expected = digest(this.config?.username ?? '');
    return timingSafeEqual(digest(name), expected) && this.config !== null;
  }

  isLocked(ip: string, username: string): boolean {
    return this.lockout.isLocked(ip, username);
  }

  recordFailure(ip: string, username: string): void {
    this.lockout.recordFailure(ip, username);
  }

  private verifyCredentials(username: string, password: string): boolean {
    if (!this.config) {
      return false;
    }
    const userMatch = username === this.config.username;
    // Luôn chạy scrypt kể cả sai username — không lộ username qua thời gian phản hồi
    const passMatch = verifyPassword(password, this.config.passwordHash);
    return userMatch && passMatch;
  }
}
