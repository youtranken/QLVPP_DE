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
const SECRET = 'whsec-role-e2e';
const CLIENT_ID = 'client_vpp_role_e2e';
const ENV_KEYS = ['PMH_WEBHOOK_SECRET', 'PMH_CLIENT_ID'] as const;

// Phiên cookie thật (không dùng x-dev-role) để đi qua toIdentity
describe('role tính mỗi request từ users.role', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let sessionId: string;
  const sub = `e2e-role-${randomUUID()}`;
  const savedEnv = ENV_KEYS.map((k) => [k, process.env[k]] as const);
  let seq = BigInt(Date.now()) * 1000n;
  const eventIds: string[] = [];

  const roleChanged = (appRole: string, change: 'added' | 'removed') => {
    seq += 1n;
    eventIds.push(seq.toString());
    const body = JSON.stringify({
      type: 'user.role_changed',
      user_id: sub,
      event_id: seq.toString(),
      app_role: appRole,
      detail: { client_id: CLIENT_ID, change },
      at: new Date().toISOString(),
    });
    const ts = String(Math.floor(Date.now() / 1000));
    return request(app.getHttpServer())
      .post('/api/webhooks/pmh-id')
      .set('Content-Type', 'application/json')
      .set('X-PMH-Timestamp', ts)
      .set(
        'X-PMH-Signature-V2',
        createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex'),
      )
      .send(body);
  };
  const asSession = (path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Cookie', `vpp_sid=${sessionId}`);

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
    await app.get(UsersService).upsertFromClaims({
      sub,
      full_name: 'Role E2E',
      app_role: 'admin',
      ver: 3,
    });
    const session = await app.get(SessionService).create({
      userSub: sub,
      refreshToken: null,
      accessTokenExp: new Date(Date.now() + 10 * 60_000),
      claims: { sub, full_name: 'Role E2E', app_role: 'admin', ver: 3 },
      idToken: null,
    });
    sessionId = session.id;
  });

  afterAll(async () => {
    await app.close();
    await pool.query('DELETE FROM sessions WHERE user_sub = $1', [sub]);
    await pool.query('DELETE FROM webhook_user_order WHERE sub = $1', [sub]);
    await pool.query('DELETE FROM users WHERE sub = $1', [sub]);
    await pool.query(
      'DELETE FROM processed_webhook_events WHERE event_id = ANY($1)',
      [eventIds],
    );
    await pool.end();
    for (const [k, v] of savedEnv) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("users.role='admin' (app_role admin lúc đăng nhập) → GET auth/me.role = admin, admin/audit 200", async () => {
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `vpp_sid=${sessionId}`)
      .expect(200);
    expect(me.body.role).toBe('admin');
    await request(app.getHttpServer())
      .get('/api/admin/audit')
      .set('Cookie', `vpp_sid=${sessionId}`)
      .expect(200);
  });

  it('webhook role_changed admin→member → request kế của CÙNG phiên 403 ở admin/audit, auth/me.role member; member→admin → 200 lại', async () => {
    await roleChanged('member', 'removed').expect(200);
    const me = await asSession('/api/auth/me').expect(200);
    expect(me.body.role).toBe('member');
    await asSession('/api/admin/audit').expect(403);

    await roleChanged('admin', 'added').expect(200);
    const back = await asSession('/api/auth/me').expect(200);
    expect(back.body.role).toBe('admin');
    await asSession('/api/admin/audit').expect(200);
    const audits = await pool.query<{ detail: { source: string } }>(
      `SELECT detail FROM audit_log WHERE action = 'users.role_changed' AND object_id = $1`,
      [sub],
    );
    expect(
      audits.rows.filter((r) => r.detail.source === 'webhook'),
    ).toHaveLength(2);
  });
});
