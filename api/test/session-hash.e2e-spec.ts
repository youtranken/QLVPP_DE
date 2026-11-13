import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as jose from 'jose';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtVerifierService } from '../src/modules/auth/jwt-verifier.service';
import { hashPassword } from '../src/modules/auth/local-sa.service';
import { OIDC_PROVIDER } from '../src/modules/auth/oidc-provider';
import { hashSessionId, sessionRef } from '../src/modules/auth/session-crypto';
import { SessionService } from '../src/modules/auth/session.service';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import { directoryStub } from './directory.stub';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const ISSUER = 'https://id.e2e-sh.test/oidc';
const CLIENT_ID = 'client_vpp_e2e_sh';
const SA_USER = 'sa-sh-e2e';
const SA_PASS = 'sa-sh-pass';
const TEST_PASS = 'test-sh-pass';
const SUFFIX = randomUUID().slice(0, 8);
const PMH_SUB = `e2e-sh-pmh-${SUFFIX}`;
const TEST_SUB = 'local-test-e2e-sh';
const KEYS = [
  'PMH_ISSUER_URL',
  'PMH_CLIENT_ID',
  'LOCAL_SA_USERNAME',
  'LOCAL_SA_PASSWORD_HASH',
  'AUTH_DEV_MODE',
  'LOCAL_TEST_ACCOUNTS',
] as const;

// Cookie vpp_sid chỉ trình duyệt giữ: DB giữ sha256, Nhật ký giữ 12 hex đầu của hash
describe('khóa phiên băm: cookie thô không nằm trong DB/Nhật ký', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let privateKey: jose.CryptoKey;
  let nextToken = '';
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

  const provider = {
    buildAuthUrl: () => Promise.resolve('https://id.e2e-sh.test/auth'),
    exchangeCode: () =>
      Promise.resolve({
        accessToken: nextToken,
        refreshToken: 'rt-sh',
        idToken: null,
      }),
    refresh: () => Promise.reject(new Error('không dùng')),
    buildLogoutUrl: () => Promise.resolve(null),
    clientCredentialsToken: () => Promise.resolve('m2m'),
  };

  const server = () => app.getHttpServer();
  const cookieOf = (res: request.Response): string => {
    const raw = ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('vpp_sid='));
    const value = /^vpp_sid=([^;]*)/.exec(raw ?? '')?.[1];
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    return value!;
  };
  const sessionRows = async (sub: string) =>
    (await pool.query('SELECT * FROM sessions WHERE user_sub = $1', [sub]))
      .rows as Record<string, unknown>[];
  const auditRows = async (actor: string, action: string) =>
    (
      await pool.query(
        'SELECT * FROM audit_log WHERE actor = $1 AND action = $2',
        [actor, action],
      )
    ).rows as Record<string, unknown>[];
  const auditApi = async (actor: string, action: string) =>
    (
      await request(server())
        .get('/api/admin/audit')
        .query({ actor, action })
        .set('x-dev-user-sub', 'dev-admin')
        .set('x-dev-role', 'admin')
        .expect(200)
    ).body as { items: Array<{ objectType: string; objectId: string }> };

  // Không cột nào của phiên / dòng Nhật ký nào chứa cookie thô; objectId = 12 hex đầu sha256(cookie)
  async function expectNoRawCookie(
    sub: string,
    action: string,
    cookie: string,
  ): Promise<void> {
    const rows = await sessionRows(sub);
    expect(rows).toHaveLength(1);
    expect(rows[0].id_hash).toBe(hashSessionId(cookie));
    expect(JSON.stringify(rows)).not.toContain(cookie);
    const audits = await auditRows(sub, action);
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits)).not.toContain(cookie);
    expect(audits[0].object_id).toBe(sessionRef(cookie));
    const api = await auditApi(sub, action);
    expect(api.items).toHaveLength(1);
    expect(api.items[0].objectType).toBe('session');
    expect(api.items[0].objectId).toMatch(/^[0-9a-f]{12}$/);
    expect(api.items[0].objectId).toBe(hashSessionId(cookie).slice(0, 12));
    expect(JSON.stringify(api)).not.toContain(cookie);
  }

  const me = (cookie: string) =>
    request(server()).get('/api/auth/me').set('Cookie', `vpp_sid=${cookie}`);

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    process.env.PMH_ISSUER_URL = ISSUER;
    process.env.PMH_CLIENT_ID = CLIENT_ID;
    process.env.LOCAL_SA_USERNAME = SA_USER;
    process.env.LOCAL_SA_PASSWORD_HASH = hashPassword(SA_PASS);
    process.env.AUTH_DEV_MODE = 'true';
    process.env.LOCAL_TEST_ACCOUNTS = JSON.stringify([
      {
        username: 'sh.e2e',
        password_hash: hashPassword(TEST_PASS),
        role: 'member',
        sub: TEST_SUB,
        name: 'SH E2E',
      },
    ]);
    await cleanup();
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

  async function cleanup(): Promise<void> {
    await pool.query('DELETE FROM sessions WHERE user_sub = ANY($1)', [
      [PMH_SUB, TEST_SUB, 'local:sa'],
    ]);
  }

  afterAll(async () => {
    await app.close();
    await cleanup();
    await pool.query('DELETE FROM users WHERE sub = ANY($1)', [
      [PMH_SUB, TEST_SUB],
    ]);
    await pool.end();
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('đăng nhập PMH ID: cookie 43 ký tự base64url; DB/Nhật ký không chứa cookie; objectId 12 hex của hash', async () => {
    const iat = Math.floor(Date.now() / 1000);
    nextToken = await new jose.SignJWT({
      email: `${PMH_SUB}@pmh.test`,
      full_name: 'SH PMH',
      ver: 3,
      app_role: 'member',
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(PMH_SUB)
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt(iat)
      .setExpirationTime(iat + 300)
      .sign(privateKey);
    const tx = JSON.stringify({ codeVerifier: 'v', state: 'st' });
    const res = await request(server())
      .get('/api/auth/callback?code=c&state=st')
      .set('Cookie', `vpp_oidc_tx=${encodeURIComponent(tx)}`)
      .expect(302);
    expect(res.headers.location).toBe('/');
    const cookie = cookieOf(res);
    await expectNoRawCookie(PMH_SUB, 'auth.login', cookie);
    await me(cookie).expect(200);
  });

  it('đăng nhập SA: như trên; gửi giá trị hash trong DB làm cookie → 401 (cả tra thẳng service cũng không thấy)', async () => {
    await cleanup();
    const before = (await auditRows('local:sa', 'auth.sa_login')).length;
    const res = await request(server())
      .post('/api/auth/sa-login')
      .send({ username: SA_USER, password: SA_PASS })
      .expect(200);
    const cookie = cookieOf(res);
    const rows = await sessionRows('local:sa');
    expect(rows).toHaveLength(1);
    expect(rows[0].id_hash).toBe(hashSessionId(cookie));
    expect(JSON.stringify(rows)).not.toContain(cookie);
    const audits = await auditRows('local:sa', 'auth.sa_login');
    expect(audits).toHaveLength(before + 1);
    expect(JSON.stringify(audits)).not.toContain(cookie);
    expect(audits.map((a) => a.object_id)).toContain(sessionRef(cookie));

    await me(cookie).expect(200);
    const stolen = rows[0].id_hash as string;
    const rejected = await me(stolen).expect(401);
    expect(rejected.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(await app.get(SessionService).find(stolen)).toBeNull();
    // Phiên thật vẫn sống: cookie giả chỉ bị từ chối, không đụng phiên
    await me(cookie).expect(200);
  });

  it('đăng nhập tài khoản thử: như trên; đăng xuất xóa theo hash, auth.logout cùng objectId', async () => {
    const res = await request(server())
      .post('/api/auth/test-login')
      .send({ username: 'sh.e2e', password: TEST_PASS })
      .expect(200);
    const cookie = cookieOf(res);
    await expectNoRawCookie(TEST_SUB, 'auth.test_login', cookie);

    const csrf = ((await me(cookie).expect(200)).body as { csrfToken: string })
      .csrfToken;
    await request(server())
      .post('/api/auth/logout')
      .set('Cookie', `vpp_sid=${cookie}`)
      .set('X-CSRF-Token', csrf)
      .expect(200);
    expect(await sessionRows(TEST_SUB)).toHaveLength(0);
    const out = await auditRows(TEST_SUB, 'auth.logout');
    expect(out).toHaveLength(1);
    expect(out[0].object_id).toBe(sessionRef(cookie));
    expect(JSON.stringify(out)).not.toContain(cookie);
    await me(cookie).expect(401);
  });

  it('phiên SA idle quá hạn: xóa theo hash, auth.session_expired có objectId 12 hex', async () => {
    await cleanup();
    const res = await request(server())
      .post('/api/auth/sa-login')
      .send({ username: SA_USER, password: SA_PASS })
      .expect(200);
    const cookie = cookieOf(res);
    await pool.query(
      `UPDATE sessions SET last_seen_at = now() - interval '3 hours' WHERE id_hash = $1`,
      [hashSessionId(cookie)],
    );
    await me(cookie).expect(401);
    expect(await sessionRows('local:sa')).toHaveLength(0);
    const expired = await pool.query<{ object_id: string; detail: unknown }>(
      `SELECT object_id, detail FROM audit_log
        WHERE actor = 'local:sa' AND action = 'auth.session_expired' AND object_id = $1`,
      [sessionRef(cookie)],
    );
    expect(expired.rows).toHaveLength(1);
    expect(expired.rows[0].detail).toEqual({ reason: 'local_sa_idle' });
    expect(JSON.stringify(expired.rows)).not.toContain(cookie);
  });
});
