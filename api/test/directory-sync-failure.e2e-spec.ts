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
  fetchUser: () => Promise.reject(failure),
  requestCount: () => 0,
  resetCount: () => undefined,
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

  const failedAudits = async () =>
    (
      await pool.query<{ actor: string; detail: { code: string } }>(
        `SELECT actor, detail FROM audit_log
         WHERE action = 'users.directory_sync_failed' ORDER BY id`,
      )
    ).rows;

  const status = () =>
    request(app.getHttpServer())
      .get('/api/admin/directory/status')
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

  it('PMH ID không liên lạc được → 503 DIRECTORY_UNAVAILABLE, audit users.directory_sync_failed (không audit sync thành công), app vẫn sống', async () => {
    failure = new ServiceUnavailableException({
      code: 'DIRECTORY_UNAVAILABLE',
      message: 'Không liên lạc được PMH ID.',
    });
    const before = await syncAudits();
    const failedBefore = (await failedAudits()).length;
    const lastAtBefore = (
      await pool.query(
        "SELECT value FROM config WHERE key = 'directory_sync_last_at'",
      )
    ).rows;
    const startedAt = Date.now();
    const res = await sync().expect(503);
    expect(res.body.code).toBe('DIRECTORY_UNAVAILABLE');
    expect(await syncAudits()).toBe(before);
    const failed = await failedAudits();
    expect(failed).toHaveLength(failedBefore + 1);
    expect(failed[failed.length - 1]).toEqual({
      actor: 'dev-admin',
      detail: { code: 'DIRECTORY_UNAVAILABLE' },
    });
    // Lỗi gần nhất vào config; mốc thành công giữ nguyên
    const st = (await status().expect(200)).body as {
      last_error: { at: string; code: string; message: string } | null;
    };
    expect(st.last_error).toMatchObject({
      code: 'DIRECTORY_UNAVAILABLE',
      message: 'Không liên lạc được PMH ID.',
    });
    expect(Date.parse(st.last_error!.at)).toBeGreaterThanOrEqual(
      startedAt - 1000,
    );
    expect(
      (
        await pool.query(
          "SELECT value FROM config WHERE key = 'directory_sync_last_at'",
        )
      ).rows,
    ).toEqual(lastAtBefore);
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
    const failed = await failedAudits();
    expect(failed[failed.length - 1].detail).toEqual({
      code: 'DIRECTORY_AUTH_FAILED',
    });
  });

  it('PMH ID vẫn 429 sau 3 lần thử → 503 DIRECTORY_RATE_LIMITED, không audit sync thành công', async () => {
    failure = new ServiceUnavailableException({
      code: 'DIRECTORY_RATE_LIMITED',
      message: 'x',
    });
    const before = await syncAudits();
    const res = await sync().expect(503);
    expect(res.body.code).toBe('DIRECTORY_RATE_LIMITED');
    expect(await syncAudits()).toBe(before);
    expect((await failedAudits()).at(-1)?.detail).toEqual({
      code: 'DIRECTORY_RATE_LIMITED',
    });
    expect(
      ((await status().expect(200)).body as { last_error: { code: string } })
        .last_error.code,
    ).toBe('DIRECTORY_RATE_LIMITED');
  });
});
