import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { OIDC_PROVIDER } from '../src/modules/auth/oidc-provider';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const LOGOUT_URL = 'https://id.example.test/logout';

const idp = {
  buildLogoutUrl: () => Promise.resolve(LOGOUT_URL),
};

describe('GET auth/switch-account', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL);
    app = (await createTestApp(
      [],
      [{ token: OIDC_PROVIDER, useValue: idp }],
    )) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
  });

  it('cookie vpp_sid rác (không phải UUID) → 302 sang end_session như không có phiên, không 500', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/switch-account')
      .set('Cookie', 'vpp_sid=khong-phai-uuid')
      .expect(302);
    expect(res.headers.location).toBe(LOGOUT_URL);
  });
});
