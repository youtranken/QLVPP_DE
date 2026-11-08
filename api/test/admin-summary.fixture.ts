import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { ClockService } from '../src/common/clock.service';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { LOCAL_SA_SUB } from '../src/modules/auth/local-sa-env';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
export const NOW = '2026-11-05T03:00:00Z';
const OPEN_PERIOD = '2026-11-01';

// Dựng app + dữ liệu cho tổng hợp ở một kỳ quá khứ riêng của suite; đăng ký hook jest của suite gọi nó
export function adminSummaryFixture(ym: string) {
  const SUFFIX = `${process.pid}-${Date.now().toString(36)}`;
  const sub = (n: string) => `e2e-sum-${n}-${SUFFIX}`;
  const [U1, U2, U3, LOCKED, OUTSIDER] = [
    'u1',
    'u2',
    'u3',
    'locked',
    'out',
  ].map(sub);
  const ADMIN = sub('admin');
  const ymDate = `${ym}-01`;
  const ids = { item: '', img: '', r1: '', r2: '' };
  let app: INestApplication<App>;
  let pool: Pool;
  // DB test dùng chung: người active+member của suite khác cũng vào tập sống; test so phần chênh
  let others = 0;
  let savedOpen: { deadline: Date; headcount: number | null } | undefined;

  const http = () => request(app.getHttpServer());
  const asAdmin = (path: string, role = 'admin') =>
    http()
      .get(`/api/admin${path}`)
      .set('x-dev-user-sub', ADMIN)
      .set('x-dev-role', role);
  const addLine = (requestId: string, cols: Record<string, unknown>) => {
    const keys = Object.keys(cols);
    return pool.query(
      `INSERT INTO request_lines (request_id, ${keys.join(', ')})
       VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')})`,
      [requestId, ...Object.values(cols)],
    );
  };
  const newRequest = async (owner: string, dept: string | null) =>
    (
      await pool.query<{ id: string }>(
        `INSERT INTO requests (period_ym, user_sub, department, created_by_sub)
         VALUES ($1::date, $2, $3, $2) RETURNING id`,
        [ymDate, owner, dept],
      )
    ).rows[0].id;
  const custom = (name: string, status: string, unit = 'cai') => ({
    custom_name: name,
    custom_unit: unit,
    image_file_id: ids.img,
    review_status: status,
  });
  const addUser = (
    s: string,
    name: string,
    email: string | null,
    dept: string | null,
  ) =>
    pool.query(
      `INSERT INTO users (sub, full_name, email, department, status, role)
       VALUES ($1, $2, $3, $4, 'active', 'member')`,
      [s, name, email, dept],
    );

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    others = (
      await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM users
         WHERE status = 'active' AND role <> 'admin' AND sub <> $1`,
        [LOCAL_SA_SUB],
      )
    ).rows[0].n;
    savedOpen = (
      await pool.query(
        'SELECT deadline, headcount FROM periods WHERE ym = $1',
        [OPEN_PERIOD],
      )
    ).rows[0];
    await addUser(U1, `Bình ${SUFFIX}`, `binh.${SUFFIX}@pmh.test`, 'Phòng B');
    await addUser(U2, `An ${SUFFIX}`, `an_${SUFFIX}@pmh.test`, null);
    await addUser(U3, `Chi ${SUFFIX}`, `chi.${SUFFIX}@pmh.test`, 'Phòng A');
    await addUser(LOCKED, `Dũng ${SUFFIX}`, null, 'Phòng A');
    await addUser(OUTSIDER, `Em ${SUFFIX}`, null, 'Phòng A');
    await pool.query("UPDATE users SET status = 'locked' WHERE sub = $1", [
      LOCKED,
    ]);
    // Mất quyền vào VPP (PMH ID gỡ app) → ngoài tập sống
    await pool.query("UPDATE users SET status = 'no_access' WHERE sub = $1", [
      OUTSIDER,
    ]);
    await pool.query(
      `INSERT INTO periods (ym, deadline) VALUES
         ($1::date, ($1::date + interval '9 days 17 hours') AT TIME ZONE 'UTC'),
         ($2::date, '2026-11-10T17:00:00Z')
       ON CONFLICT (ym) DO UPDATE SET deadline = EXCLUDED.deadline, headcount = NULL`,
      [ymDate, OPEN_PERIOD],
    );
    ids.item = (
      await pool.query<{ id: string }>(
        `INSERT INTO items (name, unit, max_qty) VALUES ($1, 'cay', 5) RETURNING id`,
        [`e2e-sum-item-${SUFFIX}`],
      )
    ).rows[0].id;
    ids.img = (
      await pool.query<{ id: string }>(
        `INSERT INTO files (original_name, mime, size_bytes, purpose, uploaded_by_sub)
         VALUES ('a.png', 'image/png', 1, 'line_image', $1) RETURNING id`,
        [U1],
      )
    ).rows[0].id;
    ids.r1 = await newRequest(U1, 'Phòng B');
    await addLine(ids.r1, { item_id: ids.item, qty: 3, delivered_qty: 3 });
    // Hủy nợ hết phần còn lại → không còn chờ giao
    await addLine(ids.r1, {
      ...custom('Bìa còng X', 'accepted'),
      qty: 2,
      cancelled_qty: 2,
    });
    await addLine(ids.r1, { ...custom('Giấy lạ', 'pending'), qty: 1 });
    ids.r2 = await newRequest(U2, null);
    await addLine(ids.r2, { item_id: ids.item, qty: 2 });
    await addLine(ids.r2, {
      ...custom('  bìa CÒNG x ', 'accepted', 'cai'),
      qty: 4,
    });
    await addLine(ids.r2, { ...custom('Rác', 'rejected'), qty: 1 });
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp(
      [],
      [{ token: ClockService, useValue: { now: () => new Date(NOW) } }],
    )) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    const mine = `e2e-sum-%-${SUFFIX}`;
    await pool.query('DELETE FROM requests WHERE user_sub LIKE $1', [mine]);
    await pool.query('DELETE FROM periods WHERE ym = $1', [ymDate]);
    await pool.query('DELETE FROM files WHERE id = $1', [ids.img]);
    await pool.query('DELETE FROM items WHERE id = $1', [ids.item]);
    await pool.query('DELETE FROM users WHERE sub LIKE $1', [mine]);
    await (savedOpen
      ? pool.query(
          'UPDATE periods SET deadline = $2, headcount = $3 WHERE ym = $1',
          [OPEN_PERIOD, savedOpen.deadline, savedOpen.headcount],
        )
      : pool.query(
          'DELETE FROM periods p WHERE ym = $1 AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.period_ym = p.ym)',
          [OPEN_PERIOD],
        ));
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  return {
    SUFFIX,
    U1,
    U2,
    U3,
    LOCKED,
    OUTSIDER,
    sub,
    ids,
    asAdmin,
    addLine,
    newRequest,
    addUser,
    others: () => others,
    mine: (subs: string[]) => subs.filter((x) => x.endsWith(SUFFIX)),
    pool: () => pool,
  };
}
