import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import * as cryptoSecret from '../src/common/crypto-secret';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { hashSessionId, sessionRef } from '../src/modules/auth/session-crypto';
import { SessionService } from '../src/modules/auth/session.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const SUB = 'local:sa';

// SessionService trên Postgres thật: biên trần 12 h (now < expires_at còn hiệu lực, now ≥ expires_at hết),
// nhật ký chỉ do lời gọi xóa được dòng ghi, token 'p:' bị từ chối ở production, giải mã lười.
describe('SessionService — hết hạn và nhật ký kết thúc phiên (Postgres thật)', () => {
  let app: INestApplication;
  let pool: Pool;
  let sessions: SessionService;
  const savedKey = process.env.CONFIG_ENC_KEY;
  // Mốc cố định ở tương lai gần (ms tròn): không quét nhầm phiên của suite khác
  const T = Math.floor(Date.now() / 1000) * 1000 + 3_600_000;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    process.env.CONFIG_ENC_KEY = 'db-session-expiry-key-0123456789abcdef';
    app = await createTestApp();
    sessions = app.get(SessionService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await pool.query('DELETE FROM sessions WHERE user_sub = $1', [SUB]);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    if (savedKey === undefined) delete process.env.CONFIG_ENC_KEY;
    else process.env.CONFIG_ENC_KEY = savedKey;
  });

  const at = (ms: number) => jest.spyOn(Date, 'now').mockReturnValue(ms);
  const setExpiry = (cookie: string, ms: number) =>
    pool.query('UPDATE sessions SET expires_at = $2 WHERE id_hash = $1', [
      hashSessionId(cookie),
      new Date(ms),
    ]);
  const ended = async (cookie: string, expected: number) => {
    let rows: { detail: unknown }[] = [];
    for (let i = 0; i < 40; i += 1) {
      rows = (
        await pool.query<{ detail: unknown }>(
          `SELECT detail FROM audit_log WHERE action = 'auth.session_expired' AND object_id = $1`,
          [sessionRef(cookie)],
        )
      ).rows;
      if (rows.length >= expected) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    return rows.map((r) => r.detail);
  };

  it('find: T − 1 ms còn hiệu lực; đúng T và T + 1 ms đã hết (so sánh expires_at > now)', async () => {
    const s = await sessions.createLocalSa();
    await setExpiry(s.id, T);
    at(T - 1);
    expect(await sessions.find(s.id)).not.toBeNull();
    at(T);
    expect(await sessions.find(s.id)).toBeNull();
    at(T + 1);
    expect(await sessions.find(s.id)).toBeNull();
  });

  it('expireIfPastMaxAge: T − 1 ms không xóa; đúng T xóa và ghi absolute một lần, gọi lại không ghi thêm', async () => {
    const s = await sessions.createLocalSa();
    await setExpiry(s.id, T);
    at(T - 1);
    expect(await sessions.expireIfPastMaxAge(s.id)).toBe(false);
    at(T);
    expect(await sessions.expireIfPastMaxAge(s.id)).toBe(true);
    expect(await sessions.expireIfPastMaxAge(s.id)).toBe(false);
    expect(await ended(s.id, 1)).toEqual([{ reason: 'absolute' }]);
    await new Promise((r) => setTimeout(r, 100));
    expect(await ended(s.id, 1)).toHaveLength(1);
  });

  it('purgeExpired ở mốc T: expires_at = T xóa (absolute), T + 1 ms giữ; SA last_seen T − 2 h − 1 ms xóa (idle), đúng T − 2 h giữ', async () => {
    const [cap, keep, idle, edge] = await Promise.all(
      [1, 2, 3, 4].map(() => sessions.createLocalSa()),
    );
    await setExpiry(cap.id, T);
    for (const s of [keep, idle, edge]) await setExpiry(s.id, T + 1);
    const lastSeen = (cookie: string, ms: number) =>
      pool.query('UPDATE sessions SET last_seen_at = $2 WHERE id_hash = $1', [
        hashSessionId(cookie),
        new Date(ms),
      ]);
    await lastSeen(idle.id, T - 2 * 3_600_000 - 1);
    await lastSeen(edge.id, T - 2 * 3_600_000);
    await lastSeen(cap.id, T);
    await lastSeen(keep.id, T);
    at(T);
    expect(await sessions.purgeExpired()).toBe(2);
    const left = (
      await pool.query<{ id_hash: string }>(
        'SELECT id_hash FROM sessions WHERE user_sub = $1',
        [SUB],
      )
    ).rows.map((r) => r.id_hash);
    expect(left.sort()).toEqual(
      [hashSessionId(keep.id), hashSessionId(edge.id)].sort(),
    );
    expect(await ended(cap.id, 1)).toEqual([{ reason: 'absolute' }]);
    expect(await ended(idle.id, 1)).toEqual([{ reason: 'idle' }]);
  });

  it('expire: lời gọi thứ hai không xóa được gì → false, không ghi nhật ký thêm; lý do và cause lưu đúng', async () => {
    const s = await sessions.createLocalSa();
    expect(await sessions.expire(s.id, 'revoked', 'user_inactive')).toBe(true);
    expect(await sessions.expire(s.id, 'revoked', 'user_inactive')).toBe(false);
    await new Promise((r) => setTimeout(r, 100));
    expect(await ended(s.id, 1)).toEqual([
      { reason: 'revoked', cause: 'user_inactive' },
    ]);
  });

  it('destroy trả số dòng đã xóa và không ghi session_expired', async () => {
    const s = await sessions.createLocalSa();
    expect(await sessions.destroy(s.id)).toBe(1);
    expect(await sessions.destroy(s.id)).toBe(0);
    await new Promise((r) => setTimeout(r, 100));
    expect(await ended(s.id, 0)).toEqual([]);
  });

  it('destroyAllForUser: một session_expired mỗi phiên; webhook → revoked, back-channel → không lý do', async () => {
    const a = await sessions.createLocalSa();
    const b = await sessions.createLocalSa();
    expect(await sessions.destroyAllForUser(SUB, 'revoked')).toBe(2);
    expect(await ended(a.id, 1)).toEqual([{ reason: 'revoked' }]);
    expect(await ended(b.id, 1)).toEqual([{ reason: 'revoked' }]);
    const c = await sessions.createLocalSa();
    expect(await sessions.destroyAllForUser(SUB)).toBe(1);
    expect(await ended(c.id, 1)).toEqual([null]);
  });

  it('production: dòng có token p: (nguyên văn) → find coi phiên không hợp lệ', async () => {
    const savedEnv = process.env.NODE_ENV;
    const s = await sessions.createLocalSa();
    await pool.query(
      `UPDATE sessions SET refresh_token = 'p:rt-tho' WHERE id_hash = $1`,
      [hashSessionId(s.id)],
    );
    try {
      process.env.NODE_ENV = 'production';
      expect(await sessions.find(s.id)).toBeNull();
    } finally {
      process.env.NODE_ENV = savedEnv;
    }
    expect((await sessions.find(s.id))?.refreshToken).toBe('rt-tho');
  });

  it('find không giải mã token cho tới khi có người đọc', async () => {
    const created = await sessions.create({
      userSub: SUB,
      refreshToken: 'rt-lazy',
      accessToken: 'at-lazy',
      accessTokenExp: null,
      claims: { sub: SUB },
      idToken: 'idt-lazy',
    });
    const decrypt = jest.spyOn(cryptoSecret, 'decryptSecret');
    const found = await sessions.find(created.id);
    expect(found?.csrfToken).toBe(created.csrfToken);
    expect(decrypt).not.toHaveBeenCalled();
    expect(found?.idToken).toBe('idt-lazy');
    expect(found?.idToken).toBe('idt-lazy');
    expect(decrypt).toHaveBeenCalledTimes(1);
  });
});
