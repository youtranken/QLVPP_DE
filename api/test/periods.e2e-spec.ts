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
const SUFFIX = `${process.pid}-${Date.now()}`;
const MEMBER_SUB = `e2e-periods-member-${SUFFIX}`;
const ADMIN_SUB = `e2e-periods-admin-${SUFFIX}`;

interface CurrentPeriod {
  ym: string;
  deadline: string;
  is_open: boolean;
  days_left: number;
  previous: { ym: string; delivering: boolean } | null;
}

describe('GET periods/current', () => {
  let pool: Pool;
  let app: INestApplication<App> | undefined;
  let lastDaySnapshot: unknown;

  // ClockModule đọc env lúc compile app → đặt offset trước, mỗi ca một app
  async function appAt(iso: string): Promise<INestApplication<App>> {
    await app?.close();
    process.env.CLOCK_OFFSET_MS = String(Date.parse(iso) - Date.now());
    app = (await createTestApp()) as INestApplication<App>;
    return app;
  }

  const current = async (
    sub = MEMBER_SUB,
    role = 'member',
  ): Promise<CurrentPeriod> => {
    const res = await request(app!.getHttpServer())
      .get('/api/periods/current')
      .set('x-dev-user-sub', sub)
      .set('x-dev-role', role)
      .expect(200);
    return res.body as CurrentPeriod;
  };

  async function cleanup(): Promise<void> {
    await pool.query('DELETE FROM requests WHERE user_sub = ANY($1)', [
      [MEMBER_SUB, ADMIN_SUB],
    ]);
    await pool.query("DELETE FROM items WHERE name = 'e2e-periods-' || $1", [
      SUFFIX,
    ]);
    // Chỉ xóa kỳ từ 2026-11 chưa có phiếu nào — kỳ suite khác đang dùng thì giữ
    await pool.query(`
      DELETE FROM periods p WHERE p.ym >= '2026-11-01'
        AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.period_ym = p.ym)`);
  }

  // Kỳ 11 có thể đã có phiếu của suite khác → đặt hạn chuẩn (lastDay 10) và kiểm, không dựa DO NOTHING
  async function seedNovemberPeriod(): Promise<void> {
    const { rows } = await pool.query<{ deadline: Date }>(
      `INSERT INTO periods (ym, deadline) VALUES ('2026-11-01', '2026-11-10T17:00:00Z')
       ON CONFLICT (ym) DO UPDATE SET deadline = EXCLUDED.deadline
       RETURNING deadline`,
    );
    expect(rows[0].deadline.toISOString()).toBe('2026-11-10T17:00:00.000Z');
  }

  const setLastDay = (n: number) =>
    pool.query(
      "UPDATE config SET value = $1 WHERE key = 'registration_last_day'",
      [JSON.stringify(n)],
    );

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    lastDaySnapshot = (
      await pool.query(
        "SELECT value FROM config WHERE key = 'registration_last_day'",
      )
    ).rows[0].value;
    await pool.query('INSERT INTO users (sub) VALUES ($1), ($2)', [
      MEMBER_SUB,
      ADMIN_SUB,
    ]);
    process.env.AUTH_DEV_MODE = 'true';
  });

  beforeEach(async () => {
    await cleanup();
    await setLastDay(10);
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    delete process.env.CLOCK_OFFSET_MS;
  });

  afterAll(async () => {
    await cleanup();
    await pool.query('DELETE FROM users WHERE sub = ANY($1)', [
      [MEMBER_SUB, ADMIN_SUB],
    ]);
    await setLastDay(lastDaySnapshot as number);
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('không phiên → 401', async () => {
    await appAt('2026-11-05T03:00:00Z');
    await request(app!.getHttpServer()).get('/api/periods/current').expect(401);
  });

  it('23:59 ngày 10/11 VN → kỳ 2026-11, còn 1 ngày', async () => {
    // Lùi 30 s khỏi mốc 17:00Z để thời gian dựng app không đẩy qua hạn; biên mili giây ở period.spec
    await appAt('2026-11-10T16:59:30Z');
    expect(await current()).toEqual({
      ym: '2026-11',
      deadline: '2026-11-10T17:00:00.000Z',
      is_open: true,
      days_left: 1,
      previous: null,
    });
  });

  it('00:00 ngày 11/11 VN → kỳ 2026-12, còn 30 ngày', async () => {
    await appAt('2026-11-10T17:00:00Z');
    expect(await current()).toMatchObject({
      ym: '2026-12',
      deadline: '2026-12-10T17:00:00.000Z',
      is_open: true,
      days_left: 30,
      previous: null,
    });
  });

  it('15/11 có phiếu kỳ 11 còn nợ → previous.delivering; giao đủ → false', async () => {
    await seedNovemberPeriod();
    const item = await pool.query<{ id: string }>(
      "INSERT INTO items (name, unit) VALUES ('e2e-periods-' || $1, 'cay') RETURNING id",
      [SUFFIX],
    );
    const req = await pool.query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub)
       VALUES ('2026-11-01', $1, $1) RETURNING id`,
      [MEMBER_SUB],
    );
    const line = await pool.query<{ id: string }>(
      `INSERT INTO request_lines (request_id, item_id, qty) VALUES ($1, $2, 2) RETURNING id`,
      [req.rows[0].id, item.rows[0].id],
    );

    await appAt('2026-11-15T03:00:00Z');
    expect(await current()).toMatchObject({
      ym: '2026-12',
      days_left: 26,
      previous: { ym: '2026-11', delivering: true },
    });

    await pool.query(
      'UPDATE request_lines SET delivered_qty = 1, cancelled_qty = 1 WHERE id = $1',
      [line.rows[0].id],
    );
    expect((await current()).previous).toEqual({
      ym: '2026-11',
      delivering: false,
    });
    // Người khác không có phiếu kỳ 11 → null
    expect((await current(`${MEMBER_SUB}-other`)).previous).toBeNull();
  });

  it.each(['admin', 'sa'])(
    'vai %s có phiếu kỳ 11 còn nợ (dữ liệu cũ seed SQL) → 200, previous null',
    async (role) => {
      await seedNovemberPeriod();
      const item = await pool.query<{ id: string }>(
        "INSERT INTO items (name, unit) VALUES ('e2e-periods-' || $1, 'cay') RETURNING id",
        [SUFFIX],
      );
      const req = await pool.query<{ id: string }>(
        `INSERT INTO requests (period_ym, user_sub, created_by_sub)
         VALUES ('2026-11-01', $1, $1) RETURNING id`,
        [ADMIN_SUB],
      );
      await pool.query(
        'INSERT INTO request_lines (request_id, item_id, qty) VALUES ($1, $2, 2)',
        [req.rows[0].id, item.rows[0].id],
      );

      await appAt('2026-11-15T03:00:00Z');
      expect(await current(ADMIN_SUB, 'member')).toMatchObject({
        previous: { ym: '2026-11', delivering: true },
      });
      expect(await current(ADMIN_SUB, role)).toMatchObject({
        ym: '2026-12',
        is_open: true,
        previous: null,
      });
    },
  );

  it('đổi registration_last_day 10→5 giữa kỳ: kỳ 12 giữ hạn cũ, kỳ 2027-01 tạo sau dùng hạn 5', async () => {
    await appAt('2026-11-15T03:00:00Z');
    expect(await current()).toMatchObject({
      ym: '2026-12',
      deadline: '2026-12-10T17:00:00.000Z',
    });

    await request(app!.getHttpServer())
      .put('/api/admin/config')
      .set('x-dev-user-sub', ADMIN_SUB)
      .set('x-dev-role', 'admin')
      .send({ registration_last_day: 5 })
      .expect(200);
    expect(await current()).toMatchObject({
      ym: '2026-12',
      deadline: '2026-12-10T17:00:00.000Z',
      days_left: 26,
    });

    await appAt('2026-12-11T03:00:00Z');
    expect(await current()).toMatchObject({
      ym: '2027-01',
      deadline: '2027-01-05T17:00:00.000Z',
      is_open: true,
      days_left: 26,
    });
  });

  it('kỳ periodFor(now) đã có mà qua hạn (config nới 10→28 sau ngày 10) → tiến sang kỳ sau với hạn mới', async () => {
    await seedNovemberPeriod();
    await setLastDay(28);
    await appAt('2026-11-15T03:00:00Z');
    expect(await current()).toMatchObject({
      ym: '2026-12',
      deadline: '2026-12-28T17:00:00.000Z',
      is_open: true,
    });
  });
});
