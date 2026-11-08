import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as jose from 'jose';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { JwtVerifierService } from '../src/modules/auth/jwt-verifier.service';
import { OIDC_PROVIDER } from '../src/modules/auth/oidc-provider';
import { SessionService } from '../src/modules/auth/session.service';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import { directoryStub } from './directory.stub';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const ISSUER = 'https://id.e2e-v3.test/oidc';
const CLIENT_ID = 'client_vpp_e2e';
const SAVED_ENV = ['PMH_ISSUER_URL', 'PMH_CLIENT_ID'].map(
  (k) => [k, process.env[k]] as const,
);

// Callback thật với provider giả: exchangeCode trả access token ký bằng key local
describe('callback PMH ID v3: vai từ app_role, đua thu hồi, ver sai, phiên user không active', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let privateKey: jose.CryptoKey;
  let nextToken = '';
  const SUFFIX = randomUUID().slice(0, 8);
  const sub = (n: string) => `e2e-cb3-${n}-${SUFFIX}`;

  const provider = {
    buildAuthUrl: () => Promise.resolve('https://id.e2e-v3.test/auth'),
    exchangeCode: () =>
      Promise.resolve({
        accessToken: nextToken,
        refreshToken: 'rt-e2e',
        idToken: null,
      }),
    refresh: () => Promise.reject(new Error('không dùng')),
    buildLogoutUrl: () => Promise.resolve(null),
    clientCredentialsToken: () => Promise.resolve('m2m'),
  };

  const q = <T extends object>(text: string, values: unknown[] = []) =>
    pool.query<T>(text, values);
  const dbNowSec = async () =>
    Number(
      (await q<{ s: string }>('SELECT floor(extract(epoch FROM now())) AS s'))
        .rows[0].s,
    );
  const sign = (s: string, claims: Record<string, unknown>, iatSec: number) =>
    new jose.SignJWT({ email: `${s}@pmh.test`, full_name: s, ...claims })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(s)
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt(iatSec)
      .setExpirationTime(iatSec + 300)
      .sign(privateKey);
  const login = async (
    s: string,
    claims: Record<string, unknown>,
    iatSec?: number,
  ) => {
    nextToken = await sign(
      s,
      { ver: 3, ...claims },
      iatSec ?? (await dbNowSec()),
    );
    const tx = JSON.stringify({ codeVerifier: 'v', state: 'st' });
    return request(app.getHttpServer())
      .get('/api/auth/callback?code=c&state=st')
      .set('Cookie', `vpp_oidc_tx=${encodeURIComponent(tx)}`)
      .expect(302);
  };
  const sessionCookie = (res: request.Response) =>
    ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('vpp_sid='))
      ?.split(';')[0];
  const user = async (s: string) =>
    (
      await q<{
        role: string;
        status: string;
        team: string | null;
        department: string | null;
        inactive_at: Date | null;
      }>(
        'SELECT role, status, team, department, inactive_at FROM users WHERE sub = $1',
        [s],
      )
    ).rows[0];
  const sessions = async (s: string) =>
    (await q('SELECT 1 FROM sessions WHERE user_sub = $1', [s])).rows.length;
  const audits = async (action: string, actor: string) =>
    (
      await q<{ detail: Record<string, unknown> }>(
        'SELECT detail FROM audit_log WHERE action = $1 AND actor = $2 ORDER BY created_at',
        [action, actor],
      )
    ).rows.map((r) => r.detail);
  // Người đang no_access, bị thu hồi lúc iat − offset giây
  const revokedAt = async (s: string, iat: number, offset: number) => {
    await q(
      `INSERT INTO users (sub, full_name, status, inactive_at)
       VALUES ($1, $1, 'no_access', to_timestamp($2::bigint - $3::int))`,
      [s, iat, offset],
    );
  };

  beforeAll(async () => {
    process.env.PMH_ISSUER_URL = ISSUER;
    process.env.PMH_CLIENT_ID = CLIENT_ID;
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    app = (await createTestApp(
      [],
      [
        { token: OIDC_PROVIDER, useValue: provider },
        {
          token: DIRECTORY_CLIENT,
          useValue: directoryStub(),
        },
      ],
    )) as INestApplication<App>;
    const pair = await jose.generateKeyPair('RS256');
    privateKey = pair.privateKey;
    app.get(JwtVerifierService).setKeySource(
      jose.createLocalJWKSet({
        keys: [await jose.exportJWK(pair.publicKey)],
      }),
    );
  });

  afterAll(async () => {
    await app.close();
    const mine = `e2e-cb3-%-${SUFFIX}`;
    await q('DELETE FROM sessions WHERE user_sub LIKE $1', [mine]);
    await q('DELETE FROM webhook_user_order WHERE sub LIKE $1', [mine]);
    await q('DELETE FROM users WHERE sub LIKE $1', [mine]);
    await pool.end();
    for (const [k, v] of SAVED_ENV) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('token v3 member team null → 302 "/", users: role member, team NULL, department lưu đúng, status active', async () => {
    const s = sub('member');
    const res = await login(s, {
      department: 'Phòng D&E',
      team: null,
      app_role: 'member',
    });
    expect(res.headers.location).toBe('/');
    expect(await user(s)).toMatchObject({
      role: 'member',
      status: 'active',
      team: null,
      department: 'Phòng D&E',
    });
    expect(await sessions(s)).toBe(1);
  });

  it('department "" (Chưa xếp nhóm) → department NULL', async () => {
    const s = sub('nodept');
    await login(s, { department: '', team: null, app_role: 'member' });
    expect((await user(s)).department).toBeNull();
  });

  it('token v3 app_role admin (padmin, team "Admin") → users.role admin; auth/me.role admin', async () => {
    const s = sub('padmin');
    const res = await login(s, {
      department: 'Phòng D&E',
      team: 'Admin',
      app_role: 'admin',
    });
    expect(await user(s)).toMatchObject({ role: 'admin', team: 'Admin' });
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', sessionCookie(res)!)
      .expect(200);
    expect(me.body.role).toBe('admin');
  });

  it('đăng nhập lại với app_role khác → users.role đổi, audit users.role_changed {from, to, source: login}; cùng vai thì không audit thêm', async () => {
    const s = sub('flip');
    await login(s, { app_role: 'admin' });
    await login(s, { app_role: 'member' });
    expect((await user(s)).role).toBe('member');
    await login(s, { app_role: 'member' });
    expect(
      await audits('users.role_changed', 'system(pmh-id)').then((rows) =>
        rows.filter((d) => d.source === 'login' && d.from === 'admin'),
      ),
    ).toEqual(
      expect.arrayContaining([
        { from: 'admin', to: 'member', source: 'login' },
      ]),
    );
    const flips = (
      await q<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = 'users.role_changed' AND object_id = $1`,
        [s],
      )
    ).rows[0].n;
    expect(flips).toBe(1);
  });

  it.each([
    ['iat − 31 s', 31],
    ['đúng mốc iat − 30 s', 30],
  ])(
    'user đang no_access, inactive_at = %s → đăng nhập được, status active, inactive_at NULL',
    async (_label, offset) => {
      const s = sub(`ok${offset}`);
      const iat = await dbNowSec();
      await revokedAt(s, iat, offset);
      const res = await login(s, { app_role: 'member' }, iat);
      expect(res.headers.location).toBe('/');
      expect(await user(s)).toMatchObject({
        status: 'active',
        inactive_at: null,
      });
      expect(await sessions(s)).toBe(1);
    },
  );

  it('inactive_at = iat − 29 s → /?login=forbidden, không có phiên, audit auth.login_denied_revoked, status vẫn no_access', async () => {
    const s = sub('race');
    const iat = await dbNowSec();
    await revokedAt(s, iat, 29);
    const res = await login(s, { app_role: 'admin' }, iat);
    expect(res.headers.location).toBe('/?login=forbidden');
    expect(await sessions(s)).toBe(0);
    expect((await user(s)).status).toBe('no_access');
    expect(await audits('auth.login_denied_revoked', s)).toEqual([
      { iat: new Date(iat * 1000).toISOString() },
    ]);
  });

  it('webhook_user_order.access_revoked=true, updated_at sau iat → forbidden; user chưa có thì tạo ở no_access', async () => {
    const s = sub('wh');
    const iat = (await dbNowSec()) - 60;
    await q(
      `INSERT INTO webhook_user_order (sub, access_revoked, updated_at) VALUES ($1, true, now())`,
      [s],
    );
    const res = await login(s, { app_role: 'member' }, iat);
    expect(res.headers.location).toBe('/?login=forbidden');
    expect(await sessions(s)).toBe(0);
    expect((await user(s)).status).toBe('no_access');
  });

  it('dấu access_revoked cũ hơn iat − 30 s → đăng nhập được và gỡ dấu', async () => {
    const s = sub('whold');
    await q(
      `INSERT INTO webhook_user_order (sub, access_revoked, updated_at)
       VALUES ($1, true, now() - interval '5 minutes')`,
      [s],
    );
    const res = await login(s, { app_role: 'member' });
    expect(res.headers.location).toBe('/');
    const mark = await q<{ access_revoked: boolean }>(
      'SELECT access_revoked FROM webhook_user_order WHERE sub = $1',
      [s],
    );
    expect(mark.rows[0].access_revoked).toBe(false);
  });

  it('token ver 2 → /?login=failed, audit auth.login_failed reason token_ver, không tạo user', async () => {
    const s = sub('v2');
    const before = new Date();
    const res = await login(s, { ver: 2, app_role: 'admin' });
    expect(res.headers.location).toBe('/?login=failed');
    expect(await user(s)).toBeUndefined();
    const rows = await q<{ detail: Record<string, unknown> }>(
      `SELECT detail FROM audit_log WHERE action = 'auth.login_failed' AND created_at >= $1`,
      [before],
    );
    expect(rows.rows.map((r) => r.detail)).toContainEqual({
      reason: 'token_ver',
      ver: 2,
    });
  });

  it('phiên cookie hợp lệ, UPDATE users SET status=no_access → request kế 401 UNAUTHENTICATED, phiên bị xóa', async () => {
    const s = sub('kicked');
    const res = await login(s, { app_role: 'member' });
    const cookie = sessionCookie(res)!;
    const me = () =>
      request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie);
    await me().expect(200);
    await q(`UPDATE users SET status = 'no_access' WHERE sub = $1`, [s]);
    const denied = await me().expect(401);
    expect(denied.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(await sessions(s)).toBe(0);
  });

  it.each([['locked'], ['deleted']])(
    'phiên của user %s → 401, phiên bị xóa',
    async (status) => {
      const s = sub(`st-${status}`);
      const session = await app.get(SessionService).create({
        userSub: s,
        refreshToken: null,
        accessTokenExp: new Date(Date.now() + 10 * 60_000),
        claims: { sub: s, full_name: s, app_role: 'member', ver: 3 },
        idToken: null,
      });
      await q(
        `INSERT INTO users (sub, full_name, status) VALUES ($1, $1, $2)`,
        [s, status],
      );
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', `vpp_sid=${session.id}`)
        .expect(401);
      expect(await sessions(s)).toBe(0);
    },
  );
});
