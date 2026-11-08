import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { Pool } from 'pg';
import { SessionAuthService } from '../src/modules/auth/session-auth.service';
import { SessionService } from '../src/modules/auth/session.service';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import type { DirectoryUser } from '../src/modules/users/directory.client';
import { DirectorySyncService } from '../src/modules/users/directory-sync.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

// Directory giả: danh sách = mọi user SSO khác trong DB test (giữ nguyên status/role để đối chiếu
// không coi họ là vắng) + kịch bản của từng test. fetchUser: id trong `gone` → 404, còn lại → có.
const scenario: {
  listed: DirectoryUser[];
  gone: Set<string>;
  duringFetch?: () => Promise<void>;
  fail?: Error;
} = { listed: [], gone: new Set() };

describe('Directory sync v3 (Postgres thật, Directory giả)', () => {
  let app: INestApplication;
  let pool: Pool;
  let requests = 0;
  const P = `dsync-${Date.now()}-`;
  const sub = (s: string) => `${P}${s}`;
  const q = <T extends object = Record<string, unknown>>(
    text: string,
    params: unknown[] = [],
  ) => pool.query<T>(text, params);

  const directory = {
    resetCount: () => {
      requests = 0;
    },
    requestCount: () => requests,
    fetchUsers: async (): Promise<DirectoryUser[]> => {
      requests += 1;
      await scenario.duringFetch?.();
      if (scenario.fail) throw scenario.fail;
      const mine = new Set(scenario.listed.map((u) => u.id));
      const others = await q<{ sub: string; status: string; role: string }>(
        `SELECT sub, status, role FROM users
         WHERE status IN ('active','locked') AND sub NOT LIKE 'local%' AND sub NOT LIKE $1`,
        [`${P}%`],
      );
      return [
        ...others.rows
          .filter((r) => !mine.has(r.sub))
          .map(
            (r) =>
              ({
                id: r.sub,
                status: r.status,
                app_role: r.role,
              }) as DirectoryUser,
          ),
        ...scenario.listed,
      ];
    },
    fetchUser: (id: string): Promise<DirectoryUser | null> => {
      requests += 1;
      return Promise.resolve(
        scenario.gone.has(id) ? null : { id, status: 'active' },
      );
    },
  };

  const sync = () => app.get(DirectorySyncService).sync('dsync-actor');
  const userRow = async (s: string) =>
    (
      await q<{
        status: string;
        role: string;
        department: string | null;
        team: string | null;
        inactive_at: Date | null;
      }>(
        'SELECT status, role, department, team, inactive_at FROM users WHERE sub = $1',
        [s],
      )
    ).rows[0];
  const audits = async (action: string, s: string) =>
    Number(
      (
        await q<{ n: string }>(
          'SELECT count(*) AS n FROM audit_log WHERE action = $1 AND object_id = $2',
          [action, s],
        )
      ).rows[0].n,
    );
  const addUser = (s: string, status = 'active', extra = '') =>
    q(
      `INSERT INTO users (sub, full_name, status, inactive_at)
       VALUES ($1, $1, $2, ${extra || (status === 'active' ? 'NULL' : 'now()')})`,
      [s, status],
    );
  const listed = (
    id: string,
    extra: Partial<DirectoryUser> = {},
  ): DirectoryUser => ({ id, status: 'active', full_name: id, ...extra });

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    app = await createTestApp(
      [],
      [{ token: DIRECTORY_CLIENT, useValue: directory }],
    );
  });

  beforeEach(() => {
    scenario.listed = [];
    scenario.gone = new Set();
    scenario.duringFetch = undefined;
    scenario.fail = undefined;
  });

  afterAll(async () => {
    await q('DELETE FROM sessions WHERE user_sub LIKE $1', [`${P}%`]);
    await q('DELETE FROM webhook_user_order WHERE sub LIKE $1', [`${P}%`]);
    await q('DELETE FROM users WHERE sub LIKE $1', [`${P}%`]);
    await pool.end();
    await app.close();
  });

  it('sync ghi department/team/role; department "" → NULL; team null → NULL; app_role admin → users.role admin', async () => {
    const [OLD, NEW] = [sub('prof-old'), sub('prof-new')];
    await addUser(OLD);
    await q(`UPDATE users SET department = 'Cũ', team = 'Cũ' WHERE sub = $1`, [
      OLD,
    ]);
    scenario.listed = [
      listed(OLD, { department: '', team: null, app_role: 'admin' }),
      listed(NEW, { department: 'Phòng D&E', team: 'QS', app_role: 'member' }),
    ];
    const r = await sync();
    expect(await userRow(OLD)).toMatchObject({
      department: null,
      team: null,
      role: 'admin',
      status: 'active',
    });
    expect(await userRow(NEW)).toMatchObject({
      department: 'Phòng D&E',
      team: 'QS',
      role: 'member',
      status: 'active',
      inactive_at: null,
    });
    expect(await audits('users.role_changed', OLD)).toBe(1);
    expect(r).toMatchObject({ reconcile: 'ok', no_access: 0 });
  });

  it('user active vắng danh sách, fetchUser 404 → no_access, inactive_at có giá trị; request kế của phiên user đó 401', async () => {
    const GONE = sub('gone');
    await addUser(GONE);
    const session = await app.get(SessionService).create({
      userSub: GONE,
      refreshToken: null,
      accessTokenExp: new Date(Date.now() + 10 * 60_000),
      claims: { sub: GONE, app_role: 'member', ver: 3 },
      idToken: null,
    });
    const auth = app.get(SessionAuthService);
    expect(await auth.resolve(session.id)).not.toBeNull();
    scenario.gone = new Set([GONE]);
    const r = await sync();
    expect(r).toMatchObject({ no_access: 1, reconcile: 'ok' });
    const row = await userRow(GONE);
    expect(row.status).toBe('no_access');
    expect(row.inactive_at).not.toBeNull();
    expect(await audits('users.access_revoked', GONE)).toBe(1);
    expect(await auth.resolve(session.id)).toBeNull();
  });

  it('vắng danh sách nhưng đăng nhập sau mốc bắt đầu sync → không đánh dấu (404 có thể cũ hơn lần cấp lại)', async () => {
    const LATE = sub('late-login');
    await addUser(LATE);
    scenario.gone = new Set([LATE]);
    scenario.duringFetch = async () => {
      await q('UPDATE users SET last_login_at = now() WHERE sub = $1', [LATE]);
    };
    const r = await sync();
    expect((await userRow(LATE)).status).toBe('active');
    expect(r.no_access).toBe(0);
  });

  it('user no_access xuất hiện lại active, inactive_at < syncStartedAt → active + audit users.access_restored', async () => {
    const BACK = sub('back');
    await addUser(BACK, 'no_access', `now() - interval '1 hour'`);
    scenario.listed = [listed(BACK)];
    const r = await sync();
    expect(await userRow(BACK)).toMatchObject({
      status: 'active',
      inactive_at: null,
    });
    expect(r.restored).toBe(1);
    expect(await audits('users.access_restored', BACK)).toBe(1);
  });

  it('inactive_at ≥ syncStartedAt (thu hồi xen giữa lúc sync) → giữ no_access', async () => {
    const RACE = sub('race');
    await addUser(RACE);
    scenario.listed = [listed(RACE)];
    scenario.duringFetch = async () => {
      await q(
        `UPDATE users SET status = 'no_access', inactive_at = clock_timestamp() WHERE sub = $1`,
        [RACE],
      );
    };
    const r = await sync();
    expect((await userRow(RACE)).status).toBe('no_access');
    expect(r.restored).toBe(0);
    expect(await audits('users.access_restored', RACE)).toBe(0);
  });

  it('dấu access_revoked của webhook mới hơn mốc bắt đầu → không mở lại dù inactive_at cũ', async () => {
    const MARK = sub('mark');
    await addUser(MARK, 'no_access', `now() - interval '1 hour'`);
    scenario.listed = [listed(MARK)];
    scenario.duringFetch = async () => {
      await q(
        `INSERT INTO webhook_user_order (sub, access_revoked, updated_at) VALUES ($1, true, clock_timestamp())`,
        [MARK],
      );
    };
    await sync();
    expect((await userRow(MARK)).status).toBe('no_access');
  });

  it('fetchUsers lỗi giữa chừng → không ai đổi trạng thái, không audit sync', async () => {
    const STAY = sub('stay');
    await addUser(STAY);
    scenario.gone = new Set([STAY]);
    scenario.fail = new ServiceUnavailableException({
      code: 'DIRECTORY_UNAVAILABLE',
    });
    const before = Number(
      (
        await q<{ n: string }>(
          `SELECT count(*) AS n FROM audit_log WHERE action = 'users.directory_sync'`,
        )
      ).rows[0].n,
    );
    await expect(sync()).rejects.toThrow(ServiceUnavailableException);
    expect((await userRow(STAY)).status).toBe('active');
    const after = Number(
      (
        await q<{ n: string }>(
          `SELECT count(*) AS n FROM audit_log WHERE action = 'users.directory_sync'`,
        )
      ).rows[0].n,
    );
    expect(after).toBe(before);
  });

  it('Directory báo locked → status locked, inactive_at được đặt; về active thì xóa', async () => {
    const LOCK = sub('lock');
    await addUser(LOCK);
    scenario.listed = [listed(LOCK, { status: 'locked' })];
    await sync();
    const locked = await userRow(LOCK);
    expect(locked.status).toBe('locked');
    expect(locked.inactive_at).not.toBeNull();
    scenario.listed = [listed(LOCK)];
    await sync();
    expect(await userRow(LOCK)).toMatchObject({
      status: 'active',
      inactive_at: null,
    });
  });

  it('no_access mà Directory báo deleted → deleted, giữ mốc inactive_at cũ', async () => {
    const DEL = sub('del');
    await addUser(DEL, 'no_access', `'2026-01-01T00:00:00Z'`);
    scenario.listed = [listed(DEL, { status: 'deleted' })];
    await sync();
    const row = await userRow(DEL);
    expect(row.status).toBe('deleted');
    expect(row.inactive_at?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('local:sa và local-test-* vắng danh sách → không bị hỏi, không đổi', async () => {
    const LOCAL = `local-test-${P}`;
    await addUser(LOCAL);
    scenario.gone = new Set([LOCAL, 'local:sa']);
    await sync();
    expect((await userRow(LOCAL)).status).toBe('active');
    await q('DELETE FROM users WHERE sub = $1', [LOCAL]);
  });
});
