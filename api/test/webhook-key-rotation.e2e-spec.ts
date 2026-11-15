import { INestApplication } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import { directoryStub } from './directory.stub';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const OLD_KEY = 'whsec-khoa-cu-e2e';
const NEW_KEY = 'whsec-khoa-moi-e2e';
let seq = BigInt(Date.now()) * 1000n + 7n;

// PMH ID đổi khóa ký: header chính ký khóa mới, X-PMH-Signature-V2-Previous ký khóa cũ trong 48 h
describe('webhook PMH ID khi đổi khóa ký (VPP còn giữ khóa cũ)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  const saved = process.env.PMH_WEBHOOK_SECRET;

  const sign = (key: string, ts: string, body: string) =>
    createHmac('sha256', key).update(`${ts}.${body}`).digest('hex');
  const post = (keys: { primary: string; previous?: string }) => {
    const ts = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({
      type: 'user.khong_xu_ly',
      user_id: `e2e-whrot-${randomUUID()}`,
      event_id: (seq += 10n).toString(),
    });
    const req = request(app.getHttpServer())
      .post('/api/webhooks/pmh-id')
      .set('Content-Type', 'application/json')
      .set('X-PMH-Timestamp', ts)
      .set('X-PMH-Signature-V2', sign(keys.primary, ts, body));
    if (keys.previous) {
      req.set('X-PMH-Signature-V2-Previous', sign(keys.previous, ts, body));
    }
    return req.send(body);
  };

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), { log: () => undefined });
    process.env.PMH_WEBHOOK_SECRET = OLD_KEY;
    app = (await createTestApp(
      [],
      [{ token: DIRECTORY_CLIENT, useValue: directoryStub() }],
    )) as INestApplication<App>;
  });

  afterAll(async () => {
    process.env.PMH_WEBHOOK_SECRET = saved;
    await app.close();
    await pool.end();
  });

  it('header chính khóa mới + Previous khóa cũ → 200', async () => {
    await post({ primary: NEW_KEY, previous: OLD_KEY }).expect(200);
  });

  it('header chính khóa mới, không có Previous → 401 WEBHOOK_SIGNATURE_INVALID', async () => {
    const res = await post({ primary: NEW_KEY }).expect(401);
    expect(res.body.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });

  it('cả hai header ký bằng khóa lạ → 401', async () => {
    await post({ primary: NEW_KEY, previous: 'khoa-la' }).expect(401);
  });
});
