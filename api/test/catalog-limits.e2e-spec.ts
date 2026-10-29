import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const RUN = `lim${Date.now().toString(36)}`;
const ADMIN = 'e2e-catlim-admin';
// Tên/mã dài đúng n ký tự nhưng vẫn mang RUN để afterAll dọn được
const padded = (n: number) => `${RUN}-`.padEnd(n, 'x');

describe('catalog: biên độ dài và giới hạn số của DTO', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let dir: string;
  let image: string;

  const http = () => request(app.getHttpServer());
  const admin = (req: request.Test) =>
    req.set('x-dev-user-sub', ADMIN).set('x-dev-role', 'admin');
  const createItem = (extra: Record<string, unknown>) =>
    admin(http().post('/api/admin/items')).send({
      name: `${RUN} ${randomUUID().slice(0, 8)}`,
      unit: 'cay',
      image_file_id: image,
      ...extra,
    });
  const createCategory = (name: string) =>
    admin(http().post('/api/admin/item-categories')).send({ name });

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    dir = await mkdtemp(join(tmpdir(), 'vpp-catlim-'));
    process.env.FILES_DIR = dir;
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
    image = (
      (
        await admin(http().post('/api/files'))
          .field('purpose', 'item_image')
          .attach('file', PNG_1X1, {
            filename: 'a.png',
            contentType: 'image/png',
          })
          .expect(201)
      ).body as { id: string }
    ).id;
  });

  afterAll(async () => {
    await app.close();
    await pool.query(`DELETE FROM items WHERE name LIKE $1 OR code LIKE $1`, [
      `%${RUN}%`,
    ]);
    await pool.query('DELETE FROM item_categories WHERE name LIKE $1', [
      `%${RUN}%`,
    ]);
    await pool.query('DELETE FROM files WHERE uploaded_by_sub = $1', [ADMIN]);
    await pool.end();
    await rm(dir, { recursive: true, force: true });
    delete process.env.FILES_DIR;
    delete process.env.AUTH_DEV_MODE;
  });

  it('tên nhóm 120 ký tự → 201; 121 ký tự → 400 VALIDATION {fields: [name]}', async () => {
    await createCategory(padded(120)).expect(201);
    const res = await createCategory(padded(121)).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION', fields: ['name'] });
  });

  it('tên món 120 ký tự → 201; 121 ký tự → 400 VALIDATION {fields: [name]}', async () => {
    const ok = await createItem({ name: padded(120) }).expect(201);
    expect((ok.body as { name: string }).name).toHaveLength(120);
    const res = await createItem({ name: padded(121) }).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION', fields: ['name'] });
  });

  it('mã món 40 ký tự → 201; 41 ký tự → 400 VALIDATION {fields: [code]}', async () => {
    await createItem({ code: padded(40) }).expect(201);
    const res = await createItem({ code: padded(41) }).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION', fields: ['code'] });
  });

  it.each([1, 999])('max_qty %d → 201 và lưu đúng', async (max) => {
    const res = await createItem({ max_qty: max }).expect(201);
    expect(res.body).toMatchObject({ max_qty: max });
  });

  it.each([0, 1000])(
    'max_qty %d → 400 VALIDATION {fields: [max_qty]}',
    async (max) => {
      const res = await createItem({ max_qty: max }).expect(400);
      expect(res.body).toMatchObject({
        code: 'VALIDATION',
        fields: ['max_qty'],
      });
    },
  );

  it('include_inactive_ids 200 uuid → 200; 201 uuid → 400 VALIDATION {fields: [include_inactive_ids]}', async () => {
    const list = (n: number) =>
      Array.from({ length: n }, () => randomUUID()).join(',');
    await admin(
      http().get(`/api/items?include_inactive_ids=${list(200)}`),
    ).expect(200);
    const res = await admin(
      http().get(`/api/items?include_inactive_ids=${list(201)}`),
    ).expect(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION',
      fields: ['include_inactive_ids'],
    });
  });
});
