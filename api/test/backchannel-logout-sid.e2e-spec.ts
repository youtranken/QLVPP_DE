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

const BCL_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

// PMH ID bật sid: logout_token có sid → chỉ hủy phiên VPP mở từ đúng phiên SSO đó
describe('POST backchannel-logout theo sid', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let privateKey: jose.CryptoKey;
  const SUFFIX = randomUUID().slice(0, 8);
  const sub = `e2e-bcl-sid-${SUFFIX}`;
  let nextLogin = { accessToken: '', sid: null as string | null };

  const provider = {
    buildAuthUrl: () => Promise.resolve('https://id.test/auth'),
    exchangeCode: () =>
      Promise.resolve({
        accessToken: nextLogin.accessToken,
        refreshToken: 'rt',
        idToken: null,
        sid: nextLogin.sid,
      }),
    refresh: () => Promise.reject(new Error('không dùng')),
    buildLogoutUrl: () => Promise.resolve(null),
    clientCredentialsToken: () => Promise.resolve('m2m'),
  };

  const accessToken = () =>
    new jose.SignJWT({ full_name: 'BCL SID', ver: 3, app_role: 'member' })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(sub)
      .setIssuer(process.env.PMH_ISSUER_URL as string)
      .setAudience(process.env.PMH_CLIENT_ID as string)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

  const logoutToken = (claims: Record<string, unknown> = {}) =>
    new jose.SignJWT({ events: { [BCL_EVENT]: {} }, ...claims })
      .setProtectedHeader({ alg: 'RS256', typ: 'logout+jwt' })
      .setSubject(sub)
      .setIssuer(process.env.PMH_ISSUER_URL as string)
      .setAudience(process.env.PMH_CLIENT_ID as string)
      .setIssuedAt()
      .setJti(randomUUID())
      .setExpirationTime('2m')
      .sign(privateKey);

  // Đăng nhập qua callback thật; trả cookie vpp_sid
  const login = async (sid: string | null) => {
    nextLogin = { accessToken: await accessToken(), sid };
    const tx = JSON.stringify({ codeVerifier: 'v', state: 'st' });
    const res = await request(app.getHttpServer())
      .get('/api/auth/callback?code=c&state=st')
      .set('Cookie', `vpp_oidc_tx=${encodeURIComponent(tx)}`)
      .expect(302);
    const cookie = ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('vpp_sid='));
    return (cookie as string).split(';')[0].slice('vpp_sid='.length);
  };

  const bcl = async (claims: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/backchannel-logout')
      .type('form')
      .send({ logout_token: await logoutToken(claims) })
      .expect(200);

  const me = (id: string) =>
    request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `vpp_sid=${id}`);

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), { log: () => undefined });
    app = (await createTestApp(
      [],
      [
        { token: OIDC_PROVIDER, useValue: provider },
        { token: DIRECTORY_CLIENT, useValue: directoryStub() },
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

  afterEach(() => app.get(SessionService).destroyAllForUser(sub));

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE sub = $1', [sub]);
    await app.close();
    await pool.end();
  });

  it('callback lưu sid của id_token vào phiên', async () => {
    await login('sso-1');
    const rows = await pool.query<{ idp_sid: string | null }>(
      'SELECT idp_sid FROM sessions WHERE user_sub = $1',
      [sub],
    );
    expect(rows.rows.map((r) => r.idp_sid)).toEqual(['sso-1']);
  });

  it('logout_token sid sso-1 → hủy phiên sso-1, giữ phiên sso-2', async () => {
    const one = await login('sso-1');
    const two = await login('sso-2');
    await bcl({ sid: 'sso-1' });
    await me(one).expect(401);
    await me(two).expect(200);
  });

  it('logout_token có sid → hủy cả phiên chưa có sid (mở trước khi PMH ID bật sid)', async () => {
    const old = await login(null);
    const two = await login('sso-2');
    await bcl({ sid: 'sso-1' });
    await me(old).expect(401);
    await me(two).expect(200);
  });

  it('logout_token không sid (PMH ID hiện tại) → hủy mọi phiên của sub', async () => {
    const one = await login('sso-1');
    const two = await login('sso-2');
    await bcl({});
    await me(one).expect(401);
    await me(two).expect(401);
  });

  it('sid khớp nhưng sub khác → không hủy phiên của người này', async () => {
    const one = await login('sso-1');
    const other = new jose.SignJWT({
      events: { [BCL_EVENT]: {} },
      sid: 'sso-1',
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'logout+jwt' })
      .setSubject(`${sub}-khac`)
      .setIssuer(process.env.PMH_ISSUER_URL as string)
      .setAudience(process.env.PMH_CLIENT_ID as string)
      .setIssuedAt()
      .setJti(randomUUID())
      .setExpirationTime('2m')
      .sign(privateKey);
    await request(app.getHttpServer())
      .post('/api/backchannel-logout')
      .type('form')
      .send({ logout_token: await other })
      .expect(200);
    await me(one).expect(200);
  });
});
