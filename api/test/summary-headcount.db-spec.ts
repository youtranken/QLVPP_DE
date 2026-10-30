import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { SystemConfigService } from '../src/modules/config/system-config.service';
import { SummaryService } from '../src/modules/requests/summary.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const SUFFIX = `${process.pid}-${Date.now().toString(36)}`;
// Nhóm riêng của suite thay cho Test_VPP để mẫu số không lẫn user của suite khác
const GROUP = `Test_VPP_${SUFFIX}`;
const YM = '2024-03';
const [A, B, C] = ['a', 'b', 'c'].map((n) => `db-hc-${n}-${SUFFIX}`);

describe('mẫu số Tổng hợp loại người thuộc admin_group (Postgres thật)', () => {
  let app: INestApplication;
  let pool: Pool;
  let savedGroups: unknown;

  const summary = () => app.get(SummaryService);
  const setGroups = (sub: string, groups: string[]) =>
    pool.query('UPDATE users SET groups = $2::jsonb WHERE sub = $1', [
      sub,
      JSON.stringify(groups),
    ]);

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    savedGroups = (
      await pool.query(
        "SELECT value FROM config WHERE key = 'authorized_groups'",
      )
    ).rows[0]?.value;
    await pool.query(
      `INSERT INTO config (key, value) VALUES ('authorized_groups', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify([GROUP])],
    );
    for (const [sub, groups] of [
      [A, [GROUP]],
      [B, [GROUP, 'VPP_Admin']],
      [C, ['Nhom_Ngoai']],
    ] as const) {
      await pool.query(
        `INSERT INTO users (sub, full_name, status, groups) VALUES ($1, $1, 'active', $2::jsonb)`,
        [sub, JSON.stringify(groups)],
      );
    }
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await pool.query('DELETE FROM users WHERE sub LIKE $1', [
      `db-hc-%-${SUFFIX}`,
    ]);
    await (savedGroups === undefined
      ? pool.query("DELETE FROM config WHERE key = 'authorized_groups'")
      : pool.query(
          "UPDATE config SET value = $1::jsonb WHERE key = 'authorized_groups'",
          [JSON.stringify(savedGroups)],
        ));
    await pool.end();
  });

  it('liveCounts loại người thuộc admin_group: A thường, B Hành chính, C ngoài nhóm → headcount 1, unregistered chỉ [A]', async () => {
    expect(await app.get(SystemConfigService).getAdminGroup()).toBe(
      'vpp_admin',
    );
    expect(await summary().liveCounts(YM)).toEqual({
      headcount: 1,
      unregistered: 1,
    });
    expect(await summary().unregisteredSubs(YM)).toEqual([A]);
    expect(await summary().audienceSubs()).toEqual([A]);
  });

  it('biên có/không nhóm: B bỏ admin_group (còn Test_VPP) → headcount 2, unregistered [A, B]', async () => {
    await setGroups(B, [GROUP]);
    try {
      expect(await summary().liveCounts(YM)).toEqual({
        headcount: 2,
        unregistered: 2,
      });
      expect(await summary().unregisteredSubs(YM)).toEqual([A, B]);
      expect(await summary().audienceSubs()).toEqual([A, B]);
    } finally {
      await setGroups(B, [GROUP, 'VPP_Admin']);
    }
  });
});
