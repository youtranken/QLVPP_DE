import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { SessionService } from '../src/modules/auth/session.service';
import { UsersService } from '../src/modules/users/users.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };

interface View {
  id: string;
  topic: string;
  params: Record<string, unknown>;
  link: string | null;
  created_at: string;
  read_at: string | null;
}
interface Page {
  items: View[];
  next_cursor: string | null;
  unread_count: number;
}

describe('me/notifications — chuông của tôi', () => {
  const SUFFIX = `${process.pid}-${Date.now().toString(36)}`;
  const A = `e2e-noti-a-${SUFFIX}`;
  const B = `e2e-noti-b-${SUFFIX}`;
  const S = `e2e-noti-s-${SUFFIX}`;
  let app: INestApplication<App>;
  let pool: Pool;
  const ids: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (req: request.Test, sub: string) =>
    req.set('x-dev-user-sub', sub).set('x-dev-role', 'member');
  const list = async (sub: string, query = '') =>
    (await as(http().get(`/api/me/notifications${query}`), sub).expect(200))
      .body as Page;
  const read = (sub: string, body: object) =>
    as(http().post('/api/me/notifications/read'), sub).send(body);

  const seed = async (key: string, sub: string, createdAt: string) => {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO in_app_notifications (user_sub, event_id, topic, params, link, created_at)
       VALUES ($1, $2, 'line_review', '{"name":"Bút"}', '/history', $3) RETURNING id`,
      [sub, `e2e:${key}:${SUFFIX}`, createdAt],
    );
    ids[key] = rows[0].id;
  };
  const reset = async () => {
    await pool.query(
      'DELETE FROM in_app_notifications WHERE user_sub = ANY($1)',
      [[A, B]],
    );
    // A1 cũ nhất; A2, A3 cùng created_at để keyset phải phân xử bằng id
    await seed('A1', A, '2026-11-01T01:00:00Z');
    await seed('A2', A, '2026-11-02T01:00:00Z');
    await seed('A3', A, '2026-11-02T01:00:00Z');
    await seed('B1', B, '2026-11-03T01:00:00Z');
  };

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
  });

  beforeEach(reset);

  afterAll(async () => {
    await app.close();
    await pool.query(
      'DELETE FROM in_app_notifications WHERE user_sub = ANY($1)',
      [[A, B]],
    );
    await pool.query('DELETE FROM sessions WHERE user_sub = $1', [S]);
    await pool.query('DELETE FROM users WHERE sub = $1', [S]);
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('A thấy đúng 3 thông báo của mình, mới trước, không thấy của B; hình NotificationView', async () => {
    const page = await list(A);
    expect(page.items.map((n) => n.id)).not.toContain(ids.B1);
    expect(page.items).toHaveLength(3);
    expect(page.items[2].id).toBe(ids.A1);
    expect(page.items[0]).toEqual({
      id: expect.any(String) as string,
      topic: 'line_review',
      params: { name: 'Bút' },
      link: '/history',
      created_at: '2026-11-02T01:00:00.000Z',
      read_at: null,
    });
    expect(page).toMatchObject({ next_cursor: null, unread_count: 3 });
  });

  it('limit=1 → next_cursor; đi hết 3 trang không trùng, không sót (A2/A3 cùng giờ)', async () => {
    const seen: string[] = [];
    let cursor: string | null = '';
    while (cursor !== null) {
      const q: string = cursor ? `&cursor=${cursor}` : '';
      const page = await list(A, `?limit=1${q}`);
      expect(page.items.length).toBeLessThanOrEqual(1);
      seen.push(...page.items.map((n) => n.id));
      cursor = page.next_cursor;
    }
    expect(seen).toHaveLength(3);
    expect(new Set(seen)).toEqual(new Set([ids.A1, ids.A2, ids.A3]));
  });

  it('limit biên: 1 và 200 → 200; 0 và 201 → 400 VALIDATION; cursor hỏng → 400', async () => {
    for (const limit of [1, 200]) {
      await as(http().get(`/api/me/notifications?limit=${limit}`), A).expect(
        200,
      );
    }
    for (const q of ['limit=0', 'limit=201', 'cursor=abc', 'unread=yes']) {
      const res = await as(http().get(`/api/me/notifications?${q}`), A).expect(
        400,
      );
      expect(res.body.code).toBe('VALIDATION');
    }
  });

  it('read {ids:[A1]} → updated 1, gọi lại → 0; unread=true chỉ còn A2, A3; unread_count 2', async () => {
    expect((await read(A, { ids: [ids.A1] }).expect(200)).body).toEqual({
      updated: 1,
    });
    expect((await read(A, { ids: [ids.A1] }).expect(200)).body).toEqual({
      updated: 0,
    });
    const unread = await list(A, '?unread=true');
    expect(new Set(unread.items.map((n) => n.id))).toEqual(
      new Set([ids.A2, ids.A3]),
    );
    expect(unread.unread_count).toBe(2);
    const all = await list(A, '?unread=false');
    expect(all.items).toHaveLength(3);
    expect(all.items.find((n) => n.id === ids.A1)?.read_at).not.toBeNull();
  });

  it('read {ids:[B1]} bởi A → updated 0, B vẫn chưa đọc', async () => {
    expect((await read(A, { ids: [ids.B1] }).expect(200)).body).toEqual({
      updated: 0,
    });
    expect((await list(B)).unread_count).toBe(1);
  });

  it('read {} → mọi thông báo của A đã đọc, B không đổi', async () => {
    expect((await read(A, {}).expect(200)).body).toEqual({ updated: 3 });
    expect((await list(A)).unread_count).toBe(0);
    expect((await list(A, '?unread=true')).items).toHaveLength(0);
    expect((await list(B)).unread_count).toBe(1);
  });

  it('ids biên: 200 phần tử → 200; 201 → 400; [] / null / ["x"] → 400 VALIDATION', async () => {
    const many = (n: number) => Array.from({ length: n }, () => randomUUID());
    expect(
      (await read(A, { ids: [ids.A1, ...many(199)] }).expect(200)).body,
    ).toEqual({ updated: 1 });
    for (const body of [
      { ids: many(201) },
      { ids: [] },
      { ids: null },
      { ids: ['x'] },
      { ids: 'all' },
    ]) {
      const res = await read(A, body).expect(400);
      expect(res.body.code).toBe('VALIDATION');
    }
    expect((await list(A)).unread_count).toBe(2);
  });

  it('không audit việc đánh dấu đã đọc', async () => {
    await read(A, { ids: [ids.A2] }).expect(200);
    const { rows } = await pool.query(
      'SELECT 1 FROM audit_log WHERE actor = $1',
      [A],
    );
    expect(rows).toHaveLength(0);
  });

  it('có phiên cookie mà thiếu X-CSRF-Token → 403; không phiên → 401', async () => {
    await app.get(UsersService).upsertFromClaims({ sub: S, full_name: 'E2E' });
    const session = await app.get(SessionService).create({
      userSub: S,
      refreshToken: null,
      accessTokenExp: new Date(Date.now() + 10 * 60_000),
      claims: { sub: S, full_name: 'E2E' },
      idToken: null,
    });
    const cookie = `vpp_sid=${session.id}`;
    const res = await http()
      .post('/api/me/notifications/read')
      .set('Cookie', cookie)
      .send({})
      .expect(403);
    expect(res.body.code).toBe('CSRF_TOKEN_INVALID');
    await http()
      .post('/api/me/notifications/read')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({})
      .expect(200);
    await http().get('/api/me/notifications').expect(401);
    await http().post('/api/me/notifications/read').send({}).expect(401);
  });
});
