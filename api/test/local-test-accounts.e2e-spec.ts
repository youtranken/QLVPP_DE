import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { hashPassword } from '../src/modules/auth/local-sa.service';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import { DirectorySyncService } from '../src/modules/users/directory-sync.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const PASS_HC = 'hc-pass-e2e';
const PASS_A = 'a-pass-e2e';
const SUB_HC = 'local-test-e2e-hc';
const SUB_A = 'local-test-e2e-a';
const ACCOUNTS = JSON.stringify([
  {
    username: 'hc.e2e',
    password_hash: hashPassword(PASS_HC),
    role: 'admin',
    sub: SUB_HC,
    name: 'HC E2E',
  },
  {
    username: 'nv.e2e',
    password_hash: hashPassword(PASS_A),
    role: 'member',
    sub: SUB_A,
    name: 'Nhân viên E2E (test)',
    email: 'nv.e2e@test.local',
    department: 'Phòng Test',
  },
]);

// PMH ID chỉ biết một user thật; tài khoản local-test-* không có trong danh bạ
const directory = {
  fetchUsers: () =>
    Promise.resolve([
      { id: 'pmh-real-e2e', full_name: 'Người thật', status: 'active' },
    ]),
  fetchGroups: () => Promise.resolve([]),
};

const KEYS = [
  'AUTH_DEV_MODE',
  'LOCAL_TEST_ACCOUNTS',
  'TRUST_PROXY_HOPS',
] as const;

describe('tài khoản thử local (LOCAL_TEST_ACCOUNTS)', () => {
  let pool: Pool;
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

  function setEnv(env: Partial<Record<(typeof KEYS)[number], string>>): void {
    for (const k of KEYS) {
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
    }
  }

  async function cleanup(): Promise<void> {
    await pool.query(`DELETE FROM sessions WHERE user_sub = ANY($1)`, [
      [SUB_HC, SUB_A],
    ]);
    await pool.query(`DELETE FROM users WHERE sub = ANY($1)`, [
      [SUB_HC, SUB_A, 'pmh-real-e2e'],
    ]);
  }

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await pool.end();
    setEnv(saved);
  });

  describe('mặc định (không đặt biến)', () => {
    let app: INestApplication<App>;
    beforeAll(async () => {
      setEnv({ AUTH_DEV_MODE: 'true' });
      app = (await createTestApp()) as INestApplication<App>;
    });
    afterAll(() => app.close());

    it('GET auth/config → testAccounts=false; POST auth/test-login → 404', async () => {
      const cfg = await request(app.getHttpServer())
        .get('/api/auth/config')
        .expect(200);
      expect(cfg.body).toEqual({ testAccounts: false });
      await request(app.getHttpServer())
        .post('/api/auth/test-login')
        .send({ username: 'hc.e2e', password: PASS_HC })
        .expect(404);
    });
  });

  describe('có biến nhưng AUTH_DEV_MODE tắt', () => {
    let app: INestApplication<App>;
    beforeAll(async () => {
      setEnv({ LOCAL_TEST_ACCOUNTS: ACCOUNTS });
      app = (await createTestApp()) as INestApplication<App>;
    });
    afterAll(() => app.close());

    it('vẫn tắt: config false, test-login 404', async () => {
      const cfg = await request(app.getHttpServer())
        .get('/api/auth/config')
        .expect(200);
      expect(cfg.body).toEqual({ testAccounts: false });
      await request(app.getHttpServer())
        .post('/api/auth/test-login')
        .send({ username: 'hc.e2e', password: PASS_HC })
        .expect(404);
    });
  });

  describe('bật (AUTH_DEV_MODE=true + LOCAL_TEST_ACCOUNTS, NODE_ENV=test)', () => {
    let app: INestApplication<App>;
    beforeAll(async () => {
      setEnv({
        AUTH_DEV_MODE: 'true',
        LOCAL_TEST_ACCOUNTS: ACCOUNTS,
        TRUST_PROXY_HOPS: '1',
      });
      app = (await createTestApp(
        [],
        [{ token: DIRECTORY_CLIENT, useValue: directory }],
      )) as INestApplication<App>;
    });
    afterAll(() => app.close());

    const login = (username: string, password: string, ip = '198.51.100.1') =>
      request(app.getHttpServer())
        .post('/api/auth/test-login')
        .set('X-Forwarded-For', ip)
        .send({ username, password });

    const cookieOf = (res: request.Response): string[] =>
      res.headers['set-cookie'] as unknown as string[];

    it('GET auth/config → đúng {testAccounts:true}, không lộ username', async () => {
      const cfg = await request(app.getHttpServer())
        .get('/api/auth/config')
        .expect(200);
      expect(cfg.body).toEqual({ testAccounts: true });
      expect(JSON.stringify(cfg.body)).not.toContain('e2e');
    });

    it('sai mật khẩu → 401 TEST_LOGIN_INVALID + audit thất bại; sai lần 5 → 429 kể cả đúng sau đó', async () => {
      const ip = `198.51.100.${10 + Math.floor(Math.random() * 200)}`;
      const failedAudits = async () =>
        (
          await pool.query(
            `SELECT count(*)::int AS n FROM audit_log
             WHERE action = 'auth.test_login_failed' AND detail->>'ip' = $1`,
            [ip],
          )
        ).rows[0].n as number;
      const audits0 = await failedAudits();
      const first = await login('nv.e2e', 'sai', ip).expect(401);
      expect(first.body.code).toBe('TEST_LOGIN_INVALID');
      expect(first.headers['set-cookie']).toBeUndefined();
      for (let i = 0; i < 3; i += 1)
        await login('nv.e2e', 'sai', ip).expect(401);
      const fifth = await login('nv.e2e', 'sai', ip).expect(429);
      expect(fifth.body.code).toBe('TEST_LOGIN_LOCKED');
      await login('nv.e2e', PASS_A, ip).expect(429);
      expect((await failedAudits()) - audits0).toBe(6);
    });

    it('hc (admin): phiên thường → me.role=admin, có csrf, vào route admin; audit auth.test_login', async () => {
      const loginAudits = async () =>
        (
          await pool.query(
            `SELECT count(*)::int AS n FROM audit_log
             WHERE action = 'auth.test_login' AND actor = $1 AND object_type = 'session'`,
            [SUB_HC],
          )
        ).rows[0].n as number;
      const audits0 = await loginAudits();
      const res = await login('hc.e2e', PASS_HC).expect(200);
      const cookie = cookieOf(res);
      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', cookie)
        .expect(200);
      expect(me.body).toMatchObject({
        sub: SUB_HC,
        role: 'admin',
        devMode: false,
        fullName: 'HC E2E',
      });
      expect(me.body.csrfToken).toMatch(/^[0-9a-f]{64}$/);
      await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Cookie', cookie)
        .expect(200);
      expect((await loginAudits()) - audits0).toBe(1);
    });

    it('nv (member): me.role=member, route admin 403; POST cần CSRF như user thật', async () => {
      const res = await login('nv.e2e', PASS_A).expect(200);
      const cookie = cookieOf(res);
      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', cookie)
        .expect(200);
      expect(me.body).toMatchObject({ sub: SUB_A, role: 'member' });
      expect(me.body.department).toBe('Phòng Test');
      await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Cookie', cookie)
        .expect(403);
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .expect(403);
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', me.body.csrfToken as string)
        .expect(200);
    });

    it('users row được upsert (active, tên, email, phòng) và hiện trong danh sách Nhân viên', async () => {
      await pool.query(
        `UPDATE users SET status = 'locked', full_name = 'cũ' WHERE sub = $1`,
        [SUB_A],
      );
      await login('nv.e2e', PASS_A).expect(200);
      const { rows } = await pool.query(
        `SELECT status, full_name, email, department FROM users WHERE sub = $1`,
        [SUB_A],
      );
      expect(rows[0]).toEqual({
        status: 'active',
        full_name: 'Nhân viên E2E (test)',
        email: 'nv.e2e@test.local',
        department: 'Phòng Test',
      });
      const list = await request(app.getHttpServer())
        .get('/api/admin/users?search=E2E')
        .set('x-dev-user-sub', 'dev-admin')
        .set('x-dev-role', 'admin')
        .expect(200);
      const subs = (list.body.items as Array<{ sub: string }>).map(
        (u) => u.sub,
      );
      expect(subs).toEqual(expect.arrayContaining([SUB_HC, SUB_A]));
    });

    it('directory sync (user vắng mặt ở PMH ID) không khóa, không ghi đè tài khoản thử', async () => {
      await login('hc.e2e', PASS_HC).expect(200);
      await login('nv.e2e', PASS_A).expect(200);
      const before = await pool.query(
        `SELECT sub, status, full_name, email, department, groups FROM users
         WHERE sub = ANY($1) ORDER BY sub`,
        [[SUB_HC, SUB_A]],
      );
      await app.get(DirectorySyncService).sync('system');
      const after = await pool.query(
        `SELECT sub, status, full_name, email, department, groups FROM users
         WHERE sub = ANY($1) ORDER BY sub`,
        [[SUB_HC, SUB_A]],
      );
      expect(after.rows).toEqual(before.rows);
      expect(after.rows.map((r: { status: string }) => r.status)).toEqual([
        'active',
        'active',
      ]);
      const real = await pool.query(`SELECT 1 FROM users WHERE sub = $1`, [
        'pmh-real-e2e',
      ]);
      expect(real.rows).toHaveLength(1);
    });
  });

  describe('tắt biến sau khi đã có phiên → phiên cũ chết (fail-closed)', () => {
    it('phiên tài khoản thử tạo lúc bật → khi tắt, auth/me 401 và phiên bị xóa', async () => {
      setEnv({ AUTH_DEV_MODE: 'true', LOCAL_TEST_ACCOUNTS: ACCOUNTS });
      let app = (await createTestApp()) as INestApplication<App>;
      let res: request.Response;
      try {
        res = await request(app.getHttpServer())
          .post('/api/auth/test-login')
          .send({ username: 'nv.e2e', password: PASS_A })
          .expect(200);
      } finally {
        await app.close();
      }
      const cookie = res.headers['set-cookie'] as unknown as string[];
      const sid = /vpp_sid=([0-9a-f-]{36})/.exec(cookie.join(';'))?.[1];

      setEnv({ AUTH_DEV_MODE: 'true' });
      app = (await createTestApp()) as INestApplication<App>;
      try {
        await request(app.getHttpServer())
          .get('/api/auth/me')
          .set('Cookie', cookie)
          .expect(401);
        const { rows } = await pool.query(
          'SELECT 1 FROM sessions WHERE id = $1',
          [sid],
        );
        expect(rows).toHaveLength(0);
      } finally {
        await app.close();
      }
    });
  });
});
