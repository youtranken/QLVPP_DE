import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { parseLocalSa } from './local-sa-env';
import type { LocalSaConfig } from './local-sa-env';

const KEYLEN = 64;
const SALT_BYTES = 16;
export const PAIR_MAX = 5;
export const GLOBAL_MAX = 50;
const WINDOW_MS = 15 * 60 * 1000;
const GLOBAL_KEY = '*';
// Trần cứng: bị bơm cặp (ip, username) ồ ạt thì mất vài bộ đếm còn hơn OOM
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

// Lockout in-memory, cửa sổ trượt 15′: cặp (ip, username) chống dò một nơi; toàn cục chống dò rải IP.
// Đúng mật khẩu chỉ xóa bộ đếm cặp — bộ đếm toàn cục giữ nguyên để SA không tự mở khóa cho kẻ dò.
@Injectable()
export class LocalSaService {
  private readonly config: LocalSaConfig | null = parseLocalSa(process.env);
  private readonly failures = new Map<string, number[]>();

  attemptLogin(
    username: string,
    password: string,
    ip: string,
  ): 'ok' | 'bad' | 'locked' {
    if (this.isLocked(ip, username)) {
      return 'locked';
    }
    if (this.verifyCredentials(username, password)) {
      this.failures.delete(pairKey(ip, username));
      return 'ok';
    }
    this.recordFailure(ip, username);
    return this.isLocked(ip, username) ? 'locked' : 'bad';
  }

  isLocked(ip: string, username: string): boolean {
    const now = Date.now();
    return (
      this.recent(pairKey(ip, username), now).length >= PAIR_MAX ||
      this.recent(GLOBAL_KEY, now).length >= GLOBAL_MAX
    );
  }

  recordFailure(ip: string, username: string): void {
    const now = Date.now();
    this.push(pairKey(ip, username), now, PAIR_MAX);
    this.push(GLOBAL_KEY, now, GLOBAL_MAX);
    this.prune(now);
  }

  private recent(key: string, now: number): number[] {
    const stamps = this.failures.get(key);
    if (!stamps) {
      return [];
    }
    const live = stamps.filter((t) => now - t < WINDOW_MS);
    if (live.length === 0) {
      this.failures.delete(key);
    } else if (live.length !== stamps.length) {
      this.failures.set(key, live);
    }
    return live;
  }

  // Chỉ giữ `max` mốc gần nhất: đủ để biết đã chạm ngưỡng trong cửa sổ
  private push(key: string, now: number, max: number): void {
    const live = [...this.recent(key, now), now];
    this.failures.delete(key);
    this.failures.set(key, live.slice(-max));
  }

  private prune(now: number): void {
    if (this.failures.size <= MAX_ENTRIES) {
      return;
    }
    for (const key of this.failures.keys()) {
      if (key !== GLOBAL_KEY) this.recent(key, now);
    }
    // Map giữ thứ tự chèn (push chèn lại cuối) → xóa cặp cũ nhất trước
    for (const key of this.failures.keys()) {
      if (this.failures.size <= MAX_ENTRIES) {
        break;
      }
      if (key !== GLOBAL_KEY) this.failures.delete(key);
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

function pairKey(ip: string, username: string): string {
  return `${ip}|${username}`;
}
