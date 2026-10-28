import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { parseLocalSa } from './local-sa-env';
import type { LocalSaConfig } from './local-sa-env';

const KEYLEN = 64;
const SALT_BYTES = 16;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const IDLE_TTL_MS = LOCK_MS;
// Trần cứng: bị bơm IP thật ồ ạt thì mất vài bộ đếm còn hơn OOM
const MAX_ENTRIES = 10_000;

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

type Attempt = { fails: number; lockUntil: number; touchedAt: number };

// Lockout in-memory: đủ cho một instance api
@Injectable()
export class LocalSaService {
  private readonly config: LocalSaConfig | null = parseLocalSa(process.env);
  private readonly attempts = new Map<string, Attempt>();

  attemptLogin(
    username: string,
    password: string,
    ip: string,
  ): 'ok' | 'bad' | 'locked' {
    const now = Date.now();
    this.prune(now);
    const prev = this.attempts.get(ip);
    if (prev && prev.lockUntil > now) {
      return 'locked';
    }

    if (this.verifyCredentials(username, password)) {
      this.attempts.delete(ip);
      return 'ok';
    }

    const fails = (prev && prev.lockUntil === 0 ? prev.fails : 0) + 1;
    if (fails >= MAX_FAILS) {
      this.attempts.set(ip, {
        fails: 0,
        lockUntil: now + LOCK_MS,
        touchedAt: now,
      });
      return 'locked';
    }
    this.attempts.set(ip, { fails, lockUntil: 0, touchedAt: now });
    return 'bad';
  }

  private prune(now: number): void {
    for (const [ip, a] of this.attempts) {
      if (a.lockUntil <= now && now - a.touchedAt > IDLE_TTL_MS) {
        this.attempts.delete(ip);
      }
    }
    if (this.attempts.size <= MAX_ENTRIES) {
      return;
    }
    for (const [ip, a] of this.attempts) {
      if (this.attempts.size <= MAX_ENTRIES) {
        break;
      }
      if (a.lockUntil <= now) {
        this.attempts.delete(ip);
      }
    }
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
