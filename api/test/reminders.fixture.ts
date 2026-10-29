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
const SAVED_KEYS = ['authorized_groups', 'registration_last_day'];

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

// App + lịch riêng của suite; kỳ/config toàn cục được chụp trước và trả lại sau
export function remindersFixture(tag: string) {
  const SUFFIX = `${tag}-${process.pid}-${Date.now().toString(36)}`;
  const GROUP = `e2e-rem-group-${SUFFIX}`;
  const sub = (n: string) => `e2e-rem-${n}-${SUFFIX}`;
  const mine = `e2e-rem-%-${SUFFIX}`;
  let app: INestApplication<App>;
  let pool: Pool;
  let adminGroup = '';
  let saved: Globals;
  // afterAll của fixture chạy trước afterAll của suite → dọn riêng của suite đăng ký vào đây, chạy trước pool.end
  const cleanups: Array<() => Promise<unknown>> = [];

  const q = <T extends object>(text: string, values: unknown[] = []) =>
    pool.query<T>(text, values);
  const run = (iso: string) =>
    app.get(NotificationScheduler).runHourly(new Date(iso));
  const notes = async (eventId: string) =>
    (
      await q<NoteRow>(
        `SELECT user_sub, topic, params, link, created_at FROM in_app_notifications
         WHERE event_id = $1 AND user_sub LIKE $2 ORDER BY user_sub`,
        [eventId, mine],
      )
    ).rows;
  const recipients = async (eventId: string) =>
    (await notes(eventId)).map((n) => n.user_sub);
  const addUser = (s: string, groups: string[]) =>
    q(
      `INSERT INTO users (sub, full_name, status, groups) VALUES ($1, $1, 'active', $2::jsonb)`,
      [s, JSON.stringify(groups)],
    );
  const periodCol = async <K extends 'headcount' | 'deadline'>(
    ym: string,
    col: K,
  ) =>
    (
      await q<Record<K, unknown>>(
        `SELECT ${col} FROM periods WHERE ym = $1::date`,
        [`${ym}-01`],
      )
    ).rows[0]?.[col];
  const headcount = (ym: string) => periodCol(ym, 'headcount');
  const deadline = async (ym: string) =>
    ((await periodCol(ym, 'deadline')) as Date | undefined)?.toISOString();
  // PUT config xóa cache của app → hiệu lực ngay như Hành chính đổi trên màn Cấu hình
  const setLastDay = (n: number) =>
    request(app.getHttpServer())
      .put('/api/admin/config')
      .set('x-dev-user-sub', sub('admin'))
      .set('x-dev-role', 'admin')
      .send({ registration_last_day: n })
      .expect(200);
  const startApp = async () => {
    app = (await createTestApp()) as INestApplication<App>;
  };
  const restart = async () => {
    await app.close();
    await startApp();
  };

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    saved = await snapshotGlobals(pool);
    adminGroup = (
      await q<{ value: string }>(
        "SELECT value FROM config WHERE key = 'admin_group'",
      )
    ).rows[0].value;
    await isolateCalendar(pool, GROUP);
    process.env.AUTH_DEV_MODE = 'true';
    await startApp();
  });

  afterAll(async () => {
    await app.close();
    for (const fn of cleanups) await fn();
    await q('DELETE FROM in_app_notifications WHERE user_sub LIKE $1', [mine]);
    await q('DELETE FROM requests WHERE user_sub LIKE $1', [mine]);
    await q('DELETE FROM users WHERE sub LIKE $1', [mine]);
    await restoreGlobals(pool, saved);
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  return {
    SUFFIX,
    GROUP,
    sub,
    adminGroup: () => adminGroup,
    http: () => request(app.getHttpServer()),
    q,
    run,
    notes,
    recipients,
    addUser,
    headcount,
    deadline,
    setLastDay,
    restart,
    onCleanup: (fn: () => Promise<unknown>) => cleanups.push(fn),
  };
}
