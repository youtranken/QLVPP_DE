import request from 'supertest';
import { SessionCleanupJob } from '../src/modules/auth/session-cleanup.job';
import { hashSessionId, sessionRef } from '../src/modules/auth/session-crypto';
import { SessionService } from '../src/modules/auth/session.service';
import { SessionHarness } from './session-standard.harness';

// Chuẩn phiên chung, luật 5 và mục "Ghi nhật ký khi phiên kết thúc": một auth.session_expired cho mỗi
// phiên, chỉ lời gọi xóa được dòng mới ghi; lý do idle | absolute | revoked | refresh_failed.
describe('chuẩn phiên: kết thúc phiên (12 h, idle SA, job dọn, đăng xuất)', () => {
  const h = new SessionHarness();

  beforeAll(() => h.start());
  afterAll(() => h.stop());

  const expiredRows = (actor: string, cookie: string, expected = 1) =>
    h.auditRows(actor, 'auth.session_expired', sessionRef(cookie), expected);

  it('quá 12 h từ lúc đăng nhập: 401, xóa theo hash, đúng một session_expired absolute', async () => {
    await h.cleanup();
    const cookie = await h.pmhLogin();
    await h.pool.query(
      `UPDATE sessions SET expires_at = now() - interval '1 second' WHERE id_hash = $1`,
      [hashSessionId(cookie)],
    );
    await h.me(cookie).expect(401);
    await h.me(cookie).expect(401);
    expect(await h.sessionRows(h.pmhSub)).toHaveLength(0);
    const rows = await expiredRows(h.pmhSub, cookie);
    expect(rows.map((r) => r.detail)).toEqual([{ reason: 'absolute' }]);
    await h.expectNoSecretAnywhere();
  });

  it('phiên mới hết hạn đúng 12 h sau lúc tạo', async () => {
    const cookie = await h.pmhLogin();
    const { rows } = await h.pool.query<{ ms: string }>(
      `SELECT extract(epoch FROM expires_at - created_at) * 1000 AS ms
         FROM sessions WHERE id_hash = $1`,
      [hashSessionId(cookie)],
    );
    expect(Math.abs(Number(rows[0].ms) - 12 * 3_600_000)).toBeLessThan(1000);
  });

  it('đăng xuất khi phiên đã chạm trần: guard ghi absolute, không có auth.logout', async () => {
    await h.cleanup();
    const cookie = await h.testLogin();
    const csrf = (
      (await h.me(cookie).expect(200)).body as { csrfToken: string }
    ).csrfToken;
    await h.pool.query(
      `UPDATE sessions SET expires_at = now() - interval '1 second' WHERE id_hash = $1`,
      [hashSessionId(cookie)],
    );
    await request(h.server())
      .post('/api/auth/logout')
      .set('Cookie', `vpp_sid=${cookie}`)
      .type('form')
      .send({ csrf })
      .expect(303);
    const ended = await expiredRows(h.testSub, cookie);
    expect(ended.map((r) => r.detail)).toEqual([{ reason: 'absolute' }]);
    const out = await h.auditRows(
      h.testSub,
      'auth.logout',
      sessionRef(cookie),
      0,
    );
    expect(out).toHaveLength(0);
  });

  it('phiên SA idle quá 2 h: xóa theo hash, đúng một session_expired idle', async () => {
    await h.cleanup();
    const cookie = await h.saLogin();
    await h.pool.query(
      `UPDATE sessions SET last_seen_at = now() - interval '3 hours' WHERE id_hash = $1`,
      [hashSessionId(cookie)],
    );
    await h.me(cookie).expect(401);
    expect(await h.sessionRows('local:sa')).toHaveLength(0);
    const rows = await expiredRows('local:sa', cookie);
    expect(rows.map((r) => r.detail)).toEqual([{ reason: 'idle' }]);
    await h.expectNoSecretAnywhere();
  });

  it('job dọn: xóa phiên chạm trần (absolute) và SA bỏ quá 2 h (idle), mỗi phiên một dòng nhật ký; giữ phiên còn hạn', async () => {
    await h.cleanup();
    const sessions = h.app.get(SessionService);
    const capped = await sessions.createLocalSa();
    const idle = await sessions.createLocalSa();
    const fresh = await sessions.createLocalSa();
    h.secrets.push(capped.id, idle.id, fresh.id);
    await h.pool.query(
      `UPDATE sessions SET expires_at = now() - interval '1 second' WHERE id_hash = $1`,
      [hashSessionId(capped.id)],
    );
    await h.pool.query(
      `UPDATE sessions SET last_seen_at = now() - interval '2 hours 1 minute' WHERE id_hash = $1`,
      [hashSessionId(idle.id)],
    );
    await h.app.get(SessionCleanupJob).run();
    const left = (await h.sessionRows('local:sa')).map((r) => r.id_hash);
    expect(left).toEqual([hashSessionId(fresh.id)]);
    expect(
      (await expiredRows('local:sa', capped.id)).map((r) => r.detail),
    ).toEqual([{ reason: 'absolute' }]);
    expect(
      (await expiredRows('local:sa', idle.id)).map((r) => r.detail),
    ).toEqual([{ reason: 'idle' }]);
    expect(await expiredRows('local:sa', fresh.id, 0)).toHaveLength(0);
    expect(h.logs.some((l) => /dọn \d+ phiên quá hạn/.test(l))).toBe(true);
    await h.expectNoSecretAnywhere();
  });
});
