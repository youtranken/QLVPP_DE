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

describe('webhook PMH ID qua app thật: lệch giờ, chữ ký v1, event_id lặp', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  const sub = `e2e-wh-${randomUUID()}`;
  const events: string[] = [];
  const originalSecret = process.env.PMH_WEBHOOK_SECRET;

  const nowSec = () => Math.floor(Date.now() / 1000);
  const sign = (ts: string, body: string) =>
    createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex');
  const event = (type = 'user.groups_changed', eventId = randomUUID()) => {
    events.push(eventId);
    return JSON.stringify({
      type,
      user_id: sub,
      event_id: eventId,
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
    await pool.query('DELETE FROM sessions WHERE user_sub = $1', [sub]);
    await pool.query('DELETE FROM users WHERE sub = $1', [sub]);
    await pool.query(
      'DELETE FROM processed_webhook_events WHERE event_id = ANY($1)',
      [events],
    );
    await pool.end();
    if (originalSecret === undefined) delete process.env.PMH_WEBHOOK_SECRET;
    else process.env.PMH_WEBHOOK_SECRET = originalSecret;
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
});
