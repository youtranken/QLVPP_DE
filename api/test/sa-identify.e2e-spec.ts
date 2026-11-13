import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { hashPassword } from '../src/modules/auth/local-sa.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const USER = 'it-breakglass-e2e';
const KEYS = [
  'LOCAL_SA_USERNAME',
  'LOCAL_SA_PASSWORD_HASH',
  'TRUST_PROXY_HOPS',
];

function identifyApp(username: string | undefined) {
  let app: INestApplication<App>;
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL);
    if (username === undefined) delete process.env.LOCAL_SA_USERNAME;
    else process.env.LOCAL_SA_USERNAME = username;
    process.env.LOCAL_SA_PASSWORD_HASH = hashPassword('pw-identify');
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

  return {
    identify: (ip: string, body: object) =>
      request(app.getHttpServer())
        .post('/api/auth/identify')
        .set('X-Forwarded-For', ip)
        .send(body),
    http: () => request(app.getHttpServer()),
  };
}

// Ô đăng nhập: chữ không phải email chỉ sang bước mật khẩu khi đúng hệt tên SA trong env; server chỉ trả có/không
describe('POST auth/identify', () => {
  const { identify, http } = identifyApp(USER);

  it('đúng hệt tên SA → 200 {next: password}, không kèm gì khác', async () => {
    const res = await identify('203.0.113.1', { identifier: USER }).expect(200);
    expect(res.body).toEqual({ next: 'password' });
  });

  it('tên khác / gần đúng / khác hoa thường / email / khoảng trắng → 200 {next: invalid}, cùng một dạng', async () => {
    for (const identifier of [
      'applicant1',
      USER.slice(0, -1),
      `${USER}x`,
      USER.toUpperCase(),
      `${USER}@pmh.com.vn`,
      ` ${USER} `,
    ]) {
      const res = await identify('203.0.113.2', { identifier }).expect(200);
      expect(res.body).toEqual({ next: 'invalid' });
    }
  });

  it('identifier 200 ký tự → 200; 201 ký tự / rỗng / thiếu → 400 VALIDATION', async () => {
    const ok = await identify('203.0.113.3', {
      identifier: 'u'.repeat(200),
    }).expect(200);
    expect(ok.body).toEqual({ next: 'invalid' });
    for (const body of [
      { identifier: 'u'.repeat(201) },
      { identifier: '' },
      {},
    ]) {
      const res = await identify('203.0.113.3', body).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION' });
    }
  });

  it('chặn dò tên theo IP: 10 lần/phút được, lần 11 → 429; IP khác vẫn được', async () => {
    for (let i = 1; i <= 10; i++) {
      await identify('203.0.113.9', { identifier: `guess-${i}` }).expect(200);
    }
    await identify('203.0.113.9', { identifier: USER }).expect(429);
    await identify('203.0.113.10', { identifier: USER }).expect(200);
  });

  it('public-config (ẩn danh) không chứa tên SA', async () => {
    const res = await http().get('/api/public-config').expect(200);
    expect(JSON.stringify(res.body)).not.toContain(USER);
  });
});

describe('POST auth/identify khi chưa cấu hình SA', () => {
  const { identify } = identifyApp(undefined);

  it('mọi chữ → {next: invalid} (không có bước mật khẩu nào)', async () => {
    const res = await identify('203.0.113.20', { identifier: 'sa' }).expect(
      200,
    );
    expect(res.body).toEqual({ next: 'invalid' });
  });
});
