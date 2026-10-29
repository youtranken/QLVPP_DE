import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { encodeCursor } from '../src/common/cursor';
import { AuditWriterService } from '../src/modules/audit/audit-writer.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };

describe('GET admin/audit', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  const action = `e2e.audit_page.${Date.now()}`;

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
    const writer = app.get(AuditWriterService);
    for (let i = 0; i < 5; i += 1) {
      await writer.append({ actor: 'system', action, objectId: String(i) });
    }
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('member → 403', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/audit')
      .set('x-dev-user-sub', 'dev-member')
      .set('x-dev-role', 'member')
      .expect(403);
  });

  it('admin lọc theo action, phân trang cursor đủ 5 bản ghi mới nhất trước, không lặp', async () => {
    const ids: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const res: request.Response = await request(app.getHttpServer())
        .get('/api/admin/audit')
        .query({ action, limit: 2, ...(cursor ? { cursor } : {}) })
        .set('x-dev-user-sub', 'dev-admin')
        .set('x-dev-role', 'admin')
        .expect(200);
      const body = res.body as {
        items: Array<{ objectId: string }>;
        next_cursor: string | null;
      };
      ids.push(...body.items.map((r) => r.objectId));
      cursor = body.next_cursor;
      pages += 1;
    } while (cursor);
    expect(pages).toBe(3);
    expect(ids).toEqual(['4', '3', '2', '1', '0']);
  });

  it('limit mặc định 50: 51 bản ghi → trang 1 có 50 + next_cursor, trang 2 có 1; limit 0 → 400, 200 → 51 bản ghi một trang', async () => {
    const many = `e2e.audit_limit.${Date.now()}`;
    const writer = app.get(AuditWriterService);
    for (let i = 0; i < 51; i += 1) {
      await writer.append({ actor: 'system', action: many, objectId: `${i}` });
    }
    const get = (query: object) =>
      request(app.getHttpServer())
        .get('/api/admin/audit')
        .query({ action: many, ...query })
        .set('x-dev-user-sub', 'dev-admin')
        .set('x-dev-role', 'admin');
    const p1 = (await get({}).expect(200)).body;
    expect(p1.items).toHaveLength(50);
    expect(p1.next_cursor).toEqual(expect.any(String));
    const p2 = (await get({ cursor: p1.next_cursor }).expect(200)).body;
    expect(p2.items).toHaveLength(1);
    expect(p2.next_cursor).toBeNull();
    const zero = await get({ limit: 0 }).expect(400);
    expect(zero.body).toMatchObject({ code: 'VALIDATION', fields: ['limit'] });
    const full = (await get({ limit: 200 }).expect(200)).body;
    expect(full.items).toHaveLength(51);
    expect(full.next_cursor).toBeNull();
  });

  it('cursor hỏng → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/audit')
      .query({ cursor: 'rac' })
      .set('x-dev-user-sub', 'dev-admin')
      .set('x-dev-role', 'admin')
      .expect(400);
  });

  it.each([
    ['ngày không có thật trong cursor', '2027-02-29 00:00:00+07'],
    ['phút offset >= 60 trong cursor', '2026-10-28 10:00:00+07:99'],
  ])('cursor đúng hình sai giá trị (%s) → 400 VALIDATION', async (_n, ts) => {
    const cursor = encodeCursor([ts, '00000000-0000-4000-8000-000000000000']);
    const res = await request(app.getHttpServer())
      .get('/api/admin/audit')
      .query({ cursor })
      .set('x-dev-user-sub', 'dev-admin')
      .set('x-dev-role', 'admin')
      .expect(400);
    expect((res.body as { code: string }).code).toBe('VALIDATION');
  });

  it('lọc actor so khớp chính xác: u-1 không trả dòng của u-10', async () => {
    const tag = `e2e.actor_exact.${Date.now()}`;
    const writer = app.get(AuditWriterService);
    await writer.append({ actor: `${tag}-u-1`, action: tag });
    await writer.append({ actor: `${tag}-u-10`, action: tag });
    const res = await request(app.getHttpServer())
      .get('/api/admin/audit')
      .query({ actor: `${tag}-u-1` })
      .set('x-dev-user-sub', 'dev-admin')
      .set('x-dev-role', 'admin')
      .expect(200);
    const actors = (res.body as { items: Array<{ actor: string }> }).items.map(
      (r) => r.actor,
    );
    expect(actors).toEqual([`${tag}-u-1`]);
  });

  it('lọc self: true chỉ dòng detail.self = true; false gồm dòng self false hoặc không có cờ', async () => {
    const tag = `e2e.self_filter.${Date.now()}`;
    const writer = app.get(AuditWriterService);
    await writer.append({
      actor: 'a',
      action: tag,
      objectId: 'yes',
      detail: { self: true },
    });
    await writer.append({
      actor: 'a',
      action: tag,
      objectId: 'no',
      detail: { self: false },
    });
    await writer.append({ actor: 'a', action: tag, objectId: 'none' });
    const ids = async (self: string) =>
      (
        (
          await request(app.getHttpServer())
            .get('/api/admin/audit')
            .query({ action: tag, self })
            .set('x-dev-user-sub', 'dev-admin')
            .set('x-dev-role', 'admin')
            .expect(200)
        ).body as { items: Array<{ objectId: string }> }
      ).items
        .map((r) => r.objectId)
        .sort();
    expect(await ids('true')).toEqual(['yes']);
    expect(await ids('false')).toEqual(['no', 'none']);
  });

  it.each([
    ['ngày không có thật', { from: '2026-02-30' }],
    ['to < from', { from: '2026-10-10', to: '2026-10-01' }],
    ['self không phải true/false', { self: 'yes' }],
  ])('%s → 400 VALIDATION', async (_label, query) => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/audit')
      .query(query)
      .set('x-dev-user-sub', 'dev-admin')
      .set('x-dev-role', 'admin')
      .expect(400);
    expect(res.body.code).toBe('VALIDATION');
  });

  it.each([
    ['from=0000-01-01', { from: '0000-01-01' }, 'from'],
    ['from=1999-12-31', { from: '1999-12-31' }, 'from'],
    ['to=0001-01-01', { to: '0001-01-01' }, 'to'],
  ])('%s → 400 VALIDATION (năm < 2000), không 500', async (_l, query, field) => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/audit')
      .query(query)
      .set('x-dev-user-sub', 'dev-admin')
      .set('x-dev-role', 'admin')
      .expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION', fields: [field] });
  });

  it('from=2000-01-01 → 200', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/audit')
      .query({ from: '2000-01-01', action })
      .set('x-dev-user-sub', 'dev-admin')
      .set('x-dev-role', 'admin')
      .expect(200);
  });
});
