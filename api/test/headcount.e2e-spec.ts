import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { DRIZZLE_DB } from '../src/database/database.module';
import type { Database } from '../src/database/database.module';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { LOCAL_SA_SUB } from '../src/modules/auth/local-sa-env';
import { PeriodsService } from '../src/modules/periods/periods.service';
import { SummaryService } from '../src/modules/requests/summary.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const SUFFIX = `${process.pid}-${Date.now().toString(36)}`;
const sub = (n: string) => `e2e-hc-${n}-${SUFFIX}`;
// Kỳ quá khứ riêng: không suite nào khác có phiếu năm 2004
const YMS = ['2004-01', '2004-02', '2004-03', '2004-04', '2004-05', '2004-06'];

interface Summary {
  registered: number;
  headcount: number;
  unregistered: number;
  outside: number;
  headcount_source: string;
}

describe('Tổng hợp đếm từ một tập người S (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  // DB test dùng chung: người active+member của suite khác cũng vào S; so phần chênh
  let others = 0;
  let seededSa = false;
  const S8 = ['1', '2', '3', '4', '5', '6', '7', '8'].map((n) => sub(`s${n}`));
  const [O1, O2] = [sub('o1'), sub('o2')];

  const q = (text: string, values: unknown[] = []) => pool.query(text, values);
  const addPeriod = (ym: string) =>
    q(
      `INSERT INTO periods (ym, deadline) VALUES ($1::date, $1::date + interval '9 days 17 hours') ON CONFLICT (ym) DO NOTHING`,
      [`${ym}-01`],
    );
  const addRequest = (owner: string, ym: string) =>
    q(
      'INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ($1::date, $2, $2)',
      [`${ym}-01`, owner],
    );
  const lockNow = (ym: string) =>
    app
      .get<Database>(DRIZZLE_DB)
      .transaction(async (tx) =>
        app
          .get(PeriodsService)
          .recordHeadcount(ym, await app.get(SummaryService).liveSubs(ym), tx),
      );
  const get = async (path: string) =>
    (
      await request(app.getHttpServer())
        .get(`/api/admin/periods/${path}`)
        .set('x-dev-user-sub', sub('admin'))
        .set('x-dev-role', 'admin')
        .expect(200)
    ).body as Summary & { items: unknown[] };

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    others = (
      await q(
        `SELECT count(*)::int AS n FROM users
         WHERE status = 'active' AND role <> 'admin' AND sub <> $1`,
        [LOCAL_SA_SUB],
      )
    ).rows[0].n as number;
    for (const s of S8)
      await q(
        `INSERT INTO users (sub, full_name, status, role) VALUES ($1, $1, 'active', 'member')`,
        [s],
      );
    // Ngoài S: người đã mất quyền vào VPP vẫn có thể là chủ phiếu của kỳ
    for (const s of [O1, O2])
      await q(
        `INSERT INTO users (sub, full_name, status, role) VALUES ($1, $1, 'no_access', 'member')`,
        [s],
      );
    seededSa =
      (
        await q(
          `INSERT INTO users (sub, full_name, status) VALUES ($1, 'SA', 'active') ON CONFLICT (sub) DO NOTHING`,
          [LOCAL_SA_SUB],
        )
      ).rowCount === 1;
    for (const ym of YMS) await addPeriod(ym);
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    await q('DELETE FROM requests WHERE period_ym = ANY($1::date[])', [
      YMS.map((y) => `${y}-01`),
    ]);
    await q('DELETE FROM periods WHERE ym = ANY($1::date[])', [
      YMS.map((y) => `${y}-01`),
    ]);
    await q('DELETE FROM users WHERE sub LIKE $1', [`e2e-hc-%-${SUFFIX}`]);
    if (seededSa) await q('DELETE FROM users WHERE sub = $1', [LOCAL_SA_SUB]);
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('V2D-2 10/8 reproduced: S lúc khóa 8 người (6 có phiếu), sau khóa thêm 2 phiếu ngoài S + 1 phiếu SA cục bộ → 6/8, chưa đăng ký 2, ngoài danh sách 2', async () => {
    for (const s of S8.slice(0, 6)) await addRequest(s, '2004-06');
    await lockNow('2004-06');
    await addRequest(O1, '2004-06');
    await addRequest(O2, '2004-06');
    await addRequest(LOCAL_SA_SUB, '2004-06');
    expect(await get('2004-06/summary')).toMatchObject({
      registered: 6,
      headcount: 8 + others,
      unregistered: 2 + others,
      outside: 2,
      headcount_source: 'snapshot',
    });
    const list = (await get('2004-06/unregistered')).items as { sub: string }[];
    expect(
      list
        .map((u) => u.sub)
        .filter((x) => x.endsWith(SUFFIX))
        .sort(),
    ).toEqual(S8.slice(6).sort());
  });

  // Mỗi fixture dựng một kỳ khác nhau: có/không chụp S, 0 phiếu, đủ phiếu, người trong S nghỉ sau khóa
  const fixtures: Array<[string, string, () => Promise<unknown>]> = [
    [
      'kỳ chưa chụp S (live), có chủ phiếu ngoài S (no_access)',
      '2004-01',
      async () => {
        await addRequest(S8[0], '2004-01');
        await addRequest(O1, '2004-01');
      },
    ],
    ['chụp S, 0 phiếu', '2004-02', () => lockNow('2004-02')],
    [
      'chụp S, mọi người đã đăng ký + SA cục bộ',
      '2004-03',
      async () => {
        for (const s of S8) await addRequest(s, '2004-03');
        await addRequest(LOCAL_SA_SUB, '2004-03');
        await lockNow('2004-03');
      },
    ],
    [
      'chụp S có chủ phiếu ngoài S, sau khóa thêm phiếu ngoài S',
      '2004-04',
      async () => {
        await addRequest(O1, '2004-04');
        await lockNow('2004-04');
        await addRequest(O2, '2004-04');
        await addRequest(S8[1], '2004-04');
      },
    ],
    [
      'chụp S rồi một người trong S bị khóa',
      '2004-05',
      async () => {
        await addRequest(S8[2], '2004-05');
        await lockNow('2004-05');
        await q(`UPDATE users SET status = 'locked' WHERE sub = $1`, [S8[3]]);
      },
    ],
  ];

  it('bất biến registered + unregistered = headcount, registered ≤ headcount, danh sách chưa đăng ký = unregistered trên 5 fixture', async () => {
    try {
      for (const [, , seed] of fixtures) await seed();
      for (const [name, ym] of fixtures) {
        const s = await get(`${ym}/summary`);
        const list = (await get(`${ym}/unregistered`)).items;
        expect({
          name,
          sum: s.registered + s.unregistered,
          le: s.registered <= s.headcount,
          list: list.length,
        }).toEqual({
          name,
          sum: s.headcount,
          le: true,
          list: s.unregistered,
        });
      }
    } finally {
      await q(`UPDATE users SET status = 'active' WHERE sub = $1`, [S8[3]]);
    }
  });

  it('kỳ chưa chụp S → headcount_source live; kỳ đã chụp → snapshot, giữ người nghỉ sau khóa trong mẫu số', async () => {
    expect((await get('2004-01/summary')).headcount_source).toBe('live');
    expect(await get('2004-05/summary')).toMatchObject({
      headcount_source: 'snapshot',
      headcount: 8 + others,
      registered: 1,
      unregistered: 7 + others,
    });
  });
});
