import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const RUN = `c${Date.now().toString(36)}`;

describe('admin/units: hai yêu cầu tạo đồng thời', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  const post = (name: string) =>
    request(app.getHttpServer())
      .post('/api/admin/units')
      .set('x-dev-user-sub', 'e2e-units-conc')
      .set('x-dev-role', 'admin')
      .send({ name });

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    await pool.query('DELETE FROM units WHERE name LIKE $1', [`%${RUN}%`]);
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('"Gói X" và "Gồi X" cùng lúc → cả hai 201, code gốc và gốc-2', async () => {
    const [a, b] = await Promise.all([post(`Gói ${RUN}`), post(`Gồi ${RUN}`)]);
    expect([a.status, b.status]).toEqual([201, 201]);
    const codes = [a.body.code, b.body.code].sort() as string[];
    expect(codes).toEqual([`goi-${RUN}`, `goi-${RUN}-2`]);
  });

  it('cùng một tên hai lần cùng lúc → đúng [201, 409 UNIT_EXISTS], không 500', async () => {
    const res = await Promise.all([post(`Xấp ${RUN}`), post(`Xấp ${RUN}`)]);
    const outcome = res
      .map((r) => `${r.status}${r.status === 409 ? ` ${r.body.code}` : ''}`)
      .sort();
    expect(outcome).toEqual(['201', '409 UNIT_EXISTS']);
  });
});
