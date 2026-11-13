import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { hashPassword } from '../src/modules/auth/local-sa.service';
import { OIDC_PROVIDER } from '../src/modules/auth/oidc-provider';
import { SessionService } from '../src/modules/auth/session.service';
import { UsersService } from '../src/modules/users/users.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const USER = 'sa-outage-e2e';
const PASS = 'break-glass-outage';

const unreachableIdp = {
  refresh: () => Promise.reject(new TypeError('fetch failed')),
  buildAuthUrl: () => Promise.reject(new TypeError('fetch failed')),
  exchangeCode: () => Promise.reject(new TypeError('fetch failed')),
  buildLogoutUrl: () => Promise.resolve(null),
  clientCredentialsToken: () => Promise.reject(new TypeError('fetch failed')),
};

describe('PMH ID sập, trình duyệt còn phiên SSO hết hạn', () => {
  let app: INestApplication<App>;
  let staleSid: string;
  const saved = {
    user: process.env.LOCAL_SA_USERNAME,
    hash: process.env.LOCAL_SA_PASSWORD_HASH,
  };

  function restore(key: string, value: string | undefined): void {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL);
    process.env.LOCAL_SA_USERNAME = USER;
    process.env.LOCAL_SA_PASSWORD_HASH = hashPassword(PASS);
    app = (await createTestApp(
      [],
      [{ token: OIDC_PROVIDER, useValue: unreachableIdp }],
    )) as INestApplication<App>;
    const sub = `e2e-outage-${randomUUID()}`;
    await app.get(UsersService).upsertFromClaims({ sub, full_name: 'E2E' });
    const session = await app.get(SessionService).create({
      userSub: sub,
      refreshToken: 'rt-outage',
      accessTokenExp: new Date(Date.now() - 60_000),
      claims: { sub, full_name: 'E2E' },
      idToken: null,
    });
    staleSid = session.id;
  });

  afterAll(async () => {
    await app.close();
    restore('LOCAL_SA_USERNAME', saved.user);
    restore('LOCAL_SA_PASSWORD_HASH', saved.hash);
  });

  it('route bảo vệ vẫn 503 SSO_UNAVAILABLE (không biến outage thành logout)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `vpp_sid=${staleSid}`)
      .expect(503);
    expect(res.body.code).toBe('SSO_UNAVAILABLE');
  });

  // Boot web (auth/session, @OptionalAuth): outage không bị nuốt thành "chưa đăng nhập" như route @Public
  it('GET auth/session (boot web) → 503 SSO_UNAVAILABLE, giữ cookie', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/session')
      .set('Cookie', `vpp_sid=${staleSid}`)
      .expect(503);
    expect(res.body.code).toBe('SSO_UNAVAILABLE');
    const setCookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(setCookie.some((c) => /^vpp_sid=;/.test(c))).toBe(false);
  });

  it('GET public-config (route @Public) → 200', async () => {
    await request(app.getHttpServer())
      .get('/api/public-config')
      .set('Cookie', `vpp_sid=${staleSid}`)
      .expect(200);
  });

  it('POST sa-login đúng mật khẩu → 200 dù cookie phiên SSO không resolve được', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sa-login')
      .set('Cookie', `vpp_sid=${staleSid}`)
      .send({ username: USER, password: PASS })
      .expect(200);
    expect(res.body).toEqual({ ok: true });
    const setCookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    const sid = setCookie
      .map((c) => /^vpp_sid=([^;]*)/.exec(c)?.[1])
      .find((v) => v !== undefined);
    expect(sid).toBeTruthy();
    expect(sid).not.toBe(staleSid);
  });
});
