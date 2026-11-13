import {
  copyFile,
  cp,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };

// Dựng DB tới trước một migration để gieo dữ liệu theo mô hình cũ, rồi chạy tiếp
async function migrateUpTo(pool: Pool, lastExclusive: string): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), `vpp-mig-${lastExclusive}-`));
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

describe('assertTestDatabase — chặn reset nhầm DB không phải *_test', () => {
  it('URL trỏ …/vpp → throw trước khi chạm DB', () => {
    expect(() =>
      assertTestDatabase('postgres://u:p@127.0.0.1:5492/vpp'),
    ).toThrow(/_test/);
  });

  it('thiếu DATABASE_URL → throw', () => {
    expect(() => assertTestDatabase(undefined)).toThrow(/DATABASE_URL/);
  });

  it('URL trỏ …/vpp_test → trả lại URL', () => {
    const url = 'postgres://u:p@127.0.0.1:5492/vpp_test';
    expect(assertTestDatabase(url)).toBe(url);
  });
});

describe('migrations nền 0001–0013 + 0100–0126', () => {
  let pool: Pool;

  async function resetSchema(): Promise<void> {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  }

  async function migrationCount(): Promise<number> {
    const { rows } = await pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM _migrations',
    );
    return rows[0].n;
  }

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await resetSchema();
    await runMigrations(pool, resolveMigrationsDir(), silent);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('áp đủ 40 migration; chạy lại không áp thêm file nào', async () => {
    expect(await migrationCount()).toBe(40);
    const again = await runMigrations(pool, resolveMigrationsDir(), silent);
    expect(again).toEqual([]);
    expect(await migrationCount()).toBe(40);
  });

  it('file 0003 đã apply bị sửa nội dung → reject với thông báo checksum', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vpp-mig-'));
    try {
      await cp(resolveMigrationsDir(), dir, { recursive: true });
      await writeFile(
        join(dir, '0003_audit_log.sql'),
        'SELECT 1; -- nội dung đã bị sửa',
      );
      await expect(runMigrations(pool, dir, silent)).rejects.toThrow(
        /checksum/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  describe('audit_log append-only', () => {
    beforeAll(async () => {
      await pool.query(
        "INSERT INTO audit_log (actor, action) VALUES ('sub-1', 'test.action')",
      );
    });

    it.each([
      ["UPDATE audit_log SET action = 'x'"],
      ['DELETE FROM audit_log'],
      ['TRUNCATE audit_log'],
    ])('%s → bị từ chối', async (sql) => {
      await expect(pool.query(sql)).rejects.toThrow(/append-only/);
    });
  });

  it('config có seed VPP: đủ 6 khóa, không còn admin_group/authorized_groups', async () => {
    const { rows } = await pool.query<{ key: string; value: string }>(
      'SELECT key, value::text AS value FROM config',
    );
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    expect([...byKey.keys()].sort()).toEqual(
      [
        'registration_last_day',
        'default_max_qty',
        'low_stock_notify',
        'signature_boxes',
        'reminder_days_left',
        'admin_contact',
      ].sort(),
    );
    expect(byKey.has('admin_group')).toBe(false);
    expect(byKey.has('authorized_groups')).toBe(false);
    expect(byKey.get('registration_last_day')).toBe('10');
    expect(byKey.get('default_max_qty')).toBe('20');
    expect(byKey.get('low_stock_notify')).toBe('true');
    expect(byKey.has('signers')).toBe(false);
    expect(byKey.get('reminder_days_left')).toBe('3');
    expect(byKey.get('admin_contact')).toBe('""');
    expect(byKey.has('booking_window_days')).toBe(false);
  });

  it("files.purpose ngoài ('item_image','line_image') → vi phạm CHECK 23514", async () => {
    await expect(
      pool.query(
        `INSERT INTO files (original_name, mime, size_bytes, purpose, uploaded_by_sub)
         VALUES ('a.png', 'image/png', 10, 'other', 'sub-1')`,
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it.each([['item_image'], ['line_image']])(
    'files nhận purpose %s, id tự sinh',
    async (purpose) => {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO files (original_name, mime, size_bytes, purpose, uploaded_by_sub)
         VALUES ('a.png', 'image/png', 10, $1, 'sub-1') RETURNING id`,
        [purpose],
      );
      expect(rows[0].id).toMatch(/^[0-9a-f-]{36}$/);
    },
  );

  it('in_app_notifications trùng (event_id, user_sub) lần 2 → 23505', async () => {
    const insert = `INSERT INTO in_app_notifications (user_sub, event_id, topic)
                    VALUES ('sub-1', '6f1c1f9e-8a51-4d52-9f3e-0d2b9a3c1e01', 'low_stock')`;
    await pool.query(insert);
    await expect(pool.query(insert)).rejects.toMatchObject({ code: '23505' });
  });

  it('processed_webhook_events: event_id khóa chính, received_at tự ghi', async () => {
    await pool.query(
      "INSERT INTO processed_webhook_events (event_id) VALUES ('evt-1')",
    );
    const { rows } = await pool.query<{ received_at: Date }>(
      "SELECT received_at FROM processed_webhook_events WHERE event_id = 'evt-1'",
    );
    expect(rows[0].received_at).toBeInstanceOf(Date);
    await expect(
      pool.query(
        "INSERT INTO processed_webhook_events (event_id) VALUES ('evt-1')",
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('users có department, sessions có id_token và nhận phiên local:sa không cần users', async () => {
    await pool.query(
      "INSERT INTO users (sub, department, role) VALUES ('sub-1', 'Công trình', 'member')",
    );
    await pool.query(
      `INSERT INTO sessions (id_hash, user_sub, csrf_token, id_token, expires_at)
       VALUES (encode(sha256('c'::bytea), 'hex'), 'local:sa', 'csrf', NULL, now() + interval '12 hours')`,
    );
    await expect(
      pool.query("INSERT INTO users (sub, role) VALUES ('sub-2', 'sa')"),
    ).rejects.toMatchObject({ code: '23514' });
  });
});

describe('migration 0122 PMH ID v3', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await migrateUpTo(pool, '0122');
    await pool.query(
      `UPDATE config SET value = '"vpp_admin"' WHERE key = 'admin_group'`,
    );
    await pool.query(
      `INSERT INTO users (sub, groups, role, status, updated_at) VALUES
         ('u-a', '["VPP_ADMIN"]', 'member', 'active', now()),
         ('u-b', '["Test_VPP"]', 'admin', 'active', now()),
         ('u-c', '{"x":1}', 'admin', 'active', now()),
         ('u-locked', '[]', 'member', 'locked', '2026-10-01T00:00:00Z'),
         ('local:sa', '[]', 'admin', 'active', now())`,
    );
    await runMigrations(pool, resolveMigrationsDir(), silent);
  });

  afterAll(async () => {
    // Không để user active của suite này lọt vào mẫu số của suite chạy sau trên cùng DB
    await pool.query(
      `DELETE FROM users WHERE sub IN ('u-a', 'u-b', 'u-c', 'u-locked')`,
    );
    await pool.query(`DELETE FROM webhook_user_order WHERE sub = 'w-1'`);
    await pool.end();
  });

  it('0122 backfill vai: người có group trùng admin_group (khác hoa thường) → admin; người khác → member; local:sa giữ admin', async () => {
    const { rows } = await pool.query<{ sub: string; role: string }>(
      'SELECT sub, role FROM users ORDER BY sub',
    );
    expect(Object.fromEntries(rows.map((r) => [r.sub, r.role]))).toEqual({
      'local:sa': 'admin',
      'u-a': 'admin',
      'u-b': 'member',
      'u-c': 'member',
      'u-locked': 'member',
    });
  });

  it('0122: cột users.groups không còn; có inactive_at, access_checked_at; bảng webhook_user_order (sub PK, seqs jsonb, access_revoked bool, updated_at)', async () => {
    const cols = await pool.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'users' ORDER BY column_name`,
    );
    const users = new Map(cols.rows.map((r) => [r.column_name, r.data_type]));
    expect(users.has('groups')).toBe(false);
    expect(users.get('inactive_at')).toBe('timestamp with time zone');
    expect(users.get('access_checked_at')).toBe('timestamp with time zone');

    const order = await pool.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
       WHERE table_name = 'webhook_user_order' ORDER BY column_name`,
    );
    expect(order.rows).toEqual([
      {
        column_name: 'access_revoked',
        data_type: 'boolean',
        is_nullable: 'NO',
      },
      { column_name: 'seqs', data_type: 'jsonb', is_nullable: 'NO' },
      { column_name: 'sub', data_type: 'text', is_nullable: 'NO' },
      {
        column_name: 'updated_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
    ]);
    await pool.query(`INSERT INTO webhook_user_order (sub) VALUES ('w-1')`);
    const row = await pool.query<{ seqs: unknown; access_revoked: boolean }>(
      `SELECT seqs, access_revoked FROM webhook_user_order WHERE sub = 'w-1'`,
    );
    expect(row.rows[0]).toEqual({ seqs: {}, access_revoked: false });
    await expect(
      pool.query(`INSERT INTO webhook_user_order (sub) VALUES ('w-1')`),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('0122: inactive_at = updated_at cho user không active; active → NULL', async () => {
    const { rows } = await pool.query<{
      sub: string;
      inactive_at: Date | null;
    }>(
      `SELECT sub, inactive_at FROM users WHERE sub IN ('u-a', 'u-locked') ORDER BY sub`,
    );
    expect(rows[0].inactive_at).toBeNull();
    expect(rows[1].inactive_at).toEqual(new Date('2026-10-01T00:00:00Z'));
  });

  it('0122: config không còn admin_group/authorized_groups', async () => {
    const { rows } = await pool.query(
      `SELECT key FROM config WHERE key IN ('admin_group', 'authorized_groups')`,
    );
    expect(rows).toEqual([]);
  });
});

describe('migration 0125–0126 khóa phiên băm, hạn 12 h', () => {
  let pool: Pool;
  const oldSid = '3f0c7a52-9d1e-4b8a-8c6f-1a2b3c4d5e6f';
  const sha12 = (v: string) =>
    createHash('sha256').update(v).digest('hex').slice(0, 12);

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await migrateUpTo(pool, '0125');
    await pool.query(
      `INSERT INTO sessions (id, user_sub, csrf_token) VALUES ($1, 'local:sa', 'csrf')`,
      [oldSid],
    );
    await pool.query(
      `INSERT INTO audit_log (actor, action, object_type, object_id) VALUES
         ('local:sa', 'auth.sa_login', 'session', $1),
         ('u-1', 'auth.logout', 'session', $1),
         ('u-1', 'request.created', 'request', $1)`,
      [oldSid],
    );
    await runMigrations(pool, resolveMigrationsDir(), silent);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('0125: xóa hết phiên cũ (buộc đăng nhập lại), khóa là id_hash 64 hex, không còn cột id', async () => {
    expect((await pool.query('SELECT 1 FROM sessions')).rows).toHaveLength(0);
    const { rows } = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'sessions'`,
    );
    const cols = rows.map((r) => r.column_name);
    expect(cols).toContain('id_hash');
    expect(cols).not.toContain('id');
    await expect(
      pool.query(
        `INSERT INTO sessions (id_hash, user_sub, csrf_token, expires_at) VALUES ($1, 'local:sa', 'c', now())`,
        [oldSid],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('0125: audit phiên đổi object_id thành 12 hex đầu sha256 id cũ; dòng không phải phiên giữ nguyên; append-only vẫn bật', async () => {
    const { rows } = await pool.query<{ action: string; object_id: string }>(
      'SELECT action, object_id FROM audit_log ORDER BY action',
    );
    expect(rows).toEqual([
      { action: 'auth.logout', object_id: sha12(oldSid) },
      { action: 'auth.sa_login', object_id: sha12(oldSid) },
      { action: 'request.created', object_id: oldSid },
    ]);
    await expect(
      pool.query(`UPDATE audit_log SET actor = 'x'`),
    ).rejects.toThrow(/append-only/);
  });

  it('0126: sessions.expires_at NOT NULL, có index', async () => {
    const { rows } = await pool.query<{ is_nullable: string }>(
      `SELECT is_nullable FROM information_schema.columns
        WHERE table_name = 'sessions' AND column_name = 'expires_at'`,
    );
    expect(rows).toEqual([{ is_nullable: 'NO' }]);
    const idx = await pool.query(
      `SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sessions_expires_at'`,
    );
    expect(idx.rows).toHaveLength(1);
  });
});
