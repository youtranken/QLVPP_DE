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
const A = `e2e-owed-a-${SUFFIX}`;
const B = `e2e-owed-b-${SUFFIX}`;
const PREFIX = `e2e-owed-${SUFFIX}`;

interface OwedPeriod {
  ym: string;
  items: number;
  units: number;
  lines: { name: string; name_en: string | null; unit: string; qty: number }[];
}
interface SeedLine {
  item_id?: string;
  custom_name?: string;
  qty: number;
  delivered_qty?: number;
  cancelled_qty?: number;
  review_status?: string;
}

describe('GET periods/current — owed[] mọi kỳ khóa còn phần chưa giao', () => {
  let pool: Pool;
  let app: INestApplication<App> | undefined;
  let lastDaySnapshot: unknown;

  async function appAt(iso: string): Promise<INestApplication<App>> {
    await app?.close();
    process.env.CLOCK_OFFSET_MS = String(Date.parse(iso) - Date.now());
    app = (await createTestApp()) as INestApplication<App>;
    return app;
  }

  const owedOf = async (sub = A, role = 'member'): Promise<OwedPeriod[]> => {
    const res = await request(app!.getHttpServer())
      .get('/api/periods/current')
      .set('x-dev-user-sub', sub)
      .set('x-dev-role', role)
      .expect(200);
    return (res.body as { owed: OwedPeriod[] }).owed;
  };

  const newItem = async (name: string, unit: string, nameEn?: string) =>
    (
      await pool.query<{ id: string }>(
        'INSERT INTO items (name, name_en, unit) VALUES ($1, $2, $3) RETURNING id',
        [`${PREFIX} ${name}`, nameEn ?? null, unit],
      )
    ).rows[0].id;

  const seed = async (sub: string, ym: string, lines: SeedLine[]) => {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub)
       VALUES ($1::date, $2, $2) RETURNING id`,
      [`${ym}-01`, sub],
    );
    for (const l of lines) {
      await pool.query(
        `INSERT INTO request_lines (request_id, item_id, custom_name, custom_unit, qty,
                                    delivered_qty, cancelled_qty, review_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          rows[0].id,
          l.item_id ?? null,
          l.custom_name ?? null,
          l.custom_name ? 'cai' : null,
          l.qty,
          l.delivered_qty ?? 0,
          l.cancelled_qty ?? 0,
          l.review_status ?? (l.item_id ? 'n/a' : 'pending'),
        ],
      );
    }
  };

  async function cleanup(): Promise<void> {
    await pool.query('DELETE FROM requests WHERE user_sub = ANY($1)', [[A, B]]);
    await pool.query('DELETE FROM items WHERE name LIKE $1', [`${PREFIX}%`]);
    await pool.query(`
      DELETE FROM periods p WHERE p.ym >= '2026-12-01'
        AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.period_ym = p.ym)`);
  }

  const setLastDay = (n: unknown) =>
    pool.query(
      "UPDATE config SET value = $1 WHERE key = 'registration_last_day'",
      [JSON.stringify(n)],
    );

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    lastDaySnapshot = (
      await pool.query(
        "SELECT value FROM config WHERE key = 'registration_last_day'",
      )
    ).rows[0].value;
    await pool.query('INSERT INTO users (sub) VALUES ($1), ($2)', [A, B]);
    process.env.AUTH_DEV_MODE = 'true';
  });

  beforeEach(async () => {
    await cleanup();
    await setLastDay(10);
    // Hạn chuẩn ngày 10: kỳ 11, 12 đã khóa; kỳ 2027-01 khóa 00:00 ngày 11/01 giờ VN
    await pool.query(`
      INSERT INTO periods (ym, deadline) VALUES
        ('2026-11-01', '2026-11-10T17:00:00Z'), ('2026-12-01', '2026-12-10T17:00:00Z'),
        ('2027-01-01', '2027-01-10T17:00:00Z')
      ON CONFLICT (ym) DO UPDATE SET deadline = EXCLUDED.deadline`);
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    delete process.env.CLOCK_OFFSET_MS;
  });

  afterAll(async () => {
    await cleanup();
    await pool.query('DELETE FROM users WHERE sub = ANY($1)', [[A, B]]);
    await setLastDay(lastDaySnapshot);
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('A còn 2 Bút bi tháng 11 + 2 món tháng 12 → owed 2 kỳ theo tháng; bỏ phần đã giao/đã hủy, dòng chờ xem/từ chối', async () => {
    const pen = await newItem('Bút bi', 'cay', 'Ballpoint pen');
    const tape = await newItem('Băng keo', 'cuon');
    const glue = await newItem('Keo dán', 'chai');
    await seed(A, '2026-11', [
      { item_id: pen, qty: 5, delivered_qty: 2, cancelled_qty: 1 },
      { item_id: glue, qty: 3, delivered_qty: 2, cancelled_qty: 1 },
      { custom_name: 'Bìa lạ', qty: 2, review_status: 'rejected' },
    ]);
    await seed(A, '2026-12', [
      { item_id: tape, qty: 2, delivered_qty: 1 },
      { custom_name: 'Bìa còng', qty: 3, review_status: 'accepted' },
      { custom_name: 'Ghim chờ', qty: 1, review_status: 'pending' },
      { item_id: pen, qty: 4, cancelled_qty: 4 },
    ]);
    await seed(B, '2026-12', [{ item_id: pen, qty: 9 }]);

    await appAt('2027-01-15T03:00:00Z');
    expect(await owedOf()).toEqual([
      {
        ym: '2026-11',
        items: 1,
        units: 2,
        lines: [
          {
            name: `${PREFIX} Bút bi`,
            name_en: 'Ballpoint pen',
            unit: 'cay',
            qty: 2,
          },
        ],
      },
      {
        ym: '2026-12',
        items: 2,
        units: 4,
        lines: expect.arrayContaining([
          { name: `${PREFIX} Băng keo`, name_en: null, unit: 'cuon', qty: 1 },
          { name: 'Bìa còng', name_en: null, unit: 'cai', qty: 3 },
        ]) as unknown,
      },
    ]);
  });

  it('giao/hủy đủ hết → owed []; người không có phiếu → []', async () => {
    const pen = await newItem('Bút bi', 'cay');
    await seed(A, '2026-11', [
      { item_id: pen, qty: 3, delivered_qty: 2, cancelled_qty: 1 },
    ]);
    await appAt('2027-01-15T03:00:00Z');
    expect(await owedOf()).toEqual([]);
    expect(await owedOf(B)).toEqual([]);
  });

  it('kỳ đang mở không vào owed: 23:59:30 ngày 10/01 VN kỳ 2027-01 còn mở → chỉ kỳ 12; sau 00:00 ngày 11/01 → thêm kỳ 2027-01', async () => {
    const pen = await newItem('Bút bi', 'cay');
    await seed(A, '2026-12', [{ item_id: pen, qty: 1 }]);
    await seed(A, '2027-01', [{ item_id: pen, qty: 2 }]);

    await appAt('2027-01-10T16:59:30Z');
    expect((await owedOf()).map((p) => p.ym)).toEqual(['2026-12']);

    await appAt('2027-01-10T17:00:00Z');
    expect((await owedOf()).map((p) => [p.ym, p.units])).toEqual([
      ['2026-12', 1],
      ['2027-01', 2],
    ]);
  });

  it.each(['admin', 'sa'])(
    'vai %s → owed [] (không tra phiếu của người gọi)',
    async (role) => {
      const pen = await newItem('Bút bi', 'cay');
      await seed(A, '2026-11', [{ item_id: pen, qty: 2 }]);
      await appAt('2027-01-15T03:00:00Z');
      expect(await owedOf(A, 'member')).toHaveLength(1);
      expect(await owedOf(A, role)).toEqual([]);
    },
  );
});
