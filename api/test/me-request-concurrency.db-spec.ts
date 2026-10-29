import { HttpException, INestApplication } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { DRIZZLE_DB } from '../src/database/database.module';
import type { Database } from '../src/database/database.module';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { PeriodsService } from '../src/modules/periods/periods.service';
import { RequestLinesWriter } from '../src/modules/requests/request-lines.writer';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const SUFFIX = `${process.pid}-${Date.now().toString(36)}`;
const OWNER = `db-req-conc-${SUFFIX}`;
const ROUNDS = 5;

describe('RequestLinesWriter.save: hai lần lưu đầu song song (Postgres thật)', () => {
  let app: INestApplication;
  let pool: Pool;
  let dir: string;
  let itemId: string;

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.query(
      "INSERT INTO users (sub, department, status) VALUES ($1, 'Phòng CT', 'active')",
      [OWNER],
    );
    itemId = (
      await pool.query<{ id: string }>(
        "INSERT INTO items (name, unit, max_qty) VALUES ($1, 'cay', 10) RETURNING id",
        [`db-req-conc-${SUFFIX}`],
      )
    ).rows[0].id;
    dir = await mkdtemp(join(tmpdir(), 'vpp-req-conc-'));
    process.env.FILES_DIR = dir;
    process.env.AUTH_DEV_MODE = 'true';
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await pool.query('DELETE FROM requests WHERE user_sub = $1', [OWNER]);
    await pool.query('DELETE FROM items WHERE id = $1', [itemId]);
    await pool.query('DELETE FROM users WHERE sub = $1', [OWNER]);
    await pool.end();
    await rm(dir, { recursive: true, force: true });
    delete process.env.FILES_DIR;
    delete process.env.AUTH_DEV_MODE;
  });

  it(`${ROUNDS} vòng Promise.all: đúng 1 phiếu, không lọt 23505 — mỗi lần lưu thành công hoặc STALE_UPDATE`, async () => {
    const db = app.get<Database>(DRIZZLE_DB);
    const writer = app.get(RequestLinesWriter);
    const now = new Date();
    const { ym } = await app.get(PeriodsService).openPeriod(db, now);
    const saveOnce = (qty: number) =>
      db.transaction((tx) =>
        writer.save(tx, {
          request: null,
          owner_sub: OWNER,
          period_ym: ym,
          actor: { sub: OWNER, role: 'member', devMode: true },
          mode: 'member',
          body: { lines: [{ item_id: itemId, qty }] },
          now,
        }),
      );
    for (let round = 0; round < ROUNDS; round++) {
      await pool.query('DELETE FROM requests WHERE user_sub = $1', [OWNER]);
      const results = await Promise.allSettled([saveOnce(1), saveOnce(2)]);
      const codes = results.map((r) => {
        if (r.status === 'fulfilled') return 'OK';
        const e = r.reason as unknown;
        return e instanceof HttpException
          ? (e.getResponse() as { code: string }).code
          : String(e);
      });
      expect(codes).toContain('OK');
      for (const c of codes) expect(['OK', 'STALE_UPDATE']).toContain(c);
      const { rows } = await pool.query<{ n: string }>(
        `SELECT count(*) AS n FROM requests r JOIN request_lines l ON l.request_id = r.id
         WHERE r.user_sub = $1`,
        [OWNER],
      );
      expect(
        (
          await pool.query('SELECT id FROM requests WHERE user_sub = $1', [
            OWNER,
          ])
        ).rows,
      ).toHaveLength(1);
      expect(Number(rows[0].n)).toBe(1);
    }
  });

  it(`${ROUNDS} vòng hai PUT me/request/lines thật song song lần đầu → một phiếu, mỗi phản hồi 200 hoặc 409 STALE_UPDATE, không 500`, async () => {
    const { ym } = await app.get(PeriodsService).openPeriod();
    const server = (app as INestApplication<App>).getHttpServer();
    const put = (qty: number) =>
      request(server)
        .put('/api/me/request/lines')
        .set('x-dev-user-sub', OWNER)
        .set('x-dev-role', 'member')
        .send({ ym, lines: [{ item_id: itemId, qty }] });
    for (let round = 0; round < ROUNDS; round++) {
      await pool.query('DELETE FROM requests WHERE user_sub = $1', [OWNER]);
      const results = await Promise.all([put(1), put(2)]);
      const outcomes = results.map((r) =>
        r.status === 200 ? '200' : `${r.status} ${r.body.code}`,
      );
      expect(outcomes).toContain('200');
      for (const o of outcomes)
        expect(['200', '409 STALE_UPDATE']).toContain(o);
      const { rows } = await pool.query(
        'SELECT id FROM requests WHERE user_sub = $1',
        [OWNER],
      );
      expect(rows).toHaveLength(1);
    }
  });
});
