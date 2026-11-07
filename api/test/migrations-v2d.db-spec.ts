import { randomUUID } from 'node:crypto';
import { copyFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const YM = '2026-10-01';

describe('migration v2-D 0113–0120', () => {
  let pool: Pool;
  let itemId: string;
  const movement: Record<string, string> = {};
  const request: Record<string, string> = {};

  async function code(sql: string, params: unknown[] = []): Promise<string> {
    try {
      await pool.query(sql, params);
    } catch (e) {
      return (e as { code: string }).code;
    }
    return 'OK';
  }

  // Dựng DB tới 0114 để gieo sổ kho cũ, rồi chạy tiếp 0115+ (backfill chạy trên dữ liệu có sẵn)
  async function migrateUpTo(lastExclusive: string): Promise<void> {
    const dir = await mkdtemp(join(tmpdir(), 'vpp-mig-v2d-'));
    try {
      const all = await readdir(resolveMigrationsDir());
      for (const f of all.filter(
        (n) => n.endsWith('.sql') && n < lastExclusive,
      )) {
        await copyFile(join(resolveMigrationsDir(), f), join(dir, f));
      }
      await runMigrations(pool, dir, silent);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  async function addMovement(
    reason: string,
    delta: number,
    note: string | null,
  ) {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO stock_movements (item_id, delta, reason, note, actor_sub)
       VALUES ($1, $2, $3, $4, 'pw-admin') RETURNING id`,
      [itemId, delta, reason, note],
    );
    return rows[0].id;
  }

  // Phiếu có lần lưu của chính nhân viên rồi Hành chính giảm sau đó; phiếu cũ không có audit của chủ phiếu
  async function seedSavedAt() {
    await pool.query(
      `INSERT INTO users (sub, full_name, status) VALUES ('mig-owner', 'Chủ phiếu', 'active')`,
    );
    const add = async (ym: string, created: string, updated: string) =>
      (
        await pool.query<{ id: string }>(
          `INSERT INTO requests (period_ym, user_sub, created_by_sub, created_at, updated_at)
           VALUES ($1, 'mig-owner', 'mig-owner', $2, $3) RETURNING id`,
          [ym, created, updated],
        )
      ).rows[0].id;
    await pool.query(
      `INSERT INTO periods (ym, deadline) VALUES ('2025-01-01', '2025-01-10T17:00:00Z')`,
    );
    request.audited = await add(YM, '2026-10-02T01:00:00Z', '2026-10-12T05:00:00Z');
    request.plain = await add('2025-01-01', '2026-09-03T02:00:00Z', '2026-09-15T05:00:00Z');
    const audit = (actor: string, action: string, id: string, at: string) =>
      pool.query(
        `INSERT INTO audit_log (actor, action, object_type, object_id, created_at)
         VALUES ($1, $2, 'request', $3, $4)`,
        [actor, action, id, at],
      );
    await audit('mig-owner', 'request.created', request.audited, '2026-10-02T01:00:00Z');
    await audit('mig-owner', 'request.updated', request.audited, '2026-10-04T08:00:00Z');
    await audit('pw-admin', 'request.updated', request.audited, '2026-10-12T05:00:00Z');
    await audit('pw-admin', 'request.updated', request.plain, '2026-09-15T05:00:00Z');
  }

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await migrateUpTo('0115');
    await pool.query(
      `INSERT INTO periods (ym, deadline) VALUES ($1, '2026-10-10T17:00:00Z')`,
      [YM],
    );
    itemId = (
      await pool.query<{ id: string }>(
        `INSERT INTO items (name, unit) VALUES ('Món mig', 'cai') RETURNING id`,
      )
    ).rows[0].id;
    movement.withNote = await addMovement(
      'purchase',
      5,
      'Hàng về kỳ 2026-10 · x',
    );
    movement.plain = await addMovement('purchase', 3, 'Hàng về kỳ 2026-10');
    movement.other = await addMovement('purchase', 2, 'Nhập ngoài kỳ');
    movement.noNote = await addMovement('purchase', 1, null);
    movement.issue = await addMovement('issue', -1, 'Hàng về kỳ 2026-10');
    await seedSavedAt();
    await runMigrations(pool, resolveMigrationsDir(), silent);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('0113 request_line_adjustments', () => {
    const insert = (o: {
      batch?: string;
      line?: string;
      before?: number;
      after?: number;
      reason?: string | null;
      note?: string | null;
    }) =>
      code(
        `INSERT INTO request_line_adjustments
           (batch_id, period_ym, user_sub, request_id, line_id, item_id, name, unit,
            qty_before, qty_after, reason_code, reason_note, actor_sub, created_at)
         VALUES ($1, $2, 'pw-x', $3, $4, NULL, 'Bút', 'cây', $5, $6, $7, $8, 'pw-admin',
                 '2026-11-06T03:00:00Z')`,
        [
          o.batch ?? randomUUID(),
          YM,
          randomUUID(),
          o.line ?? randomUUID(),
          o.before ?? 5,
          o.after ?? 4,
          o.reason === undefined ? 'over_quota' : o.reason,
          o.note ?? null,
        ],
      );

    it('0113 CHECK chỉ giảm: after 5 before 5 → 23514; after 4 → ok', async () => {
      expect(await insert({ before: 5, after: 5 })).toBe('23514');
      expect(await insert({ before: 5, after: 4 })).toBe('OK');
      expect(await insert({ before: 5, after: 0 })).toBe('OK');
      expect(await insert({ before: 5, after: -1 })).toBe('23514');
      expect(await insert({ before: 0, after: -1 })).toBe('23514');
    });

    it('0113 other ghi chú "  ab " → 23514; "abc" → ok', async () => {
      expect(await insert({ reason: 'other', note: null })).toBe('23514');
      expect(await insert({ reason: 'other', note: 'ab' })).toBe('23514');
      expect(await insert({ reason: 'other', note: '  ab ' })).toBe('23514');
      expect(await insert({ reason: 'other', note: 'abc' })).toBe('OK');
      expect(await insert({ reason: 'duplicate', note: null })).toBe('OK');
    });

    it('0113 reason_code: 5 mã chính thức được; mã lạ → 23514; NULL → 23502', async () => {
      for (const reason of [
        'over_quota',
        'adm_out_of_stock',
        'duplicate',
        'user_left',
      ]) {
        expect(await insert({ reason })).toBe('OK');
      }
      expect(await insert({ reason: 'xyz' })).toBe('23514');
      expect(await insert({ reason: null })).toBe('23502');
    });

    it('0113 reason_note 200 ký tự được, 201 → 23514', async () => {
      expect(await insert({ reason: 'other', note: 'a'.repeat(200) })).toBe(
        'OK',
      );
      expect(await insert({ reason: 'other', note: 'a'.repeat(201) })).toBe(
        '23514',
      );
    });

    it('0113 UNIQUE(batch_id,line_id) lặp → 23505', async () => {
      const batch = randomUUID();
      const line = randomUUID();
      expect(await insert({ batch, line })).toBe('OK');
      expect(await insert({ batch, line })).toBe('23505');
      expect(await insert({ batch, line: randomUUID() })).toBe('OK');
    });

    it.each([
      ['UPDATE request_line_adjustments SET qty_after = 0'],
      ['DELETE FROM request_line_adjustments'],
      ['TRUNCATE request_line_adjustments'],
    ])('0113 chỉ-thêm: %s → bị từ chối', async (stmt) => {
      await expect(pool.query(stmt)).rejects.toThrow(/append-only/);
    });

    it('0113 không FK nào, có 3 index request/period/owner', async () => {
      const fks = await pool.query(
        `SELECT 1 FROM pg_constraint
         WHERE conrelid = 'request_line_adjustments'::regclass AND contype = 'f'`,
      );
      expect(fks.rowCount).toBe(0);
      const idx = await pool.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'request_line_adjustments'
         AND indexname LIKE 'request_line_adjustments\\_%\\_idx' ORDER BY 1`,
      );
      expect(idx.rows.map((r) => r.indexname)).toEqual([
        'request_line_adjustments_owner_idx',
        'request_line_adjustments_period_idx',
        'request_line_adjustments_request_idx',
      ]);
    });
  });

  describe('0114 period_adm_out', () => {
    const mark = (key: string, kind?: string, ym = YM) =>
      code(
        `INSERT INTO period_adm_out (period_ym, line_key, kind, marked_by, marked_at)
         VALUES ($1, $2, COALESCE($3, 'out'), 'pw-admin', '2026-11-06T03:00:00Z')`,
        [ym, key, kind ?? null],
      );

    it('0114 PK (ym, key, kind): out và owed_closed cùng key cùng tồn tại', async () => {
      expect(await mark(itemId, 'out')).toBe('OK');
      expect(await mark(itemId, 'owed_closed')).toBe('OK');
      expect(await mark(itemId, 'out')).toBe('23505');
      expect(await mark('custom:["kéo cắt", "cái"]')).toBe('OK');
      expect(await mark(itemId, 'gone')).toBe('23514');
      expect(await mark(itemId, 'out', '2030-01-01')).toBe('23503');
    });

    it('0114 kind mặc định out; xóa kỳ → dòng đánh dấu bị xóa theo', async () => {
      await pool.query(
        `INSERT INTO periods (ym, deadline) VALUES ('2026-09-01', '2026-09-10T17:00:00Z')`,
      );
      await pool.query(
        `INSERT INTO period_adm_out (period_ym, line_key, marked_by, marked_at)
         VALUES ('2026-09-01', 'k', 'pw-admin', now())`,
      );
      const kind = await pool.query<{ kind: string }>(
        `SELECT kind FROM period_adm_out WHERE period_ym = '2026-09-01'`,
      );
      expect(kind.rows).toEqual([{ kind: 'out' }]);
      await pool.query(`DELETE FROM periods WHERE ym = '2026-09-01'`);
      const left = await pool.query(
        `SELECT 1 FROM period_adm_out WHERE period_ym = '2026-09-01'`,
      );
      expect(left.rowCount).toBe(0);
    });
  });

  describe('0115 stock_movements.receipt_ym', () => {
    const receiptYm = async (id: string) =>
      (
        await pool.query<{ ym: string | null }>(
          `SELECT to_char(receipt_ym, 'YYYY-MM-DD') AS ym FROM stock_movements WHERE id = $1`,
          [id],
        )
      ).rows[0].ym;

    it('0115 backfill note "Hàng về kỳ 2026-10" → receipt_ym 2026-10-01; reason issue + receipt_ym → 23514', async () => {
      expect(await receiptYm(movement.withNote)).toBe('2026-10-01');
      expect(await receiptYm(movement.plain)).toBe('2026-10-01');
      expect(await receiptYm(movement.other)).toBeNull();
      expect(await receiptYm(movement.noNote)).toBeNull();
      expect(await receiptYm(movement.issue)).toBeNull();
      expect(
        await code(
          `INSERT INTO stock_movements (item_id, delta, reason, note, actor_sub, receipt_ym)
           VALUES ($1, -1, 'issue', 'x', 'pw-admin', $2)`,
          [itemId, YM],
        ),
      ).toBe('23514');
      expect(
        await code(
          `INSERT INTO stock_movements (item_id, delta, reason, actor_sub, receipt_ym)
           VALUES ($1, 1, 'purchase', 'pw-admin', $2)`,
          [itemId, YM],
        ),
      ).toBe('OK');
    });

    it('0115 có index (receipt_ym, item_id)', async () => {
      const idx = await pool.query<{ indexdef: string }>(
        `SELECT indexdef FROM pg_indexes WHERE tablename = 'stock_movements'
         AND indexdef LIKE '%(receipt_ym, item_id)%'`,
      );
      expect(idx.rowCount).toBe(1);
    });
  });

  it('0116 periods.headcount_subs text[]: mặc định NULL, ghi được mảng', async () => {
    const { rows } = await pool.query<{ subs: string[] | null }>(
      `SELECT headcount_subs AS subs FROM periods WHERE ym = $1`,
      [YM],
    );
    expect(rows[0].subs).toBeNull();
    await pool.query(
      `UPDATE periods SET headcount_subs = ARRAY['a','b'], headcount = 2 WHERE ym = $1`,
      [YM],
    );
    const after = await pool.query<{ subs: string[] }>(
      `SELECT headcount_subs AS subs FROM periods WHERE ym = $1`,
      [YM],
    );
    expect(after.rows[0].subs).toEqual(['a', 'b']);
  });

  it('0117 qty 0 → 23514, 1 → ok', async () => {
    const receive = (qty: number, ym = YM) =>
      code(
        `INSERT INTO custom_receipts (period_ym, line_key, qty, note, created_by, created_at)
         VALUES ($1, 'custom:["kéo cắt", "cái"]', $2, NULL, 'pw-admin', '2026-11-06T03:00:00Z')`,
        [ym, qty],
      );
    expect(await receive(0)).toBe('23514');
    expect(await receive(1)).toBe('OK');
    expect(await receive(1, '2030-01-01')).toBe('23503');
  });

  it('0118 periods.no_order_at / no_order_by mặc định NULL', async () => {
    const { rows } = await pool.query(
      `SELECT no_order_at, no_order_by FROM periods WHERE ym = $1`,
      [YM],
    );
    expect(rows[0]).toEqual({ no_order_at: null, no_order_by: null });
  });

  it('0119 chỉ mục detail->>batch_id của audit_log (bộ phận, chỉ dòng có batch_id) được dùng khi tra món con', async () => {
    const { rows } = await pool.query<{ def: string }>(
      `SELECT pg_get_indexdef(indexrelid) AS def FROM pg_index WHERE indexrelid = 'idx_audit_log_batch_id'::regclass`,
    );
    expect(rows[0].def).toContain("((detail ->> 'batch_id'::text))");
    expect(rows[0].def).toContain('IS NOT NULL');
  });

  it('0120 requests.saved_at: lấy lần lưu cuối của chính chủ phiếu (bỏ lần Hành chính giảm); không có thì created_at; NOT NULL', async () => {
    const { rows } = await pool.query<{ id: string; saved_at: Date }>(
      `SELECT id, saved_at FROM requests WHERE user_sub = 'mig-owner'`,
    );
    const at = Object.fromEntries(rows.map((r) => [r.id, r.saved_at.toISOString()]));
    expect(at[request.audited]).toBe('2026-10-04T08:00:00.000Z');
    expect(at[request.plain]).toBe('2026-09-03T02:00:00.000Z');
    expect(
      await code(`UPDATE requests SET saved_at = NULL WHERE id = $1`, [request.plain]),
    ).toBe('23502');
  });
});
