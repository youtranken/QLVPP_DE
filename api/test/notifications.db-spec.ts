import { Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { Database, Tx } from '../src/database/database.module';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { LOCAL_SA_SUB } from '../src/modules/auth/local-sa-env';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import type { NotifyInput } from '../src/modules/notifications/notifications.service';
import { UserAccessService } from '../src/modules/users/user-access.service';
import { UsersService } from '../src/modules/users/users.service';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };

describe('NotificationsService — ghi trong savepoint, người nhận admin (Postgres thật)', () => {
  const SUFFIX = `${process.pid}-${Date.now().toString(36)}`;
  const sub = (k: string) => `db-noti-${k}-${SUFFIX}`;
  let pool: Pool;
  let db: Database;
  let users: UsersService;
  let service: NotificationsService;
  // Chỉ khôi phục local:sa khi test đã đụng tới; dòng có sẵn thì trả lại role + status, không xóa
  let sa:
    | { state: 'untouched' }
    | { state: 'absent' }
    | { state: 'existed'; role: string; status: string } = {
    state: 'untouched',
  };

  const input = (over: Partial<NotifyInput> = {}): NotifyInput => ({
    eventId: `db:${SUFFIX}:${Math.random().toString(36).slice(2)}`,
    recipients: [sub('a'), sub('b')],
    topic: 'line_review',
    params: { name: 'Bút' },
    link: '/history',
    now: new Date('2026-11-05T03:00:00.123Z'),
    ...over,
  });
  const rowsOf = async (eventId: string) =>
    (
      await pool.query<{ user_sub: string; created_at: Date; params: object }>(
        'SELECT user_sub, created_at, params FROM in_app_notifications WHERE event_id = $1 ORDER BY user_sub',
        [eventId],
      )
    ).rows;
  const notify = (n: NotifyInput) =>
    db.transaction((tx) => service.notifyWithin(tx, n));

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    db = drizzle(pool);
    const audit = { append: () => Promise.resolve() } as never;
    users = new UsersService(
      db,
      new UserAccessService(db, {} as never, audit),
      audit,
    );
    service = new NotificationsService(db, users);
    await pool.query(
      `INSERT INTO users (sub, status, role) VALUES
         ($1, 'active', 'admin'), ($2, 'locked', 'admin'), ($3, 'active', 'member'),
         ($4, 'no_access', 'admin'), ($5, 'deleted', 'admin'), ($6, 'active', 'admin')`,
      [
        sub('admin'),
        sub('locked'),
        sub('other'),
        sub('noaccess'),
        sub('deleted'),
        sub('admin2'),
      ],
    );
    const existing = await pool.query<{ role: string; status: string }>(
      'SELECT role, status FROM users WHERE sub = $1',
      [LOCAL_SA_SUB],
    );
    const row = existing.rows[0];
    sa = row
      ? { state: 'existed', role: row.role, status: row.status }
      : { state: 'absent' };
    await pool.query(
      `INSERT INTO users (sub, status, role) VALUES ($1, 'active', 'admin')
       ON CONFLICT (sub) DO UPDATE SET role = 'admin', status = 'active'`,
      [LOCAL_SA_SUB],
    );
  });

  afterAll(async () => {
    try {
      await pool.query(
        `DELETE FROM in_app_notifications WHERE user_sub LIKE $1 OR event_id LIKE $2`,
        [`db-noti-%-${SUFFIX}`, `db:${SUFFIX}:%`],
      );
      await pool.query('DELETE FROM users WHERE sub LIKE $1', [
        `db-noti-%-${SUFFIX}`,
      ]);
      if (sa.state === 'absent') {
        await pool.query('DELETE FROM users WHERE sub = $1', [LOCAL_SA_SUB]);
      } else if (sa.state === 'existed') {
        await pool.query(
          'UPDATE users SET role = $2, status = $3 WHERE sub = $1',
          [LOCAL_SA_SUB, sa.role, sa.status],
        );
      }
    } finally {
      await pool.end();
    }
  });

  it('notifyWithin 2 lần cùng event_id cho [A, B] → 2 bản ghi (lần 2 trả 0); created_at = now truyền vào', async () => {
    const n = input();
    expect(await notify(n)).toBe(2);
    expect(await notify(n)).toBe(0);
    const rows = await rowsOf(n.eventId);
    expect(rows.map((r) => r.user_sub)).toEqual([sub('a'), sub('b')]);
    expect(rows[0].created_at.toISOString()).toBe('2026-11-05T03:00:00.123Z');
    expect(rows[0].params).toEqual({ name: 'Bút' });
  });

  it('2 tx thật song song cùng event_id cho [A, B] → tổng trả về 2, đúng 1 bản ghi mỗi người nhận', async () => {
    const n = input();
    const counts = await Promise.all([notify(n), notify(n)]);
    expect(counts[0] + counts[1]).toBe(2);
    expect((await rowsOf(n.eventId)).map((r) => r.user_sub)).toEqual([
      sub('a'),
      sub('b'),
    ]);
  });

  it('cùng event_id, người nhận mới → chỉ ghi thêm người mới; trùng sub trong danh sách → 1 bản ghi', async () => {
    const n = input({ recipients: [sub('a'), sub('a')] });
    expect(await notify(n)).toBe(1);
    expect(await notify({ ...n, recipients: [sub('a'), sub('b')] })).toBe(1);
    expect(await rowsOf(n.eventId)).toHaveLength(2);
  });

  it('recipients rỗng → 0, không mở savepoint', async () => {
    const transaction = jest.fn();
    const tx = { transaction } as unknown as Tx;
    expect(await service.notifyWithin(tx, input({ recipients: [] }))).toBe(0);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('INSERT lỗi (trigger RAISE) → trả 0, log {event_id, topic, code} không có params, UPDATE khác trong cùng tx vẫn commit', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const n = input({ params: { secret_name: 'KHÔNG-LOG' } });
    try {
      await pool.query(`CREATE FUNCTION noti_fail_${process.pid}() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'boom' USING ERRCODE = 'P0001'; END $$`);
      await pool.query(`CREATE TRIGGER noti_fail_${process.pid} BEFORE INSERT ON in_app_notifications
        FOR EACH ROW EXECUTE FUNCTION noti_fail_${process.pid}()`);
      const written = await db.transaction(async (tx) => {
        const count = await service.notifyWithin(tx, n);
        await tx.execute(
          sql`UPDATE users SET full_name = 'sau lỗi chuông' WHERE sub = ${sub('admin')}`,
        );
        return count;
      });
      expect(written).toBe(0);
      const u = await pool.query('SELECT full_name FROM users WHERE sub = $1', [
        sub('admin'),
      ]);
      expect(u.rows[0].full_name).toBe('sau lỗi chuông');
      expect(await rowsOf(n.eventId)).toHaveLength(0);
      const logged = JSON.stringify(warn.mock.calls);
      expect(logged).toContain(n.eventId);
      expect(logged).toContain('line_review');
      expect(logged).toContain('P0001');
      expect(logged).not.toContain('KHÔNG-LOG');
    } finally {
      warn.mockRestore();
      await pool.query(
        `DROP TRIGGER IF EXISTS noti_fail_${process.pid} ON in_app_notifications`,
      );
      await pool.query(`DROP FUNCTION IF EXISTS noti_fail_${process.pid}()`);
    }
  });

  it('activeAdminSubs: active+admin có; active+member, no_access+admin, locked+admin, deleted+admin, local:sa không', async () => {
    const subs = await users.activeAdminSubs();
    expect(subs).toEqual(expect.arrayContaining([sub('admin'), sub('admin2')]));
    for (const k of ['locked', 'deleted', 'other', 'noaccess']) {
      expect(subs).not.toContain(sub(k));
    }
    expect(subs).not.toContain(LOCAL_SA_SUB);
  });

  it('adminRecipients theo users.role; chạy được trong tx', async () => {
    const subs = await db.transaction((tx) => service.adminRecipients(tx));
    expect(subs.filter((s) => s.endsWith(SUFFIX)).sort()).toEqual(
      [sub('admin'), sub('admin2')].sort(),
    );
  });

  it('purgeBefore(cutoff): created_at < cutoff bị xóa, = cutoff giữ lại', async () => {
    const cutoff = new Date('2001-01-01T00:00:00Z');
    const old = input({
      recipients: [sub('old')],
      now: new Date('2000-12-31T23:59:59.999Z'),
    });
    const edge = input({ recipients: [sub('edge')], now: cutoff });
    await notify(old);
    await notify(edge);
    expect(await service.purgeBefore(cutoff)).toBe(1);
    expect(await rowsOf(old.eventId)).toHaveLength(0);
    expect(await rowsOf(edge.eventId)).toHaveLength(1);
  });
});
