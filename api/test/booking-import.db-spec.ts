import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import type { Database } from '../src/database/database.module';
import {
  parseBookingRows,
  type BookingRawRow,
} from '../src/modules/catalog/booking-import';
import { applyBookingImport } from '../src/modules/catalog/booking-apply';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };

const rows: BookingRawRow[] = [
  { row: 8, code: 'D01', name: 'Bút bi', nameEn: 'Pen', unit: 'Cây' },
  { row: 9, code: 'D01', name: 'Bút bi đỏ', nameEn: '', unit: 'cây' },
  { row: 10, code: 'C01', name: 'Băng keo', nameEn: 'Tape', unit: 'Cuộn' },
  { row: 11, code: 'S01', name: 'Sổ tay', nameEn: 'Book', unit: 'cuốn' },
  { row: 12, code: 'P01', name: 'Pin AA', nameEn: 'AA', unit: '04 viên/vĩ' },
  { row: 13, code: 'G01', name: 'Giấy A4', nameEn: 'A4', unit: 'Ream' },
  {
    row: 14,
    code: 'K01',
    name: 'Kẹp',
    nameEn: 'Clip',
    unit: 'Cái'.normalize('NFD'),
  },
  { row: 15, code: null, name: 'Pin A', nameEn: null, unit: 'viên' },
  { row: 16, code: 'X01', name: '  ', nameEn: null, unit: 'cái' },
];

describe('nạp danh mục Booking — applyBookingImport', () => {
  let pool: Pool;
  let db: Database;

  const count = async (table: string, where = 'true') =>
    Number(
      (await pool.query(`SELECT count(*) FROM ${table} WHERE ${where}`)).rows[0]
        .count,
    );

  beforeAll(() => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    db = drizzle(pool);
  });

  beforeEach(async () => {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.query(
      "UPDATE config SET value = '7' WHERE key = 'default_max_qty'",
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it('--apply: tạo món theo luật §11.4, ĐVT khớp theo tên, tạo ĐVT mới, audit catalog.imported', async () => {
    const r = await applyBookingImport(db, parseBookingRows(rows), {
      apply: true,
    });
    expect(r.created).toHaveLength(8);
    expect(r.skipped).toEqual([
      { row: 16, code: 'X01', name: '', reason: 'empty_name' },
    ]);
    expect(r.unitsCreated).toEqual([
      { code: 'cuon-2', name: 'cuốn' },
      { code: 'vi', name: 'vỉ' },
      { code: 'vien', name: 'viên' },
    ]);
    expect(r.needCode.map((n) => n.row)).toEqual([9, 15]);

    const items = await pool.query<Record<string, unknown>>(
      `SELECT code, name, name_en, unit, pack_note, category_id, image_file_id,
              max_qty, stock_qty, active, admin_only, sort_order
       FROM items ORDER BY sort_order`,
    );
    expect(items.rows.map((i) => [i.code, i.unit])).toEqual([
      ['D01', 'cay'],
      [null, 'cay'],
      ['C01', 'cuon'],
      ['S01', 'cuon-2'],
      ['P01', 'vi'],
      ['G01', 'ram'],
      ['K01', 'cai'],
      [null, 'vien'],
    ]);
    expect(items.rows[1]).toEqual({
      code: null,
      name: 'Bút bi đỏ',
      name_en: null,
      unit: 'cay',
      pack_note: null,
      category_id: null,
      image_file_id: null,
      max_qty: 7,
      stock_qty: 0,
      active: true,
      admin_only: false,
      sort_order: 90,
    });
    expect(items.rows[4].pack_note).toBe('4 viên/vỉ');

    const audit = await pool.query(
      "SELECT actor, detail FROM audit_log WHERE action = 'catalog.imported'",
    );
    expect(audit.rows).toEqual([
      {
        actor: 'system:import',
        detail: {
          created: 8,
          skipped: 1,
          units_created: ['cuon-2', 'vi', 'vien'],
        },
      },
    ]);
    expect(
      await count(
        'audit_log',
        "action = 'unit.created' AND actor = 'system:import'",
      ),
    ).toBe(3);
  });

  it('chạy --apply lần hai: tạo 0, bỏ qua mọi món đã có (theo mã, hoặc theo tên khi không mã), không tạo ĐVT', async () => {
    const parsed = parseBookingRows(rows);
    await applyBookingImport(db, parsed, { apply: true });
    const again = await applyBookingImport(db, parsed, { apply: true });
    expect(again.created).toEqual([]);
    expect(again.unitsCreated).toEqual([]);
    expect(again.skipped.map((s) => [s.row, s.reason])).toEqual([
      [16, 'empty_name'],
      [8, 'exists_code'],
      [9, 'exists_name'],
      [10, 'exists_code'],
      [11, 'exists_code'],
      [12, 'exists_code'],
      [13, 'exists_code'],
      [14, 'exists_code'],
      [15, 'exists_name'],
    ]);
    expect(await count('items')).toBe(8);
    expect(await count('units')).toBe(12);
  });

  it('món sẵn cùng mã thì bỏ qua, không ghi đè; trùng tên khác hoa thường khi không mã cũng bỏ', async () => {
    await pool.query(
      `INSERT INTO items (code, name, unit, max_qty)
       VALUES ('D01', 'Bút bi Hành chính đã sửa', 'cai', 3),
              (NULL, 'PIN A', 'cai', 3)`,
    );
    const r = await applyBookingImport(db, parseBookingRows(rows), {
      apply: true,
    });
    expect(r.skipped).toContainEqual({
      row: 8,
      code: 'D01',
      name: 'Bút bi',
      reason: 'exists_code',
    });
    expect(r.skipped).toContainEqual({
      row: 15,
      code: null,
      name: 'Pin A',
      reason: 'exists_name',
    });
    expect(r.unitsCreated.map((u) => u.code)).not.toContain('vien');
    const kept = await pool.query(
      "SELECT name, unit, max_qty FROM items WHERE code = 'D01'",
    );
    expect(kept.rows).toEqual([
      { name: 'Bút bi Hành chính đã sửa', unit: 'cai', max_qty: 3 },
    ]);
  });

  it('ĐVT đã ngừng (cái): hàng dùng cái bị bỏ với lý do unit_inactive, các hàng khác vẫn nạp', async () => {
    await pool.query("UPDATE units SET active = false WHERE code = 'cai'");
    const r = await applyBookingImport(db, parseBookingRows(rows), {
      apply: true,
    });
    expect(r.skipped).toContainEqual({
      row: 14,
      code: 'K01',
      name: 'Kẹp',
      reason: 'unit_inactive',
    });
    expect(r.created).toHaveLength(7);
    expect(r.created.map((i) => i.row)).not.toContain(14);
    expect(await count('items', "unit = 'cai'")).toBe(0);
    expect(await count('items')).toBe(7);
  });

  it('ĐVT seed đã đổi tên (cái → chiếc): hàng "Cái" vẫn dùng mã cai, không tạo ĐVT "cái" mới', async () => {
    await pool.query("UPDATE units SET name = 'chiếc' WHERE code = 'cai'");
    const r = await applyBookingImport(db, parseBookingRows(rows), {
      apply: true,
    });
    expect(r.unitsCreated.map((u) => u.name)).not.toContain('cái');
    expect(
      (await pool.query("SELECT unit FROM items WHERE code = 'K01'")).rows,
    ).toEqual([{ unit: 'cai' }]);
    expect(await count('units', "lower(name) = 'cái'")).toBe(0);
  });

  it('chạy thử (không --apply): báo cáo đủ nhưng không ghi gì', async () => {
    const r = await applyBookingImport(db, parseBookingRows(rows), {
      apply: false,
    });
    expect(r.applied).toBe(false);
    expect(r.created).toHaveLength(8);
    expect(r.unitsCreated).toHaveLength(3);
    expect(await count('items')).toBe(0);
    expect(await count('units')).toBe(9);
    expect(await count('audit_log')).toBe(0);
  });

  it('tên 120 ký tự nạp được (biên dưới)', async () => {
    const name = 'n'.repeat(120);
    await applyBookingImport(
      db,
      parseBookingRows([
        { row: 8, code: 'L01', name, nameEn: null, unit: 'cuốn' },
      ]),
      { apply: true },
    );
    expect(await count('items', `name = '${name}'`)).toBe(1);
  });

  it('lỗi giữa chừng (tên 121 ký tự ở hàng sau) → rollback: không món, không ĐVT, không audit', async () => {
    const bad: BookingRawRow = {
      row: 20,
      code: 'L02',
      name: 'n'.repeat(121),
      nameEn: null,
      unit: 'bao',
    };
    await expect(
      applyBookingImport(db, parseBookingRows([...rows, bad]), { apply: true }),
    ).rejects.toThrow('Hàng 20');
    expect(await count('items')).toBe(0);
    expect(await count('units')).toBe(9);
    expect(await count('audit_log')).toBe(0);
  });
});
