import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };

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

describe('migrations nền 0001–0013 + 0100–0108', () => {
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

  it('áp đủ 22 migration; chạy lại không áp thêm file nào', async () => {
    expect(await migrationCount()).toBe(22);
    const again = await runMigrations(pool, resolveMigrationsDir(), silent);
    expect(again).toEqual([]);
    expect(await migrationCount()).toBe(22);
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

  it('config có seed VPP: registration_last_day=10, admin_group="vpp-admin" và đủ 7 khóa', async () => {
    const { rows } = await pool.query<{ key: string; value: string }>(
      'SELECT key, value::text AS value FROM config',
    );
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    expect([...byKey.keys()]).toEqual(
      expect.arrayContaining([
        'registration_last_day',
        'default_max_qty',
        'admin_group',
        'authorized_groups',
        'low_stock_notify',
        'signers',
        'admin_contact',
      ]),
    );
    expect(byKey.get('admin_group')).toBe('"vpp-admin"');
    expect(byKey.get('registration_last_day')).toBe('10');
    expect(byKey.get('default_max_qty')).toBe('20');
    expect(byKey.get('authorized_groups')).toBe('[]');
    expect(byKey.get('low_stock_notify')).toBe('true');
    expect(JSON.parse(byKey.get('signers') ?? 'null')).toEqual({
      preparer: '',
      head: '',
      approver: '',
    });
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
      `INSERT INTO sessions (id, user_sub, csrf_token, id_token)
       VALUES (gen_random_uuid(), 'local:sa', 'csrf', NULL)`,
    );
    await expect(
      pool.query("INSERT INTO users (sub, role) VALUES ('sub-2', 'sa')"),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
