import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { OIDC_PROVIDER } from '../src/modules/auth/oidc-provider';
import { hashSessionId } from '../src/modules/auth/session-crypto';
import { SessionService } from '../src/modules/auth/session.service';
import { UsersService } from '../src/modules/users/users.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const rejectingIdp = {
  refresh: () =>
    Promise.reject(
      Object.assign(new Error('grant revoked'), { error: 'invalid_grant' }),
    ),
  buildAuthUrl: () => Promise.reject(new Error('không dùng')),
  exchangeCode: () => Promise.reject(new Error('không dùng')),
  buildLogoutUrl: () => Promise.resolve(null),
  clientCredentialsToken: () => Promise.reject(new Error('không dùng')),
};

describe('PMH ID từ chối refresh token (invalid_grant) qua app thật', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  const sub = `e2e-grant-${randomUUID()}`;

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    app = (await createTestApp(
      [],
      [{ token: OIDC_PROVIDER, useValue: rejectingIdp }],
    )) as INestApplication<App>;
    await app.get(UsersService).upsertFromClaims({ sub, full_name: 'E2E' });
  });

  afterAll(async () => {
    await app.close();
    await pool.query('DELETE FROM sessions WHERE user_sub = $1', [sub]);
    await pool.query('DELETE FROM users WHERE sub = $1', [sub]);
    await pool.end();
  });

  it('access token hết hạn + refresh invalid_grant → 401 UNAUTHENTICATED, Set-Cookie xóa vpp_sid, phiên bị xóa', async () => {
    const session = await app.get(SessionService).create({
      userSub: sub,
      refreshToken: 'rt-revoked',
      accessTokenExp: new Date(Date.now() - 60_000),
      claims: { sub, full_name: 'E2E' },
      idToken: null,
    });
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `vpp_sid=${session.id}`)
      .expect(401);
    expect(res.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^vpp_sid=;.*Expires=Thu, 01 Jan 1970/),
      ]),
    );
    const rows = await pool.query('SELECT 1 FROM sessions WHERE id_hash = $1', [
      hashSessionId(session.id),
    ]);
    expect(rows.rows).toHaveLength(0);
  });
});
