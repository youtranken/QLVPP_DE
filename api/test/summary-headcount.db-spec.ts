import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { LOCAL_SA_SUB } from '../src/modules/auth/local-sa-env';
import { SystemConfigService } from '../src/modules/config/system-config.service';
import { SummaryService } from '../src/modules/requests/summary.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const SUFFIX = `${process.pid}-${Date.now().toString(36)}`;
// Nhóm riêng của suite thay cho Test_VPP để mẫu số không lẫn user của suite khác
const GROUP = `Test_VPP_${SUFFIX}`;
const YM = '2024-03';
// Kỳ riêng cho phiếu: không suite nào khác tạo phiếu năm 2021
const [BEFORE, REQ_YM, AFTER] = ['2021-03', '2021-04', '2021-05'];
const [A, B, C] = ['a', 'b', 'c'].map((n) => `db-hc-${n}-${SUFFIX}`);

describe('mẫu số Tổng hợp loại người thuộc admin_group (Postgres thật)', () => {
  let app: INestApplication;
  let pool: Pool;
  let savedGroups: unknown;

  const summary = () => app.get(SummaryService);
  const live = async (ym: string) => {
    const { headcount, unregistered } = await summary().people(ym);
    return { headcount, unregistered };
  };
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

  const addRequest = async (sub: string, ym: string) => {
    await pool.query(
      `INSERT INTO periods (ym, deadline) VALUES ($1::date, $1::date + interval '9 days')
       ON CONFLICT DO NOTHING`,
      [`${ym}-01`],
    );
    await pool.query(
      'INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ($1::date, $2, $3)',
      [`${ym}-01`, sub, B],
    );
  };

  afterEach(() =>
    pool.query('DELETE FROM requests WHERE user_sub LIKE $1', [
      `db-hc-%-${SUFFIX}`,
    ]),
  );

  afterAll(async () => {
    await app.close();
    await pool.query('DELETE FROM users WHERE sub LIKE $1', [
      `db-hc-%-${SUFFIX}`,
    ]);
    await pool.query(
      "DELETE FROM periods p WHERE p.ym BETWEEN '2021-03-01' AND '2021-05-01' AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.period_ym = p.ym)",
    );
    await (savedGroups === undefined
      ? pool.query("DELETE FROM config WHERE key = 'authorized_groups'")
      : pool.query(
          "UPDATE config SET value = $1::jsonb WHERE key = 'authorized_groups'",
          [JSON.stringify(savedGroups)],
        ));
    await pool.end();
  });

  it('tập sống loại người thuộc admin_group: A thường, B Hành chính, C ngoài nhóm → headcount 1, unregistered chỉ [A]', async () => {
    expect(await app.get(SystemConfigService).getAdminGroup()).toBe(
      'vpp_admin',
    );
    expect(await live(YM)).toEqual({
      headcount: 1,
      unregistered: 1,
    });
    expect(await summary().unregisteredSubs(YM)).toEqual([A]);
    expect(await summary().audienceSubs()).toEqual([A]);
  });

  it('biên có/không nhóm: B bỏ admin_group (còn Test_VPP) → headcount 2, unregistered [A, B]', async () => {
    await setGroups(B, [GROUP]);
    try {
      expect(await live(YM)).toEqual({
        headcount: 2,
        unregistered: 2,
      });
      expect(await summary().unregisteredSubs(YM)).toEqual([A, B]);
      expect(await summary().audienceSubs()).toEqual([A, B]);
    } finally {
      await setGroups(B, [GROUP, 'VPP_Admin']);
    }
  });

  describe('mẫu số = người đủ điều kiện ∪ chủ phiếu của kỳ (quyết định 2026-11-01 câu 5)', () => {
    it('chủ phiếu ngoài tập (C ngoài nhóm, chủ phiếu ngoài tập) → đếm một lần: headcount 2, unregistered vẫn chỉ [A]', async () => {
      await addRequest(C, REQ_YM);
      expect(await live(REQ_YM)).toEqual({
        headcount: 2,
        unregistered: 1,
      });
      expect(await summary().unregisteredSubs(REQ_YM)).toEqual([A]);
      expect(await summary().audienceSubs()).toEqual([A]);
    });

    it('chủ phiếu thuộc tập (A có phiếu) → không đếm hai lần: headcount 1, unregistered 0', async () => {
      await addRequest(A, REQ_YM);
      expect(await live(REQ_YM)).toEqual({
        headcount: 1,
        unregistered: 0,
      });
      expect(await summary().unregisteredSubs(REQ_YM)).toEqual([]);
    });

    it('A, B (Hành chính) và C cùng có phiếu → headcount 3 = số phiếu; summary registered 3 ≤ headcount 3 (live)', async () => {
      for (const sub of [A, B, C]) await addRequest(sub, REQ_YM);
      expect(await live(REQ_YM)).toEqual({
        headcount: 3,
        unregistered: 0,
      });
      expect(await summary().summary(REQ_YM)).toMatchObject({
        registered: 3,
        headcount: 3,
        headcount_source: 'live',
        unregistered: 0,
      });
    });

    it('phiếu của SA cục bộ (dữ liệu lạ) không vào mẫu số: SA có phiếu → headcount 1; A có phiếu → vẫn 1', async () => {
      const seeded =
        (
          await pool.query(
            `INSERT INTO users (sub, full_name, status) VALUES ($1, 'SA', 'active') ON CONFLICT (sub) DO NOTHING`,
            [LOCAL_SA_SUB],
          )
        ).rowCount === 1;
      try {
        await addRequest(LOCAL_SA_SUB, REQ_YM);
        expect((await live(REQ_YM)).headcount).toBe(1);
        await addRequest(A, REQ_YM);
        expect((await live(REQ_YM)).headcount).toBe(1);
      } finally {
        await pool.query(
          'DELETE FROM requests WHERE user_sub = $1 AND created_by_sub = $2',
          [LOCAL_SA_SUB, B],
        );
        if (seeded)
          await pool.query('DELETE FROM users WHERE sub = $1', [LOCAL_SA_SUB]);
      }
    });

    it('phiếu kỳ khác không tính: C có phiếu kỳ trước và kỳ sau → kỳ giữa headcount 1; chính kỳ đó headcount 2', async () => {
      await addRequest(C, BEFORE);
      await addRequest(C, AFTER);
      expect((await live(REQ_YM)).headcount).toBe(1);
      expect((await live(BEFORE)).headcount).toBe(2);
      expect((await live(AFTER)).headcount).toBe(2);
    });
  });

  it('kỳ khóa trước 0116 (headcount 7 đã ghi, headcount_subs NULL) → tập sống, nguồn live (R-D8.17): headcount 1 = registered 1 + unregistered 0, không trả số 7 đóng băng', async () => {
    await addRequest(A, REQ_YM);
    await pool.query(
      'UPDATE periods SET headcount = 7, headcount_subs = NULL WHERE ym = $1::date',
      [`${REQ_YM}-01`],
    );
    try {
      const people = await summary().people(REQ_YM);
      expect(people).toEqual({
        headcount: 1,
        headcount_source: 'live',
        registered: 1,
        unregistered: 0,
        outside: 0,
      });
      expect(people.registered + people.unregistered).toBe(people.headcount);
    } finally {
      await pool.query(
        'UPDATE periods SET headcount = NULL WHERE ym = $1::date',
        [`${REQ_YM}-01`],
      );
    }
  });
});
