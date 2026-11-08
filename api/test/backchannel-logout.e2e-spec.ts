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
import { SessionService } from '../src/modules/auth/session.service';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import { UsersService } from '../src/modules/users/users.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const BCL_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

describe('POST backchannel-logout', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let privateKey: jose.CryptoKey;
  const sub = `e2e-bcl-${randomUUID()}`;
  const sessionIds: string[] = [];

  async function logoutToken(claims: Record<string, unknown> = {}) {
    return new jose.SignJWT({ events: { [BCL_EVENT]: {} }, ...claims })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(sub)
      .setIssuer(process.env.PMH_ISSUER_URL as string)
      .setAudience(process.env.PMH_CLIENT_ID as string)
      .setIssuedAt()
      .setJti(randomUUID())
      .setExpirationTime('2m')
      .sign(privateKey);
  }

  const me = (sid: string) =>
    request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `vpp_sid=${sid}`);

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    const directory = {
      fetchUsers: () => Promise.resolve([]),
    };
    app = (await createTestApp(
      [],
      [{ token: DIRECTORY_CLIENT, useValue: directory }],
    )) as INestApplication<App>;
    const pair = await jose.generateKeyPair('RS256');
    privateKey = pair.privateKey;
    const publicJwk = await jose.exportJWK(pair.publicKey);
    // Key test thay JWKS remote của PMH ID
    app
      .get(JwtVerifierService)
      .setKeySource(jose.createLocalJWKSet({ keys: [publicJwk] }));
    await app.get(UsersService).upsertFromClaims({ sub, full_name: 'BCL E2E' });
    for (let i = 0; i < 2; i += 1) {
      const session = await app.get(SessionService).create({
        userSub: sub,
        refreshToken: null,
        accessTokenExp: new Date(Date.now() + 10 * 60_000),
        claims: { sub, full_name: 'BCL E2E' },
        idToken: null,
      });
      sessionIds.push(session.id);
    }
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('logout_token có nonce (id_token dùng nhầm) → 400 LOGOUT_TOKEN_INVALID, phiên còn', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/backchannel-logout')
      .type('form')
      .send({ logout_token: await logoutToken({ nonce: 'n' }) })
      .expect(400);
    expect(res.body.code).toBe('LOGOUT_TOKEN_INVALID');
    await me(sessionIds[0]).expect(200);
  });

  it('logout_token hợp lệ cho sub có 2 phiên → cả hai GET auth/me 401', async () => {
    await me(sessionIds[0]).expect(200);
    await me(sessionIds[1]).expect(200);
    await request(app.getHttpServer())
      .post('/api/backchannel-logout')
      .type('form')
      .send({ logout_token: await logoutToken() })
      .expect(200);
    await me(sessionIds[0]).expect(401);
    await me(sessionIds[1]).expect(401);
  });
});
