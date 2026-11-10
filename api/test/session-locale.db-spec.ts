import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { SessionService } from '../src/modules/auth/session.service';
import { UsersService } from '../src/modules/users/users.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };

// Claims phiên giữ ngôn ngữ mới nhất (docs 7a): refresh mang claim cũ hơn lựa chọn vừa lưu không ghi đè
describe('SessionService — locale trong claims phiên (Postgres thật)', () => {
  let app: INestApplication;
  let pool: Pool;
  let sessions: SessionService;
  const sub = `db-locale-${randomUUID()}`;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    app = await createTestApp();
    sessions = app.get(SessionService);
    await app.get(UsersService).upsertFromClaims({ sub, full_name: 'L' });
  });

  afterAll(async () => {
    await pool.query('DELETE FROM sessions WHERE user_sub = $1', [sub]);
    await pool.query('DELETE FROM users WHERE sub = $1', [sub]);
    await app.close();
    await pool.end();
  });

  const open = () =>
    sessions.create({
      userSub: sub,
      refreshToken: 'rt',
      accessToken: 'at-0',
      accessTokenExp: new Date(Date.now() + 60_000),
      claims: { sub, locale: 'vi', locale_updated_at: 100 },
      idToken: null,
    });
  const refreshWith = (id: string, claims: Record<string, unknown>) =>
    sessions.updateTokens(id, {
      refreshToken: 'rt-2',
      accessToken: 'at-2',
      accessTokenExp: new Date(Date.now() + 60_000),
      claims: { sub, ...claims },
      idToken: null,
    });

  it('create lưu access token; find đọc lại', async () => {
    const s = await open();
    expect((await sessions.find(s.id))?.accessToken).toBe('at-0');
  });

  it('setSessionLocale → claims mang locale + mốc mới, giữ claim khác', async () => {
    const s = await open();
    await sessions.setSessionLocale(s.id, 'en', 200);
    const after = await sessions.find(s.id);
    expect(after?.claims).toMatchObject({
      sub,
      locale: 'en',
      locale_updated_at: 200,
    });
  });

  it('refresh mang claim CŨ hơn lựa chọn trong phiên → giữ locale phiên; token khác vẫn thay', async () => {
    const s = await open();
    await sessions.setSessionLocale(s.id, 'en', 200);
    await refreshWith(s.id, {
      locale: 'vi',
      locale_updated_at: 150,
      full_name: 'Mới',
    });
    const after = await sessions.find(s.id);
    expect(after?.accessToken).toBe('at-2');
    expect(after?.claims).toMatchObject({
      locale: 'en',
      locale_updated_at: 200,
      full_name: 'Mới',
    });
  });

  it('refresh thiếu locale_updated_at (token cũ) mà phiên có mốc → giữ locale phiên', async () => {
    const s = await open();
    await sessions.setSessionLocale(s.id, 'en', 200);
    await refreshWith(s.id, { locale: 'vi' });
    expect((await sessions.find(s.id))?.claims).toMatchObject({ locale: 'en' });
  });

  it('refresh mang claim MỚI hơn hoặc bằng → theo token (PMH ID là nguồn duy nhất)', async () => {
    const s = await open();
    await sessions.setSessionLocale(s.id, 'en', 200);
    await refreshWith(s.id, { locale: 'vi', locale_updated_at: 200 });
    expect((await sessions.find(s.id))?.claims).toMatchObject({
      locale: 'vi',
      locale_updated_at: 200,
    });
    await refreshWith(s.id, { locale: 'en', locale_updated_at: 300 });
    expect((await sessions.find(s.id))?.claims).toMatchObject({
      locale: 'en',
      locale_updated_at: 300,
    });
  });

  it('setSessionLocale không chạm phiên SA local (claims null)', async () => {
    const sa = await sessions.createLocalSa();
    await sessions.setSessionLocale(sa.id, 'en', 200);
    expect((await sessions.find(sa.id))?.claims).toBeNull();
    await sessions.destroy(sa.id);
  });
});
