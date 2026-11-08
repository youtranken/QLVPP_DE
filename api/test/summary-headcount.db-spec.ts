import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { LOCAL_SA_SUB } from '../src/modules/auth/local-sa-env';
import { SummaryService } from '../src/modules/requests/summary.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const SUFFIX = `${process.pid}-${Date.now().toString(36)}`;
const YM = '2024-03';
// Kỳ riêng cho phiếu: không suite nào khác tạo phiếu năm 2021
const [BEFORE, REQ_YM, AFTER] = ['2021-03', '2021-04', '2021-05'];
const [A, B, C, D, E] = ['a', 'b', 'c', 'd', 'e'].map(
  (n) => `db-hc-${n}-${SUFFIX}`,
);
const MINE = `db-hc-%-${SUFFIX}`;

// DB test dùng chung với suite khác: đếm phần chênh so với lúc chưa có user của suite này
describe('mẫu số Tổng hợp theo users.role/status (Postgres thật)', () => {
  let app: INestApplication;
  let pool: Pool;
  const base = new Map<string, number>();

  const summary = () => app.get(SummaryService);
  const mine = (subs: string[]) => subs.filter((s) => s.endsWith(SUFFIX));
  const live = async (ym: string) => {
    const { headcount, unregistered } = await summary().people(ym);
    return {
      headcount: headcount - base.get(ym)!,
      unregistered: unregistered - base.get(ym)!,
    };
  };
  const set = (sub: string, col: 'role' | 'status', value: string) =>
    pool.query(`UPDATE users SET ${col} = $2 WHERE sub = $1`, [sub, value]);

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    app = await createTestApp();
    for (const ym of [YM, BEFORE, REQ_YM, AFTER]) {
      const p = await summary().people(ym);
      expect(p.headcount).toBe(p.unregistered);
      base.set(ym, p.headcount);
    }
    for (const [sub, role, status] of [
      [A, 'member', 'active'],
      [B, 'admin', 'active'],
      [C, 'member', 'no_access'],
      [D, 'member', 'locked'],
      [E, 'member', 'deleted'],
    ] as const) {
      await pool.query(
        `INSERT INTO users (sub, full_name, role, status) VALUES ($1, $1, $2, $3)`,
        [sub, role, status],
      );
    }
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
    pool.query('DELETE FROM requests WHERE user_sub LIKE $1', [MINE]),
  );

  afterAll(async () => {
    await app.close();
    await pool.query('DELETE FROM users WHERE sub LIKE $1', [MINE]);
    await pool.query(
      "DELETE FROM periods p WHERE p.ym BETWEEN '2021-03-01' AND '2021-05-01' AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.period_ym = p.ym)",
    );
    await pool.end();
  });

  it('tập sống: A active+member vào; B active+admin, C no_access, D locked, E deleted ra → headcount 1, unregistered chỉ [A]', async () => {
    expect(await live(YM)).toEqual({ headcount: 1, unregistered: 1 });
    expect(mine(await summary().unregisteredSubs(YM))).toEqual([A]);
    expect(mine(await summary().audienceSubs())).toEqual([A]);
  });

  it('biên vai: B admin → member thì vào mẫu số (headcount 2, [A, B]); về admin thì ra', async () => {
    await set(B, 'role', 'member');
    try {
      expect(await live(YM)).toEqual({ headcount: 2, unregistered: 2 });
      expect(mine(await summary().unregisteredSubs(YM))).toEqual([A, B]);
      expect(mine(await summary().audienceSubs())).toEqual([A, B]);
    } finally {
      await set(B, 'role', 'admin');
    }
    expect((await live(YM)).headcount).toBe(1);
  });

  it.each([
    ['C', 'no_access'],
    ['D', 'locked'],
    ['E', 'deleted'],
  ])(
    'biên trạng thái: %s đang %s → về active thì vào mẫu số; trở lại thì ra',
    async (name, status) => {
      const sub = { C, D, E }[name]!;
      await set(sub, 'status', 'active');
      try {
        expect(await live(YM)).toEqual({ headcount: 2, unregistered: 2 });
        expect(mine(await summary().audienceSubs())).toEqual([A, sub].sort());
      } finally {
        await set(sub, 'status', status);
      }
      expect((await live(YM)).headcount).toBe(1);
    },
  );

  it('active+admin mà là A (member → admin) thì ra: headcount 0', async () => {
    await set(A, 'role', 'admin');
    try {
      expect(await live(YM)).toEqual({ headcount: 0, unregistered: 0 });
    } finally {
      await set(A, 'role', 'member');
    }
  });

  describe('mẫu số = người đủ điều kiện ∪ chủ phiếu của kỳ (quyết định 2026-11-01 câu 5)', () => {
    it('chủ phiếu ngoài tập (C đang no_access có phiếu) → vẫn đếm qua owners: headcount 2, unregistered vẫn chỉ [A]', async () => {
      await addRequest(C, REQ_YM);
      expect(await live(REQ_YM)).toEqual({
        headcount: 2,
        unregistered: 1,
      });
      expect(mine(await summary().unregisteredSubs(REQ_YM))).toEqual([A]);
      expect(mine(await summary().audienceSubs())).toEqual([A]);
    });

    it('chủ phiếu thuộc tập (A có phiếu) → không đếm hai lần: headcount 1, unregistered 0', async () => {
      await addRequest(A, REQ_YM);
      expect(await live(REQ_YM)).toEqual({
        headcount: 1,
        unregistered: 0,
      });
      expect(mine(await summary().unregisteredSubs(REQ_YM))).toEqual([]);
    });

    it('A, B (Hành chính) và C cùng có phiếu → headcount 3 = số phiếu; summary registered 3 ≤ headcount 3 (live)', async () => {
      for (const sub of [A, B, C]) await addRequest(sub, REQ_YM);
      expect(await live(REQ_YM)).toEqual({
        headcount: 3,
        unregistered: 0,
      });
      expect(await summary().summary(REQ_YM)).toMatchObject({
        registered: 3,
        headcount: 3 + base.get(REQ_YM)!,
        headcount_source: 'live',
        unregistered: base.get(REQ_YM)!,
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
        headcount: 1 + base.get(REQ_YM)!,
        headcount_source: 'live',
        registered: 1,
        unregistered: base.get(REQ_YM)!,
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
