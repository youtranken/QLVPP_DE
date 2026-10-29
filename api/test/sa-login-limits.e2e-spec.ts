import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { GLOBAL_MAX, hashPassword } from '../src/modules/auth/local-sa.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const USER = 'sa-limits-e2e';
const PASS = 'break-glass-limits';
const KEYS = [
  'LOCAL_SA_USERNAME',
  'LOCAL_SA_PASSWORD_HASH',
  'TRUST_PROXY_HOPS',
];

// Bộ đếm lockout nằm trong LocalSaService của từng app → mỗi describe dựng app riêng
function saApp() {
  let app: INestApplication<App>;
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL);
    process.env.LOCAL_SA_USERNAME = USER;
    process.env.LOCAL_SA_PASSWORD_HASH = hashPassword(PASS);
    process.env.TRUST_PROXY_HOPS = '1';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  return (ip: string, body: object) =>
    request(app.getHttpServer())
      .post('/api/auth/sa-login')
      .set('X-Forwarded-For', ip)
      .send(body);
}

describe('sa-login: độ dài username/password', () => {
  const login = saApp();

  it('username 200 ký tự → 401 (qua DTO); 201 ký tự → 400 VALIDATION {fields: [username]}', async () => {
    await login('198.51.100.1', {
      username: 'u'.repeat(200),
      password: 'sai',
    }).expect(401);
    const res = await login('198.51.100.1', {
      username: 'u'.repeat(201),
      password: 'sai',
    }).expect(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION',
      fields: ['username'],
    });
  });

  it('password 500 ký tự → 401 (qua DTO); 501 ký tự → 400 VALIDATION {fields: [password]}', async () => {
    await login('198.51.100.2', {
      username: USER,
      password: 'p'.repeat(500),
    }).expect(401);
    const res = await login('198.51.100.2', {
      username: USER,
      password: 'p'.repeat(501),
    }).expect(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION',
      fields: ['password'],
    });
  });
});

describe('sa-login: khóa toàn cục khi dò rải IP', () => {
  const login = saApp();
  // Mỗi IP sai 2 lần: dưới ngưỡng cặp (5) và ngưỡng 10/phút/IP
  const ipOf = (i: number) => `192.0.2.${Math.floor(i / 2) + 1}`;

  it(`${GLOBAL_MAX - 1} lần sai rải IP → đều 401; lần thứ ${GLOBAL_MAX} → 429 SA_LOGIN_LOCKED; mật khẩu đúng từ IP mới vẫn 429`, async () => {
    for (let i = 0; i < GLOBAL_MAX - 1; i += 1) {
      await login(ipOf(i), { username: USER, password: 'sai' }).expect(401);
    }
    const last = await login(ipOf(GLOBAL_MAX - 1), {
      username: USER,
      password: 'sai',
    }).expect(429);
    expect(last.body).toMatchObject({ code: 'SA_LOGIN_LOCKED' });
    await login('192.0.2.200', { username: USER, password: PASS }).expect(429);
  });
});
