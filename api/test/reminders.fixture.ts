import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { NotificationScheduler } from '../src/modules/reminders/notification-scheduler';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const SAVED_KEYS = [
  'authorized_groups',
  'registration_last_day',
  'low_stock_notify',
  'admin_group',
];

export interface NoteRow {
  user_sub: string;
  topic: string;
  params: Record<string, unknown>;
  link: string | null;
  created_at: Date;
}

interface Globals {
  periods: Array<{ ym: string; deadline: Date; headcount: number | null }>;
  config: Array<{ key: string; value: unknown }>;
}

async function snapshotGlobals(pool: Pool): Promise<Globals> {
  const periods = await pool.query<Globals['periods'][number]>(
    "SELECT to_char(ym, 'YYYY-MM-DD') AS ym, deadline, headcount FROM periods",
  );
  const config = await pool.query<Globals['config'][number]>(
    'SELECT key, value FROM config WHERE key = ANY($1)',
    [SAVED_KEYS],
  );
  return { periods: periods.rows, config: config.rows };
}

async function restoreGlobals(pool: Pool, saved: Globals): Promise<void> {
  for (const c of saved.config) {
    await pool.query('UPDATE config SET value = $2::jsonb WHERE key = $1', [
      c.key,
      JSON.stringify(c.value),
    ]);
  }
  for (const p of saved.periods) {
    await pool.query(
      `INSERT INTO periods (ym, deadline, headcount) VALUES ($1::date, $2, $3)
       ON CONFLICT (ym) DO UPDATE SET deadline = EXCLUDED.deadline, headcount = EXCLUDED.headcount`,
      [p.ym, p.deadline, p.headcount],
    );
  }
  await pool.query(
    `DELETE FROM periods p WHERE NOT (to_char(p.ym, 'YYYY-MM-DD') = ANY($1))
       AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.period_ym = p.ym)`,
    [saved.periods.map((p) => p.ym)],
  );
}

// Sửa config/kỳ toàn cục an toàn vì e2e chạy maxWorkers 1; gate riêng → mẫu số chỉ gồm người của suite
async function isolateCalendar(pool: Pool, group: string): Promise<void> {
  await pool.query(
    "UPDATE config SET value = $1::jsonb WHERE key = 'authorized_groups'",
    [JSON.stringify([group])],
  );
  await pool.query(
    "UPDATE config SET value = '10' WHERE key = 'registration_last_day'",
  );
  // Kỳ sau 2026-12 do suite tự tạo theo config lúc chạy; kỳ suite khác còn phiếu thì giữ
  await pool.query(`DELETE FROM periods p WHERE p.ym > '2026-12-01'
    AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.period_ym = p.ym)`);
  await pool.query(
    `INSERT INTO periods (ym, deadline) VALUES ('2026-12-01', '2026-12-10T17:00:00Z')
     ON CONFLICT (ym) DO UPDATE SET deadline = EXCLUDED.deadline, headcount = NULL`,
  );
}

async function setupSuite(pool: Pool, group: string) {
  await runMigrations(pool, resolveMigrationsDir(), silent);
  const startedAt = (await pool.query<{ now: Date }>('SELECT now() AS now'))
    .rows[0].now;
  const saved = await snapshotGlobals(pool);
  const adminGroup = (
    await pool.query<{ value: string }>(
      "SELECT value FROM config WHERE key = 'admin_group'",
    )
  ).rows[0].value;
  await isolateCalendar(pool, group);
  return { saved, startedAt, adminGroup };
}

async function teardownSuite(pool: Pool, mine: string, saved: Globals) {
  for (const table of ['in_app_notifications', 'requests']) {
    await pool.query(`DELETE FROM ${table} WHERE user_sub LIKE $1`, [mine]);
  }
  await pool.query('DELETE FROM users WHERE sub LIKE $1', [mine]);
  await restoreGlobals(pool, saved);
  await pool.end();
}

type Query = <T extends object>(
  text: string,
  values?: unknown[],
) => Promise<{ rows: T[] }>;

// Đọc dữ liệu suite: chỉ thông báo của user mang hậu tố suite (`mine` là mẫu LIKE)
function suiteQueries(q: Query, mine: string) {
  const notes = async (eventId: string) =>
    (
      await q<NoteRow>(
        `SELECT user_sub, topic, params, link, created_at FROM in_app_notifications
         WHERE event_id = $1 AND user_sub LIKE $2 ORDER BY user_sub`,
        [eventId, mine],
      )
    ).rows;
  const periodCol = async (ym: string, col: 'headcount' | 'deadline') =>
    (
      await q<Record<string, unknown>>(
        `SELECT ${col} FROM periods WHERE ym = $1::date`,
        [`${ym}-01`],
      )
    ).rows[0]?.[col];
  return {
    notes,
    recipients: async (eventId: string) =>
      (await notes(eventId)).map((n) => n.user_sub),
    addUser: (s: string, groups: string[]) =>
      q(
        `INSERT INTO users (sub, full_name, status, groups) VALUES ($1, $1, 'active', $2::jsonb)`,
        [s, JSON.stringify(groups)],
      ),
    headcount: (ym: string) => periodCol(ym, 'headcount'),
    deadline: async (ym: string) =>
      ((await periodCol(ym, 'deadline')) as Date | undefined)?.toISOString(),
  };
}

// PUT config xóa cache của app → hiệu lực ngay như Hành chính đổi trên màn Cấu hình
function suiteActions(
  app: () => INestApplication<App>,
  q: Query,
  adminSub: string,
  startedAt: () => Date,
) {
  const setConfig = (patch: Record<string, unknown>) =>
    request(app().getHttpServer())
      .put('/api/admin/config')
      .set('x-dev-user-sub', adminSub)
      .set('x-dev-role', 'admin')
      .send(patch)
      .expect(200);
  return {
    http: () => request(app().getHttpServer()),
    run: (iso: string) =>
      app().get(NotificationScheduler).runHourly(new Date(iso)),
    setConfig,
    setLastDay: (n: number) => setConfig({ registration_last_day: n }),
    // audit_log append-only, created_at theo đồng hồ DB thật → chỉ đếm dòng từ lúc suite bắt đầu
    auditsSince: async (action: string, objectId: string) =>
      (
        await q<{ detail: unknown }>(
          `SELECT detail FROM audit_log
           WHERE action = $1 AND object_id = $2 AND created_at >= $3 ORDER BY created_at`,
          [action, objectId, startedAt()],
        )
      ).rows,
  };
}

// App + lịch riêng của suite; kỳ/config toàn cục được chụp trước và trả lại sau
export function remindersFixture(tag: string) {
  const SUFFIX = `${tag}-${process.pid}-${Date.now().toString(36)}`;
  const GROUP = `e2e-rem-group-${SUFFIX}`;
  const sub = (n: string) => `e2e-rem-${n}-${SUFFIX}`;
  const mine = `e2e-rem-%-${SUFFIX}`;
  let app: INestApplication<App>;
  let pool: Pool;
  let ctx: Awaited<ReturnType<typeof setupSuite>>;
  // afterAll của fixture chạy trước afterAll của suite → dọn riêng của suite đăng ký vào đây, chạy trước pool.end
  const cleanups: Array<() => Promise<unknown>> = [];

  const q: Query = (text, values = []) => pool.query(text, values);
  const startApp = async () => {
    app = (await createTestApp()) as INestApplication<App>;
  };

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    ctx = await setupSuite(pool, GROUP);
    process.env.AUTH_DEV_MODE = 'true';
    await startApp();
  });

  afterAll(async () => {
    await app.close();
    for (const fn of cleanups) await fn();
    await teardownSuite(pool, mine, ctx.saved);
    delete process.env.AUTH_DEV_MODE;
  });

  return {
    SUFFIX,
    GROUP,
    sub,
    adminGroup: () => ctx.adminGroup,
    app: () => app,
    q,
    ...suiteQueries(q, mine),
    ...suiteActions(
      () => app,
      q,
      sub('admin'),
      () => ctx.startedAt,
    ),
    restart: () => app.close().then(startApp),
    onCleanup: (fn: () => Promise<unknown>) => cleanups.push(fn),
  };
}
