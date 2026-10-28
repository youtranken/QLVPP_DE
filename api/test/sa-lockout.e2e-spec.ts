import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { hashPassword } from '../src/modules/auth/local-sa.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const USER = 'sa-e2e';
const PASS = 'break-glass-e2e';

describe('SA lockout theo cặp (IP, username)', () => {
  let app: INestApplication<App>;
  const saved = {
    user: process.env.LOCAL_SA_USERNAME,
    hash: process.env.LOCAL_SA_PASSWORD_HASH,
    hops: process.env.TRUST_PROXY_HOPS,
  };

  function restore(key: string, value: string | undefined): void {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL);
    process.env.LOCAL_SA_USERNAME = USER;
    process.env.LOCAL_SA_PASSWORD_HASH = hashPassword(PASS);
    process.env.TRUST_PROXY_HOPS = '1';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    restore('LOCAL_SA_USERNAME', saved.user);
    restore('LOCAL_SA_PASSWORD_HASH', saved.hash);
    restore('TRUST_PROXY_HOPS', saved.hops);
  });

  const login = (ip: string, password: string, username = USER) =>
    request(app.getHttpServer())
      .post('/api/auth/sa-login')
      .set('X-Forwarded-For', ip)
      .send({ username, password });

  it('5 sai (IP A, X) → 429 SA_LOGIN_LOCKED kể cả mật khẩu đúng; (A, Y) vẫn 401; (B, X) đăng nhập được', async () => {
    for (let i = 0; i < 4; i += 1) {
      await login('203.0.113.1', 'sai').expect(401);
    }
    const fifth = await login('203.0.113.1', 'sai').expect(429);
    expect(fifth.body.code).toBe('SA_LOGIN_LOCKED');
    await login('203.0.113.1', PASS).expect(429);
    await login('203.0.113.1', 'sai', 'user-khac').expect(401);
    await login('203.0.113.2', PASS).expect(200);
  });
});
