import { INestApplication } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { ClockService } from '../src/common/clock.service';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
export const BEFORE_DEADLINE = '2026-11-05T03:00:00Z';
export const AFTER_DEADLINE = '2026-11-12T03:00:00Z';

export interface LineView {
  id: string;
  item_id: string | null;
  item: { active: boolean } | null;
  qty: number;
  review_status: string;
  added_by_admin: boolean;
  readonly_for_member: boolean;
  custom_name: string | null;
}
export interface RequestView {
  id: string;
  period_ym: string;
  user_sub: string;
  full_name: string | null;
  department: string | null;
  updated_at: string;
  is_open: boolean;
  lines: LineView[];
}
export type Line = Record<string, unknown>;

// Dựng app + người dùng/kỳ/ảnh chung cho các suite me/request; đăng ký hook jest của suite gọi nó
export function meRequestFixture(tag: string) {
  const SUFFIX = `${tag}-${process.pid}-${Date.now().toString(36)}`;
  const A = `e2e-req-a-${SUFFIX}`;
  const B = `e2e-req-b-${SUFFIX}`;
  const ADMIN = `e2e-req-admin-${SUFFIX}`;
  let app: INestApplication<App>;
  let pool: Pool;
  let dir: string;
  let offsetMs = 0;
  let imgA: string;
  let defaultMax: number;

  const at = (iso: string) => {
    offsetMs = Date.parse(iso) - Date.now();
  };
  const http = () => request(app.getHttpServer());
  const as = (req: request.Test, sub: string, role = 'member') =>
    req.set('x-dev-user-sub', sub).set('x-dev-role', role);
  const upload = async (sub: string, purpose = 'line_image', role = 'member') =>
    (
      (
        await as(http().post('/api/files'), sub, role)
          .field('purpose', purpose)
          .attach('file', PNG_1X1, {
            filename: 'a.png',
            contentType: 'image/png',
          })
          .expect(201)
      ).body as { id: string }
    ).id;
  const newItem = async (
    over: { max_qty?: number; active?: boolean; admin_only?: boolean } = {},
  ) =>
    (
      await pool.query<{ id: string }>(
        `INSERT INTO items (name, unit, max_qty, active, admin_only)
         VALUES ($1, 'cay', $2, $3, $4) RETURNING id`,
        [
          `e2e-req-item-${SUFFIX}-${Math.random().toString(36).slice(2, 8)}`,
          over.max_qty ?? 5,
          over.active ?? true,
          over.admin_only ?? false,
        ],
      )
    ).rows[0].id;
  const put = (body: object, sub = A) =>
    as(http().put('/api/me/request/lines'), sub).send(body);
  const save = (lines: Line[], extra: object = {}, sub = A) =>
    put({ ym: '2026-11', lines, ...extra }, sub);
  const view = (res: request.Response) =>
    (res.body as { request: RequestView }).request;
  const custom = (over: Line = {}): Line => ({
    custom_name: 'Bìa còng đặc biệt',
    custom_unit: 'cai',
    image_file_id: imgA,
    qty: 2,
    ...over,
  });
  const requestsOf = async (sub: string) =>
    (
      await pool.query<{ id: string }>(
        'SELECT id FROM requests WHERE user_sub = $1',
        [sub],
      )
    ).rows;
  const auditOf = async (action: string, objectId: string) =>
    (
      await pool.query<{ detail: Record<string, unknown> }>(
        'SELECT detail FROM audit_log WHERE action = $1 AND object_id = $2 ORDER BY id',
        [action, objectId],
      )
    ).rows.map((r) => r.detail);
  const resetRequests = () =>
    pool.query('DELETE FROM requests WHERE user_sub = ANY($1)', [[A, B]]);

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.query(
      `INSERT INTO users (sub, full_name, department, status) VALUES
         ($1, 'Nhân viên A', 'Phòng CT', 'active'), ($2, 'Nhân viên B', 'Phòng CT', 'active')`,
      [A, B],
    );
    // Kỳ 11/12 có thể đã có từ suite khác → đặt hạn chuẩn (ngày 10) để mốc giờ trong test có nghĩa
    await pool.query(
      `INSERT INTO periods (ym, deadline) VALUES
         ('2026-11-01', '2026-11-10T17:00:00Z'), ('2026-12-01', '2026-12-10T17:00:00Z')
       ON CONFLICT (ym) DO UPDATE SET deadline = EXCLUDED.deadline`,
    );
    defaultMax = Number(
      (
        await pool.query(
          "SELECT value FROM config WHERE key = 'default_max_qty'",
        )
      ).rows[0].value,
    );
    dir = await mkdtemp(join(tmpdir(), 'vpp-req-'));
    process.env.FILES_DIR = dir;
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp(
      [],
      [
        {
          token: ClockService,
          useValue: { now: () => new Date(Date.now() + offsetMs) },
        },
      ],
    )) as INestApplication<App>;
    imgA = await upload(A);
  });

  beforeEach(async () => {
    at(BEFORE_DEADLINE);
    await resetRequests();
  });

  afterAll(async () => {
    await app.close();
    await resetRequests();
    await pool.query('DELETE FROM items WHERE name LIKE $1', [
      `e2e-req-item-${SUFFIX}-%`,
    ]);
    await pool.query('DELETE FROM files WHERE uploaded_by_sub = ANY($1)', [
      [A, B, ADMIN],
    ]);
    await pool.query('DELETE FROM users WHERE sub = ANY($1)', [[A, B]]);
    await pool.end();
    await rm(dir, { recursive: true, force: true });
    delete process.env.FILES_DIR;
    delete process.env.AUTH_DEV_MODE;
  });

  return {
    A,
    B,
    ADMIN,
    at,
    http,
    as,
    upload,
    newItem,
    put,
    save,
    view,
    custom,
    requestsOf,
    auditOf,
    pool: () => pool,
    imgA: () => imgA,
    defaultMax: () => defaultMax,
  };
}
