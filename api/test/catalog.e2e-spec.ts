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
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const RUN = Date.now().toString(36);
const ADMIN = 'e2e-cat-admin';
const OTHER_ADMIN = 'e2e-cat-admin2';
const MEMBER = 'e2e-cat-member';

interface Item {
  id: string;
  name: string;
  active: boolean;
  admin_only: boolean;
  max_qty: number;
  image_file_id: string | null;
}

describe('catalog: nhóm món, món', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let dir: string;
  let image: string;

  const http = () => request(app.getHttpServer());
  const as = (req: request.Test, sub: string, role: string) =>
    req.set('x-dev-user-sub', sub).set('x-dev-role', role);
  const admin = (req: request.Test) => as(req, ADMIN, 'admin');
  const member = (req: request.Test) => as(req, MEMBER, 'member');
  const upload = async (sub: string, purpose = 'item_image') =>
    (
      (
        await as(http().post('/api/files'), sub, 'admin')
          .field('purpose', purpose)
          .attach('file', PNG_1X1, {
            filename: 'a.png',
            contentType: 'image/png',
          })
          .expect(201)
      ).body as { id: string }
    ).id;
  const createItem = (body: Record<string, unknown>) =>
    admin(http().post('/api/admin/items')).send(body);
  const itemBody = (extra: Record<string, unknown> = {}) => ({
    name: `Bút bi ${RUN} ${Math.random().toString(36).slice(2, 8)}`,
    unit: 'cay',
    image_file_id: image,
    ...extra,
  });
  const ids = (body: unknown) => (body as Item[]).map((i) => i.id);
  const auditCount = async (action: string, objectId: string) =>
    (
      await pool.query(
        'SELECT 1 FROM audit_log WHERE action = $1 AND object_id = $2',
        [action, objectId],
      )
    ).rows.length;

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    dir = await mkdtemp(join(tmpdir(), 'vpp-catalog-'));
    process.env.FILES_DIR = dir;
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
    image = await upload(ADMIN);
  });

  afterAll(async () => {
    await app.close();
    await pool.query(`DELETE FROM items WHERE name LIKE $1 OR code LIKE $1`, [
      `%${RUN}%`,
    ]);
    await pool.query('DELETE FROM item_categories WHERE name LIKE $1', [
      `%${RUN}%`,
    ]);
    await pool.query('DELETE FROM files WHERE uploaded_by_sub LIKE $1', [
      'e2e-cat-%',
    ]);
    await pool.end();
    await rm(dir, { recursive: true, force: true });
    delete process.env.FILES_DIR;
    delete process.env.AUTH_DEV_MODE;
  });

  describe('nhóm món', () => {
    const postCat = (body: unknown) =>
      admin(http().post('/api/admin/item-categories')).send(body as object);

    it('tạo "Giấy" → 201; "giấy" (khác hoa thường) → 409 CATEGORY_EXISTS; audit category.created', async () => {
      const res = await postCat({ name: `  Giấy ${RUN}  ` }).expect(201);
      expect(res.body).toMatchObject({
        name: `Giấy ${RUN}`,
        name_en: null,
        sort_order: 0,
        active: true,
      });
      const dup = await postCat({ name: `giấy ${RUN}` }).expect(409);
      expect(dup.body).toMatchObject({ code: 'CATEGORY_EXISTS' });
      expect(await auditCount('category.created', (res.body as Item).id)).toBe(
        1,
      );
    });

    it("tên '   ' → 400 VALIDATION; tên 300 ký tự → 400 VALIDATION", async () => {
      for (const name of ['   ', 'x'.repeat(300)]) {
        const res = await postCat({ name }).expect(400);
        expect(res.body).toMatchObject({ code: 'VALIDATION' });
      }
    });

    it('member POST nhóm → 403', async () => {
      await member(http().post('/api/admin/item-categories'))
        .send({ name: `M ${RUN}` })
        .expect(403);
    });

    it('PATCH đổi tên trùng → 409; tắt nhóm → member không thấy, admin ?all=1 thấy; audit category.updated', async () => {
      const a = (await postCat({ name: `Bìa ${RUN}` }).expect(201))
        .body as Item;
      await postCat({ name: `Kẹp ${RUN}` }).expect(201);
      const dup = await admin(
        http().patch(`/api/admin/item-categories/${a.id}`),
      )
        .send({ name: `KẸP ${RUN}` })
        .expect(409);
      expect(dup.body).toMatchObject({ code: 'CATEGORY_EXISTS' });
      await admin(http().patch(`/api/admin/item-categories/${a.id}`))
        .send({ active: false, sort_order: 5 })
        .expect(200);
      const forMember = await member(
        http().get('/api/item-categories?all=1'),
      ).expect(200);
      expect(ids(forMember.body)).not.toContain(a.id);
      const forAdmin = await admin(
        http().get('/api/item-categories?all=1'),
      ).expect(200);
      expect(ids(forAdmin.body)).toContain(a.id);
      expect(await auditCount('category.updated', a.id)).toBe(1);
    });
  });

  describe('món', () => {
    it('không image_file_id → 400 IMAGE_REQUIRED; không unit → 400 UNIT_REQUIRED; unit lạ → 400 VALIDATION', async () => {
      const noImage = await createItem(
        itemBody({ image_file_id: undefined }),
      ).expect(400);
      expect(noImage.body).toMatchObject({ code: 'IMAGE_REQUIRED' });
      const noUnit = await createItem(itemBody({ unit: undefined })).expect(
        400,
      );
      expect(noUnit.body).toMatchObject({ code: 'UNIT_REQUIRED' });
      const badUnit = await createItem(itemBody({ unit: 'kg' })).expect(400);
      expect(badUnit.body).toMatchObject({ code: 'VALIDATION' });
      const blank = await createItem(itemBody({ name: '   ' })).expect(400);
      expect(blank.body).toMatchObject({ code: 'VALIDATION' });
    });

    it('ảnh của admin khác hoặc purpose line_image → 403 FILE_FORBIDDEN', async () => {
      const foreign = await upload(OTHER_ADMIN);
      const line = await upload(ADMIN, 'line_image');
      for (const fileId of [foreign, line]) {
        const res = await createItem(
          itemBody({ image_file_id: fileId }),
        ).expect(403);
        expect(res.body).toMatchObject({ code: 'FILE_FORBIDDEN' });
      }
    });

    it('nhóm không tồn tại → 400 CATEGORY_NOT_FOUND; code trùng → 409 ITEM_CODE_EXISTS', async () => {
      const noCat = await createItem(
        itemBody({ category_id: '00000000-0000-4000-8000-000000000000' }),
      ).expect(400);
      expect(noCat.body).toMatchObject({ code: 'CATEGORY_NOT_FOUND' });
      await createItem(itemBody({ code: `C-${RUN}` })).expect(201);
      const dup = await createItem(itemBody({ code: `C-${RUN}` })).expect(409);
      expect(dup.body).toMatchObject({ code: 'ITEM_CODE_EXISTS' });
    });

    it('đủ trường → 201 (max_qty mặc định từ config); member GET ảnh món → 200; audit item.created', async () => {
      const res = await createItem(
        itemBody({ pack_note: 'hộp 12 cây', min_stock: 5 }),
      ).expect(201);
      const item = res.body as Item & Record<string, unknown>;
      expect(item).toMatchObject({
        unit: 'cay',
        pack_note: 'hộp 12 cây',
        image_file_id: image,
        admin_only: false,
        stock_qty: 0,
        min_stock: 5,
        active: true,
      });
      expect(item.max_qty).toBeGreaterThan(0);
      await member(http().get(`/api/files/${image}`)).expect(200);
      expect(await auditCount('item.created', item.id)).toBe(1);
    });

    it('món admin_only không có trong GET /items của member, có với admin', async () => {
      const item = (
        await createItem(itemBody({ admin_only: true })).expect(201)
      ).body as Item;
      expect(
        ids((await member(http().get('/api/items')).expect(200)).body),
      ).not.toContain(item.id);
      expect(
        ids((await admin(http().get('/api/items')).expect(200)).body),
      ).toContain(item.id);
    });

    it('PATCH active=false → member không thấy, ?include_inactive_ids= thấy; audit item.deactivated', async () => {
      const item = (await createItem(itemBody()).expect(201)).body as Item;
      const patched = await admin(http().patch(`/api/admin/items/${item.id}`))
        .send({ active: false, max_qty: 7 })
        .expect(200);
      expect(patched.body).toMatchObject({ active: false, max_qty: 7 });
      expect(
        ids((await member(http().get('/api/items')).expect(200)).body),
      ).not.toContain(item.id);
      const withIds = await member(
        http().get(`/api/items?include_inactive_ids=${item.id}`),
      ).expect(200);
      expect(ids(withIds.body)).toContain(item.id);
      expect(await auditCount('item.deactivated', item.id)).toBe(1);
    });

    it('include_inactive_ids không phải uuid → 400 VALIDATION', async () => {
      const res = await member(
        http().get('/api/items?include_inactive_ids=abc'),
      ).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION' });
    });

    it('PATCH image_file_id null → 400 IMAGE_REQUIRED; id lạ → 404 ITEM_NOT_FOUND', async () => {
      const item = (await createItem(itemBody()).expect(201)).body as Item;
      const res = await admin(http().patch(`/api/admin/items/${item.id}`))
        .send({ image_file_id: null })
        .expect(400);
      expect(res.body).toMatchObject({ code: 'IMAGE_REQUIRED' });
      const missing = await admin(
        http().patch('/api/admin/items/00000000-0000-4000-8000-000000000000'),
      )
        .send({ max_qty: 3 })
        .expect(404);
      expect(missing.body).toMatchObject({ code: 'ITEM_NOT_FOUND' });
    });

    it('GET admin/items có cờ missing_image theo image_file_id', async () => {
      const item = (await createItem(itemBody()).expect(201)).body as Item;
      await pool.query('UPDATE items SET image_file_id = NULL WHERE id = $1', [
        item.id,
      ]);
      const rows = (await admin(http().get('/api/admin/items')).expect(200))
        .body as (Item & { missing_image: boolean })[];
      expect(rows.find((r) => r.id === item.id)?.missing_image).toBe(true);
      expect(
        rows
          .filter((r) => r.id !== item.id)
          .every((r) => r.missing_image === (r.image_file_id === null)),
      ).toBe(true);
    });

    it('DELETE món chưa dùng → 204, biến khỏi GET admin/items; audit item.deleted', async () => {
      const item = (await createItem(itemBody()).expect(201)).body as Item;
      await admin(http().delete(`/api/admin/items/${item.id}`)).expect(204);
      expect(
        ids((await admin(http().get('/api/admin/items')).expect(200)).body),
      ).not.toContain(item.id);
      expect(await auditCount('item.deleted', item.id)).toBe(1);
    });

    it('cursor sổ cái rác hoặc timestamp đúng hình sai giá trị → 400 VALIDATION, không 500', async () => {
      const cursor = (keys: string[]) =>
        Buffer.from(JSON.stringify(keys)).toString('base64url');
      const anyId = '00000000-0000-4000-8000-000000000000';
      for (const raw of [
        'rac!!',
        cursor(['2026-99-99 00:00:00+00', anyId]),
        cursor(['2026-02-31 00:00:00+07', anyId]),
        cursor(['2026-10-28 10:00:00+07', 'khong-uuid']),
      ]) {
        const res = await admin(
          http().get(`/api/admin/items/${anyId}/movements?cursor=${raw}`),
        ).expect(400);
        expect(res.body).toMatchObject({ code: 'VALIDATION' });
      }
    });

    it('member gọi admin/items → 403', async () => {
      await member(http().get('/api/admin/items')).expect(403);
      await member(http().post('/api/admin/items'))
        .send(itemBody())
        .expect(403);
    });
  });
});
