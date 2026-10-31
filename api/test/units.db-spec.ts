import { Pool } from 'pg';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };

describe('0111 units — bảng ĐVT, FK items.unit / request_lines.custom_unit', () => {
  let pool: Pool;
  let reqId: string;

  async function code(sql: string, params: unknown[] = []): Promise<string> {
    try {
      await pool.query(sql, params);
    } catch (e) {
      return (e as { code: string }).code;
    }
    return 'OK';
  }

  const insertUnit = (
    code_: string,
    name: string,
    nameEn: string | null = null,
  ) =>
    code('INSERT INTO units (code, name, name_en) VALUES ($1, $2, $3)', [
      code_,
      name,
      nameEn,
    ]);

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.query("INSERT INTO users (sub) VALUES ('u-units')");
    await pool.query(
      "INSERT INTO periods (ym, deadline) VALUES ('2026-11-01', '2026-11-11T00:00:00+07')",
    );
    reqId = (
      await pool.query<{ id: string }>(
        `INSERT INTO requests (period_ym, user_sub, created_by_sub)
         VALUES ('2026-11-01', 'u-units', 'u-units') RETURNING id`,
      )
    ).rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('seed đủ 9 mã với nhãn vi/en cũ, theo thứ tự cũ, đều active', async () => {
    const { rows } = await pool.query(
      'SELECT code, name, name_en, active FROM units ORDER BY sort_order, name',
    );
    expect(rows).toEqual(
      [
        ['cai', 'cái', 'piece'],
        ['hop', 'hộp', 'box'],
        ['cay', 'cây', 'stick'],
        ['ram', 'ram', 'ream'],
        ['cuon', 'cuộn', 'roll'],
        ['loc', 'lốc', 'pack'],
        ['bich', 'bịch', 'bag'],
        ['chai', 'chai', 'bottle'],
        ['bo', 'bộ', 'set'],
      ].map(([c, name, name_en]) => ({ code: c, name, name_en, active: true })),
    );
  });

  it('items.unit không có trong units → 23503; ĐVT mới thêm thì dùng được (CHECK 9 mã cũ đã bỏ)', async () => {
    expect(
      await code("INSERT INTO items (name, unit) VALUES ('x', 'thung')"),
    ).toBe('23503');
    expect(await insertUnit('thung', 'thùng')).toBe('OK');
    expect(
      await code("INSERT INTO items (name, unit) VALUES ('x', 'thung')"),
    ).toBe('OK');
  });

  it('request_lines.custom_unit không có trong units → 23503', async () => {
    expect(
      await code(
        `INSERT INTO request_lines (request_id, custom_name, custom_unit, qty, review_status)
         VALUES ($1, 'Món lạ', 'kg', 1, 'pending')`,
        [reqId],
      ),
    ).toBe('23503');
  });

  it('DELETE ĐVT đang dùng (món hoặc dòng phiếu) bị RESTRICT chặn; đổi code đang dùng cũng bị chặn; ĐVT chưa dùng xóa được', async () => {
    await insertUnit('goi-db', 'gói db');
    await insertUnit('xap-db', 'xấp db');
    await insertUnit('to-db', 'tờ db');
    await pool.query("INSERT INTO items (name, unit) VALUES ('y', 'goi-db')");
    await pool.query(
      `INSERT INTO request_lines (request_id, custom_name, custom_unit, qty, review_status)
       VALUES ($1, 'Món xấp', 'xap-db', 1, 'pending')`,
      [reqId],
    );
    expect(await code("DELETE FROM units WHERE code = 'goi-db'")).toBe('23001');
    expect(await code("DELETE FROM units WHERE code = 'xap-db'")).toBe('23001');
    expect(
      await code("UPDATE units SET code = 'goi-2' WHERE code = 'goi-db'"),
    ).toBe('23001');
    expect(await code("DELETE FROM units WHERE code = 'to-db'")).toBe('OK');
  });

  it('UNIQUE lower(name): "Bao" rồi "bao" → 23505', async () => {
    expect(await insertUnit('bao', 'Bao')).toBe('OK');
    expect(await insertUnit('bao-2', 'bao')).toBe('23505');
  });

  it('name 40 ký tự được, 41 → 23514; name rỗng/thừa khoảng trắng → 23514; name_en 40 được, 41 → 23514', async () => {
    expect(await insertUnit('n40', 'n'.repeat(40))).toBe('OK');
    expect(await insertUnit('n41', 'm'.repeat(41))).toBe('23514');
    expect(await insertUnit('n0', '')).toBe('23514');
    expect(await insertUnit('nsp', ' a ')).toBe('23514');
    expect(await insertUnit('e40', 'e40', 'e'.repeat(40))).toBe('OK');
    expect(await insertUnit('e41', 'e41', 'e'.repeat(41))).toBe('23514');
  });
});
