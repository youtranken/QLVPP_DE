import { INestApplication } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const ADMIN = 'db-item-sort-admin';
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

describe('Món mới đứng cuối nhóm: sort_order = max(cùng nhóm, NULL là một nhóm) + 10 (Postgres thật)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let dir: string;
  let filler = 0;

  const as = (req: request.Test) =>
    req.set('x-dev-user-sub', ADMIN).set('x-dev-role', 'admin');
  const http = () => request(app.getHttpServer());
  const image = async () =>
    (
      (
        await as(http().post('/api/files'))
          .field('purpose', 'item_image')
          .attach('file', PNG_1X1, {
            filename: 'a.png',
            contentType: 'image/png',
          })
          .expect(201)
      ).body as { id: string }
    ).id;
  const create = async (body: object) =>
    (
      await as(http().post('/api/admin/items'))
        .send({
          name: `Món ${++filler}`,
          unit: 'cai',
          image_file_id: await image(),
          ...body,
        })
        .expect(201)
    ).body as { id: string; sort_order: number };
  const category = async (name: string) =>
    (
      await pool.query<{ id: string }>(
        'INSERT INTO item_categories (name, sort_order) VALUES ($1, 10) RETURNING id',
        [name],
      )
    ).rows[0].id;
  const place = (categoryId: string | null, sortOrder: number) =>
    pool.query(
      `INSERT INTO items (name, unit, max_qty, category_id, sort_order)
       VALUES ($1, 'cai', 5, $2, $3)`,
      [`Có sẵn ${++filler}`, categoryId, sortOrder],
    );
  const storedSort = async (id: string) =>
    (
      await pool.query<{ sort_order: number }>(
        'SELECT sort_order FROM items WHERE id = $1',
        [id],
      )
    ).rows[0].sort_order;

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.query('DELETE FROM items');
    dir = await mkdtemp(join(tmpdir(), 'vpp-item-sort-'));
    process.env.FILES_DIR = dir;
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app?.close();
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.end();
    await rm(dir, { recursive: true, force: true });
    delete process.env.FILES_DIR;
  });

  it('nhóm có max 480 → món mới 490; nhóm rỗng → 10; chưa nhóm max 30 → 40', async () => {
    const full = await category('Đầy');
    const empty = await category('Rỗng');
    await place(full, 480);
    await place(full, 15);
    await place(null, 30);
    await place(null, -7);
    expect((await create({ category_id: full })).sort_order).toBe(490);
    expect((await create({ category_id: empty })).sort_order).toBe(10);
    expect((await create({ category_id: null })).sort_order).toBe(40);
    expect((await create({})).sort_order).toBe(50);
  });

  it('đổi nhóm sang Lưu trữ (max 200) → 210; giữ nhóm cũ hoặc gửi kèm sort_order → không gán lại', async () => {
    const store = await category('Lưu trữ');
    const other = await category('Khác');
    await place(store, 200);
    const item = await create({ category_id: other });
    expect(item.sort_order).toBe(10);
    await as(http().patch(`/api/admin/items/${item.id}`))
      .send({ category_id: other, name: 'Đổi tên' })
      .expect(200);
    expect(await storedSort(item.id)).toBe(10);
    const moved = await as(http().patch(`/api/admin/items/${item.id}`))
      .send({ category_id: store })
      .expect(200);
    expect((moved.body as { sort_order: number }).sort_order).toBe(210);
    await as(http().patch(`/api/admin/items/${item.id}`))
      .send({ category_id: other, sort_order: 7 })
      .expect(200);
    expect(await storedSort(item.id)).toBe(7);
    const audit = await pool.query<{ detail: Record<string, unknown> }>(
      `SELECT detail FROM audit_log WHERE action = 'item.updated' AND object_id = $1
       ORDER BY created_at, id`,
      [item.id],
    );
    expect(audit.rows[1].detail).toEqual({
      before: { category_id: other, sort_order: 10 },
      after: { category_id: store, sort_order: 210 },
    });
  });

  it('client cũ gửi sort_order: 5 → 201, lưu 5; PATCH sort_order: 6 → 200, lưu 6', async () => {
    const item = await create({ sort_order: 5 });
    expect(await storedSort(item.id)).toBe(5);
    await as(http().patch(`/api/admin/items/${item.id}`))
      .send({ sort_order: 6 })
      .expect(200);
    expect(await storedSort(item.id)).toBe(6);
  });
});
