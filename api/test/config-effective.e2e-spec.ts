import { INestApplication } from '@nestjs/common';
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
const ADMIN = `e2e-config-effective-${process.pid}-${Date.now().toString(36)}`;

describe('PUT admin/config: đổi ngày cuối đăng ký ghi kỳ áp dụng (effective_from_ym)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let frozen = new Date('2027-01-05T03:00:00Z');
  let saved: unknown;

  const as = (req: request.Test) =>
    req.set('x-dev-user-sub', ADMIN).set('x-dev-role', 'admin');
  const put = (body: object) =>
    as(request(app.getHttpServer()).put('/api/admin/config'))
      .send(body)
      .expect(200);
  const lastAudit = async () =>
    (
      await pool.query<{ detail: Record<string, unknown> }>(
        "SELECT detail FROM audit_log WHERE action = 'config.updated' AND actor = $1 ORDER BY created_at DESC, id DESC LIMIT 1",
        [ADMIN],
      )
    ).rows[0].detail;
  const current = async () =>
    (
      await as(request(app.getHttpServer()).get('/api/periods/current')).expect(
        200,
      )
    ).body as { ym: string; deadline: string };
  const setLastDay = (n: number) =>
    pool.query(
      "UPDATE config SET value = $1 WHERE key = 'registration_last_day'",
      [JSON.stringify(n)],
    );
  // Kỳ 01/2027 hạn chuẩn (ngày 10); kỳ sau chưa có phiếu thì xóa để được tạo theo cấu hình mới
  const resetPeriods = async () => {
    await pool.query(`
      DELETE FROM periods p WHERE p.ym >= '2027-02-01'
        AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.period_ym = p.ym)`);
    await pool.query(
      `INSERT INTO periods (ym, deadline) VALUES ('2027-01-01', '2027-01-10T17:00:00Z')
       ON CONFLICT (ym) DO UPDATE SET deadline = EXCLUDED.deadline`,
    );
  };

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    saved = (
      await pool.query(
        "SELECT value FROM config WHERE key = 'registration_last_day'",
      )
    ).rows[0].value;
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp(
      [],
      [{ token: ClockService, useValue: { now: () => frozen } }],
    )) as INestApplication<App>;
  });

  beforeEach(async () => {
    await setLastDay(10);
    await resetPeriods();
  });

  afterAll(async () => {
    await app.close();
    await setLastDay(saved as number);
    await resetPeriods();
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('kỳ mở 01, hạn 10 → 8: audit có effective_from_ym 2027-02; kỳ 01 vẫn khóa 00:00 ngày 11/01; kỳ 02 khóa 00:00 ngày 09/02', async () => {
    frozen = new Date('2027-01-05T03:00:00Z');
    await put({ registration_last_day: 8 });
    expect(await lastAudit()).toEqual({
      before: { registration_last_day: 10 },
      after: { registration_last_day: 8 },
      effective_from_ym: '2027-02',
    });
    expect(await current()).toMatchObject({
      ym: '2027-01',
      deadline: '2027-01-10T17:00:00.000Z',
    });
    frozen = new Date('2027-01-10T17:00:00.000Z');
    expect(await current()).toMatchObject({
      ym: '2027-02',
      deadline: '2027-02-08T17:00:00.000Z',
    });
  });

  it.each([
    ['2027-01-10T16:59:59.999Z', '2027-02'],
    ['2027-01-10T17:00:00.000Z', '2027-03'],
  ])('biên khóa kỳ 01: lưu lúc %s → effective_from_ym %s', async (at, ym) => {
    frozen = new Date(at);
    await put({ registration_last_day: 9 });
    expect((await lastAudit()).effective_from_ym).toBe(ym);
  });

  it('kỳ mở chưa có dòng periods: đổi hạn vẫn giữ kỳ mở theo hạn cũ (kỳ được tạo trước khi ghi cấu hình)', async () => {
    frozen = new Date('2027-02-03T03:00:00Z');
    await put({ registration_last_day: 5 });
    expect((await lastAudit()).effective_from_ym).toBe('2027-03');
    expect(await current()).toMatchObject({
      ym: '2027-02',
      deadline: '2027-02-10T17:00:00.000Z',
    });
  });

  it('đổi khóa không thuộc hạn kỳ (liên hệ) → audit không có effective_from_ym', async () => {
    const contact = (
      await pool.query("SELECT value FROM config WHERE key = 'admin_contact'")
    ).rows[0]?.value as string | undefined;
    await put({ admin_contact: `e2e ${ADMIN}` });
    expect(await lastAudit()).not.toHaveProperty('effective_from_ym');
    await put({ admin_contact: contact ?? '' });
  });
});
