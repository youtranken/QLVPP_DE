import { INestApplication } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { SessionService } from '../src/modules/auth/session.service';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import { directoryStub } from './directory.stub';
import { UsersService } from '../src/modules/users/users.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const SECRET = 'whsec-webhook-e2e';
const CLIENT_ID = 'client_vpp_webhook_e2e';
// event_id là seq số tăng dần; processed_webhook_events dùng chung DB test nên lấy gốc theo giờ
let seqBase = BigInt(Date.now()) * 1000n;
const nextSeq = () => (seqBase += 10n).toString();

describe('webhook PMH ID qua app thật: lệch giờ, chữ ký v1, event_id lặp', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  const sub = `e2e-wh-${randomUUID()}`;
  const events: string[] = [];
  const originalSecret = process.env.PMH_WEBHOOK_SECRET;
  const originalClient = process.env.PMH_CLIENT_ID;

  const nowSec = () => Math.floor(Date.now() / 1000);
  const sign = (ts: string, body: string) =>
    createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex');
  const event = (
    type = 'user.groups_changed',
    eventId = nextSeq(),
    extra: Record<string, unknown> = {},
  ) => {
    events.push(eventId);
    return JSON.stringify({
      type,
      user_id: sub,
      event_id: eventId,
      ...extra,
    });
  };
  const post = (body: string, headers: Record<string, string>) => {
    const req = request(app.getHttpServer())
      .post('/api/webhooks/pmh-id')
      .set('Content-Type', 'application/json');
    for (const [k, v] of Object.entries(headers)) req.set(k, v);
    return req.send(body);
  };
  const signedAt = (ts: number, body: string) =>
    post(body, {
      'X-PMH-Timestamp': String(ts),
      'X-PMH-Signature-V2': sign(String(ts), body),
    });
  const newSession = async () =>
    (
      await app.get(SessionService).create({
        userSub: sub,
        refreshToken: null,
        accessTokenExp: new Date(Date.now() + 10 * 60_000),
        claims: { sub, full_name: 'Webhook E2E' },
        idToken: null,
      })
    ).id;
  const sessionCount = async () =>
    (await pool.query('SELECT 1 FROM sessions WHERE user_sub = $1', [sub])).rows
      .length;

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    process.env.PMH_WEBHOOK_SECRET = SECRET;
    process.env.PMH_CLIENT_ID = CLIENT_ID;
    const directory = directoryStub();
    app = (await createTestApp(
      [],
      [{ token: DIRECTORY_CLIENT, useValue: directory }],
    )) as INestApplication<App>;
    await app
      .get(UsersService)
      .upsertFromClaims({ sub, full_name: 'Webhook E2E' });
  });

  afterAll(async () => {
    await app.close();
    await pool.query('DELETE FROM sessions WHERE user_sub LIKE $1', [
      `${sub}%`,
    ]);
    await pool.query('DELETE FROM webhook_user_order WHERE sub LIKE $1', [
      `${sub}%`,
    ]);
    await pool.query('DELETE FROM users WHERE sub LIKE $1', [`${sub}%`]);
    await pool.query(
      'DELETE FROM processed_webhook_events WHERE event_id = ANY($1)',
      [events],
    );
    await pool.end();
    if (originalSecret === undefined) delete process.env.PMH_WEBHOOK_SECRET;
    else process.env.PMH_WEBHOOK_SECRET = originalSecret;
    if (originalClient === undefined) delete process.env.PMH_CLIENT_ID;
    else process.env.PMH_CLIENT_ID = originalClient;
  });

  // Lề 1 s mỗi phía: đồng hồ server có thể qua giây giữa lúc ký và lúc kiểm (biên chính xác 300/301 ở unit)
  it('ts lệch 299 s (quá khứ lẫn tương lai) → 200; lệch 301 s → 401 WEBHOOK_SIGNATURE_INVALID', async () => {
    await signedAt(nowSec() - 299, event()).expect(200);
    await signedAt(nowSec() + 299, event()).expect(200);
    for (const ts of [nowSec() - 301, nowSec() + 301]) {
      const res = await signedAt(ts, event()).expect(401);
      expect(res.body).toMatchObject({ code: 'WEBHOOK_SIGNATURE_INVALID' });
    }
  });

  it('chỉ có X-PMH-Signature (v1), không có v2 → 401; audit auth.webhook_rejected lý do missing', async () => {
    const body = event();
    const ts = String(nowSec());
    const before = new Date();
    const res = await post(body, {
      'X-PMH-Timestamp': ts,
      'X-PMH-Signature': sign(ts, body),
    }).expect(401);
    expect(res.body).toMatchObject({ code: 'WEBHOOK_SIGNATURE_INVALID' });
    const audit = await pool.query<{ detail: { reason: string } }>(
      `SELECT detail FROM audit_log WHERE action = 'auth.webhook_rejected' AND created_at >= $1`,
      [before],
    );
    expect(audit.rows.map((r) => r.detail.reason)).toContain('missing');
  });

  it('cùng event_id user.locked gửi 2 lần → lần 1 hủy phiên; lần 2 duplicate, phiên mới còn nguyên', async () => {
    const body = event('user.locked');
    await newSession();
    const first = await signedAt(nowSec(), body).expect(200);
    expect(first.body).toEqual({ ok: true });
    expect(await sessionCount()).toBe(0);
    await newSession();
    const second = await signedAt(nowSec(), body).expect(200);
    expect(second.body).toEqual({ ok: true, duplicate: true });
    expect(await sessionCount()).toBe(1);
  });

  describe('v3: payload, access_revoked/granted, thứ tự seq', () => {
    let n = 0;
    // Mỗi ca một user riêng để trạng thái không dính nhau
    const freshUser = async () => {
      const u = `${sub}-v3-${(n += 1)}`;
      await app
        .get(UsersService)
        .upsertFromClaims({ sub: u, full_name: u, app_role: 'member', ver: 3 });
      const session = await app.get(SessionService).create({
        userSub: u,
        refreshToken: null,
        accessTokenExp: new Date(Date.now() + 10 * 60_000),
        claims: { sub: u, full_name: u, app_role: 'member', ver: 3 },
        idToken: null,
      });
      return { u, cookie: `vpp_sid=${session.id}` };
    };
    const send = (
      u: string,
      type: string,
      seq: string,
      extra: Record<string, unknown> = {},
    ) => {
      events.push(seq);
      const body = JSON.stringify({
        type,
        user_id: u,
        event_id: seq,
        department: 'Phòng D&E',
        team: null,
        app_role: 'member',
        detail: { client_id: CLIENT_ID },
        at: new Date().toISOString(),
        ...extra,
      });
      return signedAt(nowSec(), body);
    };
    const status = async (u: string) =>
      (
        await pool.query<{ status: string }>(
          'SELECT status FROM users WHERE sub = $1',
          [u],
        )
      ).rows[0].status;
    const me = (cookie: string) =>
      request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie);

    it('thiếu event_id → 400 WEBHOOK_PAYLOAD_INVALID; event_id "abc" → 400', async () => {
      for (const body of [
        JSON.stringify({ type: 'user.locked', user_id: sub }),
        JSON.stringify({ type: 'user.locked', user_id: sub, event_id: 'abc' }),
      ]) {
        const res = await signedAt(nowSec(), body).expect(400);
        expect(res.body).toMatchObject({ code: 'WEBHOOK_PAYLOAD_INVALID' });
      }
    });

    it('access_revoked → phiên bị hủy, users.status no_access, request kế 401', async () => {
      const { u, cookie } = await freshUser();
      await me(cookie).expect(200);
      await send(u, 'user.access_revoked', nextSeq()).expect(200);
      expect(await status(u)).toBe('no_access');
      const sessions = await pool.query(
        'SELECT 1 FROM sessions WHERE user_sub = $1',
        [u],
      );
      expect(sessions.rows).toHaveLength(0);
      await me(cookie).expect(401);
    });

    it('access_revoked của client khác → không đổi gì', async () => {
      const { u, cookie } = await freshUser();
      await send(u, 'user.access_revoked', nextSeq(), {
        detail: { client_id: 'client_qlts' },
      }).expect(200);
      expect(await status(u)).toBe('active');
      await me(cookie).expect(200);
    });

    it('access_granted sau access_revoked (seq lớn hơn) → active; access_granted seq nhỏ hơn tới trễ → vẫn no_access', async () => {
      const a = await freshUser();
      const revokeA = nextSeq();
      const grantA = nextSeq();
      await send(a.u, 'user.access_revoked', revokeA).expect(200);
      expect(await status(a.u)).toBe('no_access');
      await send(a.u, 'user.access_granted', grantA).expect(200);
      expect(await status(a.u)).toBe('active');

      const b = await freshUser();
      const grantB = nextSeq();
      const revokeB = nextSeq();
      await send(b.u, 'user.access_revoked', revokeB).expect(200);
      await send(b.u, 'user.access_granted', grantB).expect(200);
      expect(await status(b.u)).toBe('no_access');
    });

    it('unlocked khi Directory không trả lời được → giữ nguyên trạng thái', async () => {
      const { u } = await freshUser();
      await send(u, 'user.locked', nextSeq()).expect(200);
      await send(u, 'user.unlocked', nextSeq()).expect(200);
      expect(await status(u)).toBe('locked');
    });
  });
});
