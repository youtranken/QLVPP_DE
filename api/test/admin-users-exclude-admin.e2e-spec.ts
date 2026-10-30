import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

describe('GET admin/users?exclude_admin', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  const tag = randomUUID().slice(0, 8);
  const plain = `e2e-xa-plain-${tag}`;
  const hc = `e2e-xa-hc-${tag}`;
  const name = `Xa${tag}`;
  const savedDev = process.env.AUTH_DEV_MODE;

  const subs = async (query: Record<string, string>) => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/users')
      .query({ search: name, ...query })
      .set('x-dev-user-sub', 'dev-admin')
      .set('x-dev-role', 'admin')
      .expect(200);
    return (res.body.items as { sub: string }[]).map((u) => u.sub).sort();
  };

  beforeAll(async () => {
    process.env.AUTH_DEV_MODE = 'true';
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    app = (await createTestApp()) as INestApplication<App>;
    await pool.query(
      `INSERT INTO users (sub, full_name, status, groups) VALUES
         ($1, $3, 'active', '["Phong CT"]'),
         ($2, $3, 'active', '["Phong CT","VPP_ADMIN"]')`,
      [plain, hc, name],
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE sub = ANY($1)', [[plain, hc]]);
    await pool.end();
    await app.close();
    if (savedDev === undefined) delete process.env.AUTH_DEV_MODE;
    else process.env.AUTH_DEV_MODE = savedDev;
  });

  it('exclude_admin=true loại người thuộc admin_group (VPP_ADMIN khác hoa thường), giữ người thường', async () => {
    expect(await subs({ exclude_admin: 'true' })).toEqual([plain]);
  });

  it.each([[{}], [{ exclude_admin: 'false' }]])(
    'vắng hoặc false (%j) → có cả hai',
    async (q) => {
      expect(await subs(q)).toEqual([hc, plain].sort());
    },
  );

  it('exclude_admin=abc → 400 VALIDATION', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/users')
      .query({ exclude_admin: 'abc' })
      .set('x-dev-user-sub', 'dev-admin')
      .set('x-dev-role', 'admin')
      .expect(400);
    expect(res.body.code).toBe('VALIDATION');
  });

  it('gỡ nhóm admin khỏi người đó → exclude_admin=true thấy lại', async () => {
    await pool.query(
      `UPDATE users SET groups = '["Phong CT"]' WHERE sub = $1`,
      [hc],
    );
    expect(await subs({ exclude_admin: 'true' })).toEqual([hc, plain].sort());
  });
});
