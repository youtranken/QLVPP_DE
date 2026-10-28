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
import { UsersService } from '../src/modules/users/users.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const WEBHOOK_SECRET = 'whsec-role-e2e';

// Phiên cookie thật (không dùng x-dev-role) để đi qua toIdentity
describe('role tính mỗi request từ users.groups', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let sessionId: string;
  const sub = `e2e-role-${randomUUID()}`;
  const originalSecret = process.env.PMH_WEBHOOK_SECRET;

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    process.env.PMH_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const directory = {
      fetchUsers: () => Promise.resolve([]),
      fetchGroups: () => Promise.resolve([]),
    };
    app = (await createTestApp(
      [],
      [{ token: DIRECTORY_CLIENT, useValue: directory }],
    )) as INestApplication<App>;
    await app
      .get(UsersService)
      .upsertFromClaims({ sub, full_name: 'Role E2E', groups: ['vpp-admin'] });
    const session = await app.get(SessionService).create({
      userSub: sub,
      refreshToken: null,
      accessTokenExp: new Date(Date.now() + 10 * 60_000),
      claims: { sub, full_name: 'Role E2E', groups: ['vpp-admin'] },
      idToken: null,
    });
    sessionId = session.id;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    if (originalSecret === undefined) delete process.env.PMH_WEBHOOK_SECRET;
    else process.env.PMH_WEBHOOK_SECRET = originalSecret;
  });

  it("groups=['vpp-admin'] → GET auth/me.role = admin, admin/audit 200", async () => {
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

  it('webhook user.groups_changed {groups: []} → request kế: role member, admin/audit 403', async () => {
    const rawBody = JSON.stringify({
      type: 'user.groups_changed',
      user_id: sub,
      groups: [],
      event_id: `evt-${randomUUID()}`,
    });
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', WEBHOOK_SECRET)
      .update(`${ts}.${rawBody}`)
      .digest('hex');
    await request(app.getHttpServer())
      .post('/api/webhooks/pmh-id')
      .set('Content-Type', 'application/json')
      .set('X-PMH-Timestamp', ts)
      .set('X-PMH-Signature-V2', signature)
      .send(rawBody)
      .expect(200);

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `vpp_sid=${sessionId}`)
      .expect(200);
    expect(me.body.role).toBe('member');
    await request(app.getHttpServer())
      .get('/api/admin/audit')
      .set('Cookie', `vpp_sid=${sessionId}`)
      .expect(403);
  });
});
