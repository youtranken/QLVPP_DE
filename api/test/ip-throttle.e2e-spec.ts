import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { hashPassword } from '../src/modules/auth/local-sa.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

describe('throttle theo IP trước IdentityGuard', () => {
  let app: INestApplication<App>;
  const saved = {
    perMin: process.env.THROTTLE_IP_PER_MIN,
    hops: process.env.TRUST_PROXY_HOPS,
    user: process.env.LOCAL_SA_USERNAME,
    hash: process.env.LOCAL_SA_PASSWORD_HASH,
  };

  function restore(key: string, value: string | undefined): void {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL);
    process.env.THROTTLE_IP_PER_MIN = '5';
    process.env.TRUST_PROXY_HOPS = '1';
    process.env.LOCAL_SA_USERNAME = 'sa-throttle-e2e';
    process.env.LOCAL_SA_PASSWORD_HASH = hashPassword('dung-mat-khau');
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    restore('THROTTLE_IP_PER_MIN', saved.perMin);
    restore('TRUST_PROXY_HOPS', saved.hops);
    restore('LOCAL_SA_USERNAME', saved.user);
    restore('LOCAL_SA_PASSWORD_HASH', saved.hash);
  });

  const me = (ip: string) =>
    request(app.getHttpServer())
      .get('/api/auth/me')
      .set('X-Forwarded-For', ip)
      .set('Cookie', `vpp_sid=${randomUUID()}`);

  it('cookie vpp_sid ngẫu nhiên: 5 lần 401, lần 6 cùng IP → 429; IP khác vẫn 401', async () => {
    for (let i = 0; i < 5; i += 1) {
      await me('203.0.113.50').expect(401);
    }
    await me('203.0.113.50').expect(429);
    await me('203.0.113.51').expect(401);
  });

  it('sa-login 10/phút/IP: 10 lần (mỗi lần username khác, không dính lockout) 401, lần 11 → 429', async () => {
    const login = (i: number) =>
      request(app.getHttpServer())
        .post('/api/auth/sa-login')
        .set('X-Forwarded-For', '203.0.113.60')
        .send({ username: `khong-ton-tai-${i}`, password: 'sai' });
    for (let i = 0; i < 10; i += 1) {
      await login(i).expect(401);
    }
    await login(10).expect(429);
  });
});
