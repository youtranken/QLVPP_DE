import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import { SessionAuthService } from '../src/modules/auth/session-auth.service';
import { SessionService } from '../src/modules/auth/session.service';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import type { DirectoryUser } from '../src/modules/users/directory.client';
import { DirectorySyncScheduler } from '../src/modules/users/directory-sync.scheduler';
import { DirectorySyncService } from '../src/modules/users/directory-sync.service';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

// Directory PMH ID bản mới: danh sách chỉ có người đang hoạt động, người khóa/hết hạn/xóa → 404
describe('Directory chỉ trả người đang hoạt động (Postgres thật)', () => {
  let app: INestApplication;
  let pool: Pool;
  let requests = 0;
  const P = `dactive-${Date.now()}-`;
  const sub = (s: string) => `${P}${s}`;
  const activeInIdp = new Set<string>();
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
      // Người của suite khác giữ nguyên để đối chiếu không coi họ là vắng
      const others = await q<{ sub: string }>(
        `SELECT sub FROM users
         WHERE status IN ('active', 'locked') AND sub NOT LIKE 'local%' AND sub NOT LIKE $1`,
        [`${P}%`],
      );
      return [...others.rows.map((r) => r.sub), ...activeInIdp].map((id) => ({
        id,
        status: 'active' as const,
        full_name: id,
      }));
    },
    fetchUser: (id: string): Promise<DirectoryUser | null> => {
      requests += 1;
      const gone = id.startsWith(P) && !activeInIdp.has(id);
      return Promise.resolve(
        gone ? null : { id, status: 'active', full_name: id },
      );
    },
  };

  const sync = () => app.get(DirectorySyncService).sync('dactive-actor');
  const status = async (s: string) =>
    (
      await q<{ status: string }>('SELECT status FROM users WHERE sub = $1', [
        s,
      ])
    ).rows[0].status;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), { log: () => undefined });
    app = await createTestApp(
      [],
      [{ token: DIRECTORY_CLIENT, useValue: directory }],
    );
    await app.get(DirectorySyncScheduler).tick();
    activeInIdp.add(sub('canary'));
  });

  afterAll(async () => {
    await q('DELETE FROM sessions WHERE user_sub LIKE $1', [`${P}%`]);
    await q('DELETE FROM users WHERE sub LIKE $1', [`${P}%`]);
    await pool.end();
    await app.close();
  });

  it('người đang locked ở VPP vắng danh sách, GET /users/:id 404 → no_access, phiên bị hủy', async () => {
    const LOCKED = sub('locked');
    await q(
      `INSERT INTO users (sub, full_name, status, inactive_at) VALUES ($1, $1, 'locked', now())`,
      [LOCKED],
    );
    const session = await app.get(SessionService).create({
      userSub: LOCKED,
      refreshToken: null,
      accessTokenExp: new Date(Date.now() + 10 * 60_000),
      claims: { sub: LOCKED, app_role: 'member', ver: 3 },
      idToken: null,
    });
    const r = await sync();
    expect(r).toMatchObject({ reconcile: 'ok', no_access: 1 });
    expect(await status(LOCKED)).toBe('no_access');
    expect(await app.get(SessionAuthService).resolve(session.id)).toBeNull();
  });

  it('người vắng rồi xuất hiện lại trong danh sách (được mở khóa) → lượt sau về active', async () => {
    const BACK = sub('back');
    await q(
      `INSERT INTO users (sub, full_name, status) VALUES ($1, $1, 'active')`,
      [BACK],
    );
    await sync();
    expect(await status(BACK)).toBe('no_access');
    activeInIdp.add(BACK);
    await sync();
    expect(await status(BACK)).toBe('active');
  });
});
