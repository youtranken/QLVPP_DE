import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { parseLocalSa } from './local-sa-env';
import type { LocalSaConfig } from './local-sa-env';
import { LoginLockout } from './login-lockout';

export { GLOBAL_MAX, PAIR_MAX } from './login-lockout';

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
  private readonly config: LocalSaConfig | null = parseLocalSa(process.env);
  private readonly lockout = new LoginLockout();

  attemptLogin(
    username: string,
    password: string,
    ip: string,
  ): 'ok' | 'bad' | 'locked' {
    return this.lockout.attempt(ip, username, () =>
      this.verifyCredentials(username, password),
    );
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
