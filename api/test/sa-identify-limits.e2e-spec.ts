import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  GLOBAL_MAX,
  IP_MAX,
  hashPassword,
} from '../src/modules/auth/local-sa.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const USER = 'it-breakglass-limits';
const PASS = 'break-glass-identify';
const KEYS = [
  'LOCAL_SA_USERNAME',
  'LOCAL_SA_PASSWORD_HASH',
  'TRUST_PROXY_HOPS',
];

// Bộ đếm lockout nằm trong LocalSaService của từng app → mỗi describe dựng app riêng
function limitsApp(hops = '1') {
  const ctx = {} as { app: INestApplication<App>; pool: Pool };
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

  beforeAll(async () => {
    ctx.pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    process.env.LOCAL_SA_USERNAME = USER;
    process.env.LOCAL_SA_PASSWORD_HASH = hashPassword(PASS);
    process.env.TRUST_PROXY_HOPS = hops;
    ctx.app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.pool.end();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const post = (path: string, xff: string, body: object) =>
    request(ctx.app.getHttpServer())
      .post(`/api/auth/${path}`)
      .set('X-Forwarded-For', xff)
      .send(body);
  return {
    ctx,
    identify: (xff: string, identifier: string) =>
      post('identify', xff, { identifier }),
    saLogin: (xff: string, password: string) =>
      post('sa-login', xff, { username: USER, password }),
  };
}

// Dò tên (identify sai) và dò mật khẩu (sa-login sai) dùng chung một ngân sách theo IP và toàn cục:
// tìm ra tên SA không cho thêm lượt đoán mật khẩu
describe('identify + sa-login: chung ngân sách sai theo IP', () => {
  const { identify, saLogin } = limitsApp();

  it(`${IP_MAX - 2} lần identify sai + 1 lần mật khẩu sai = ${IP_MAX - 1} → vẫn 401; lần sai thứ ${IP_MAX} → 429; sau đó identify đúng tên và mật khẩu đúng đều 429; IP khác vẫn được`, async () => {
    const ip = '198.51.100.10';
    for (let i = 1; i <= IP_MAX - 2; i++) {
      // throttle 10/phút/IP chỉ đếm theo từng route: identify và sa-login không ăn lượt của nhau
      const res = await identify(ip, `guess-${i}`).expect(200);
      expect(res.body).toEqual({ next: 'invalid' });
    }
    await saLogin(ip, 'sai-1').expect(401);
    const locked = await saLogin(ip, 'sai-2').expect(429);
    expect(locked.body.code).toBe('SA_LOGIN_LOCKED');
    const id = await identify(ip, USER).expect(429);
    expect(id.body.code).toBe('SA_LOGIN_LOCKED');
    await saLogin(ip, PASS).expect(429);
    const other = await identify('198.51.100.11', USER).expect(200);
    expect(other.body).toEqual({ next: 'password' });
  });

  it('gõ đúng tên không tính là lần sai', async () => {
    const ip = '198.51.100.20';
    for (let i = 1; i <= 10; i++) await identify(ip, USER).expect(200);
    await saLogin(ip, PASS).expect(200);
  });
});

describe('identify: trần toàn cục khi dò rải IP + ghi Nhật ký khi chạm trần', () => {
  const { ctx, identify } = limitsApp();

  it(`${GLOBAL_MAX - 1} lần sai rải IP → IP mới vẫn được; lần sai thứ ${GLOBAL_MAX} → mọi IP 429, đúng một auth.sa_lockout_global`, async () => {
    const before = await ctx.pool.query(
      `SELECT count(*)::int AS n FROM audit_log WHERE action = 'auth.sa_lockout_global'`,
    );
    // Mỗi IP 1 lần: dưới ngưỡng IP và throttle
    for (let i = 1; i < GLOBAL_MAX; i++) {
      await identify(`192.0.2.${i}`, `guess-${i}`).expect(200);
    }
    const ok = await identify('192.0.2.200', USER).expect(200);
    expect(ok.body).toEqual({ next: 'password' });
    await identify(`192.0.2.${GLOBAL_MAX}`, 'guess-last').expect(200);
    const res = await identify('192.0.2.201', USER).expect(429);
    expect(res.body.code).toBe('SA_LOGIN_LOCKED');
    await identify('192.0.2.202', 'guess-more').expect(429);
    let after = 0;
    for (let i = 0; i < 40 && after <= before.rows[0].n; i++) {
      after = (
        await ctx.pool.query(
          `SELECT count(*)::int AS n FROM audit_log WHERE action = 'auth.sa_lockout_global'`,
        )
      ).rows[0].n;
      if (after <= before.rows[0].n)
        await new Promise((r) => setTimeout(r, 50));
    }
    expect(after - before.rows[0].n).toBe(1);
  });
});

// Prod: trình duyệt → EDGE nginx → vpp-web nginx → api, cả hai nginx nối $proxy_add_x_forwarded_for, TRUST_PROXY_HOPS=2.
// req.ip phải là IP do EDGE ghi (áp chót), không phải chữ client tự đặt ở đầu X-Forwarded-For
describe('identify sau hai lớp proxy (TRUST_PROXY_HOPS=2)', () => {
  const { identify } = limitsApp('2');

  it('client đổi X-Forwarded-For giả mỗi lần vẫn bị đếm theo IP thật: lần 11 → 429; IP thật khác vẫn được', async () => {
    for (let i = 1; i <= 10; i++) {
      await identify(`10.9.9.${i}, 198.51.100.77, 172.18.0.5`, USER).expect(
        200,
      );
    }
    await identify('10.9.9.99, 198.51.100.77, 172.18.0.5', USER).expect(429);
    await identify('10.9.9.1, 198.51.100.78, 172.18.0.5', USER).expect(200);
  });
});
