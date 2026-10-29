import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
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

  it('sai 1–4 (IP A, X) → 401; sai thứ 5 → 429 SA_LOGIN_LOCKED kể cả mật khẩu đúng sau đó; (A, Y) vẫn 401; (B, X) đăng nhập được', async () => {
    for (let i = 0; i < 4; i += 1) {
      await login('203.0.113.1', 'sai').expect(401);
    }
    const fifth = await login('203.0.113.1', 'sai').expect(429);
    expect(fifth.body.code).toBe('SA_LOGIN_LOCKED');
    await login('203.0.113.1', PASS).expect(429);
    await login('203.0.113.1', 'sai', 'user-khac').expect(401);
    await login('203.0.113.2', PASS).expect(200);
  });

  it('phiên SA idle 2 giờ + 1 giây → GET auth/me 401 và phiên bị xóa; 1:59:59 vẫn 200', async () => {
    const res = await login('203.0.113.3', PASS).expect(200);
    const cookie = res.headers['set-cookie'] as unknown as string[];
    const sid = /vpp_sid=([0-9a-f-]{36})/.exec(cookie.join(';'))?.[1];
    expect(sid).toBeDefined();
    const me = () =>
      request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie);
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const idle = (interval: string) =>
      pool.query(
        `UPDATE sessions SET last_seen_at = now() - $2::interval WHERE id = $1`,
        [sid, interval],
      );
    try {
      await idle('1 hour 59 minutes 59 seconds');
      await me().expect(200);
      await idle('2 hours 1 second');
      await me().expect(401);
      const { rows } = await pool.query(
        'SELECT 1 FROM sessions WHERE id = $1',
        [sid],
      );
      expect(rows).toHaveLength(0);
    } finally {
      await pool.end();
    }
  });
});
