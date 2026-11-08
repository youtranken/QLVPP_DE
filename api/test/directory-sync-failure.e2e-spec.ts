import {
  BadGatewayException,
  INestApplication,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';

let failure: Error;
const directory = {
  fetchUsers: () => Promise.reject(failure),
};

describe('POST admin/directory/sync khi PMH ID lỗi', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  const savedDev = process.env.AUTH_DEV_MODE;

  beforeAll(async () => {
    process.env.AUTH_DEV_MODE = 'true';
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    app = (await createTestApp(
      [],
      [{ token: DIRECTORY_CLIENT, useValue: directory }],
    )) as INestApplication<App>;
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
    if (savedDev === undefined) delete process.env.AUTH_DEV_MODE;
    else process.env.AUTH_DEV_MODE = savedDev;
  });

  const sync = () =>
    request(app.getHttpServer())
      .post('/api/admin/directory/sync')
      .set('x-dev-user-sub', 'dev-admin')
      .set('x-dev-role', 'admin');

  const syncAudits = async () =>
    Number(
      (
        await pool.query(
          `SELECT count(*) FROM audit_log WHERE action = 'users.directory_sync'`,
        )
      ).rows[0].count,
    );

  it('PMH ID không liên lạc được → 503 DIRECTORY_UNAVAILABLE, không audit, app vẫn sống', async () => {
    failure = new ServiceUnavailableException({
      code: 'DIRECTORY_UNAVAILABLE',
      message: 'x',
    });
    const before = await syncAudits();
    const res = await sync().expect(503);
    expect(res.body.code).toBe('DIRECTORY_UNAVAILABLE');
    expect(await syncAudits()).toBe(before);
    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('x-dev-user-sub', 'dev-admin')
      .set('x-dev-role', 'admin')
      .expect(200);
  });

  it('PMH ID từ chối token M2M → 502 DIRECTORY_AUTH_FAILED', async () => {
    failure = new BadGatewayException({
      code: 'DIRECTORY_AUTH_FAILED',
      message: 'x',
    });
    const res = await sync().expect(502);
    expect(res.body.code).toBe('DIRECTORY_AUTH_FAILED');
  });
});
