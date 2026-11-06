import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const SCRIPT = readFileSync(
  join(__dirname, '../../ops/data/2026-11-06-sort-order-from-photos.sql'),
  'utf8',
);
const PHOTO_CODES = [...SCRIPT.matchAll(/\('([A-Z0-9-]+)',(\d+)\)/g)].map(
  (m) => ({ code: m[1], no: Number(m[2]) }),
);

describe('ops: sort_order theo số ảnh (khối DO tự kiểm 50 dòng)', () => {
  let pool: Pool;

  const seed = async (codes: string[]) => {
    await pool.query('DELETE FROM items');
    for (const code of codes) {
      await pool.query(
        `INSERT INTO items (code, name, unit, max_qty, sort_order) VALUES ($1, $1, 'cai', 5, 3)`,
        [code],
      );
    }
  };
  const sorts = async () =>
    new Map(
      (
        await pool.query<{ code: string; sort_order: number }>(
          'SELECT code, sort_order FROM items',
        )
      ).rows.map((r) => [r.code, r.sort_order]),
    );
  const audits = async () =>
    (
      await pool.query<{
        actor: string;
        object_id: string;
        detail: {
          source: string;
          count: number;
          before: { id: string; sort_order: number }[];
        };
      }>(
        "SELECT actor, object_id, detail FROM audit_log WHERE action = 'item.reordered' ORDER BY created_at, id",
      )
    ).rows;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await runMigrations(pool, resolveMigrationsDir(), silent);
  });

  afterAll(async () => {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.end();
  });

  it('bảng mã trong tệp: đúng 50 mã khác nhau, số 1…50', () => {
    expect(new Set(PHOTO_CODES.map((p) => p.code)).size).toBe(50);
    expect(PHOTO_CODES.map((p) => p.no)).toEqual(
      Array.from({ length: 50 }, (_, i) => i + 1),
    );
  });

  it('49 món khớp mã → exception, 0 dòng đổi, 0 audit', async () => {
    await seed(PHOTO_CODES.slice(0, 49).map((p) => p.code));
    await expect(pool.query(SCRIPT)).rejects.toThrow(
      'sort-order: 49 dòng, cần 50',
    );
    expect([...(await sorts()).values()].every((s) => s === 3)).toBe(true);
    expect(await audits()).toHaveLength(0);
  });

  it('đúng 50 món → 50 dòng = số ảnh × 10, 1 audit item.reordered có before 50 phần tử (số cũ)', async () => {
    await seed(PHOTO_CODES.map((p) => p.code));
    await pool.query(SCRIPT);
    const after = await sorts();
    for (const p of PHOTO_CODES) expect(after.get(p.code)).toBe(p.no * 10);
    expect(after.get('CUC-HIT-30MM')).toBe(310);
    const rows = await audits();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actor: 'ops',
      object_id: 'photo-number',
      detail: { source: 'photo-number', count: 50 },
    });
    expect(rows[0].detail.before).toHaveLength(50);
    expect(rows[0].detail.before.every((b) => b.sort_order === 3)).toBe(true);
  });

  it('51 món (thêm 1 mã lạ) → vẫn 50 dòng đổi, món lạ giữ số cũ', async () => {
    const before = (await audits()).length;
    await seed([...PHOTO_CODES.map((p) => p.code), 'MA-LA']);
    await pool.query(SCRIPT);
    const after = await sorts();
    expect(after.get('MA-LA')).toBe(3);
    expect(after.get('T01')).toBe(500);
    const rows = await audits();
    expect(rows).toHaveLength(before + 1);
    expect(rows.at(-1)?.detail.count).toBe(50);
  });
});
