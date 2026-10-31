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
const ADMIN = 'e2e-units-admin';
const MEMBER = 'e2e-units-member';

interface Unit {
  code: string;
  name: string;
  name_en: string | null;
  sort_order: number;
  active: boolean;
  in_use?: boolean;
  item_count?: number;
}

describe('units: GET units, admin/units', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let dir: string;
  let image: string;

  const http = () => request(app.getHttpServer());
  const as = (req: request.Test, sub: string, role: string) =>
    req.set('x-dev-user-sub', sub).set('x-dev-role', role);
  const admin = (req: request.Test) => as(req, ADMIN, 'admin');
  const member = (req: request.Test) => as(req, MEMBER, 'member');
  const postUnit = (body: object) =>
    admin(http().post('/api/admin/units')).send(body);
  const patchUnit = (code: string, body: object) =>
    admin(http().patch(`/api/admin/units/${code}`)).send(body);
  const newUnit = async (label: string, extra: object = {}) =>
    (await postUnit({ name: `${label} ${RUN}`, ...extra }).expect(201))
      .body as Unit;
  const createItem = (unit: string) =>
    admin(http().post('/api/admin/items')).send({
      name: `Món ĐVT ${RUN} ${Math.random().toString(36).slice(2, 8)}`,
      unit,
      image_file_id: image,
    });
  const auditOf = async (action: string, code: string) =>
    (
      await pool.query<{ detail: Record<string, unknown> }>(
        'SELECT detail FROM audit_log WHERE action = $1 AND object_id = $2',
        [action, code],
      )
    ).rows.map((r) => r.detail);

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    dir = await mkdtemp(join(tmpdir(), 'vpp-units-'));
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
    await pool.query('DELETE FROM items WHERE name LIKE $1', [`%${RUN}%`]);
    await pool.query('DELETE FROM units WHERE name LIKE $1', [`%${RUN}%`]);
    await pool.query('DELETE FROM files WHERE uploaded_by_sub = $1', [ADMIN]);
    await pool.end();
    await rm(dir, { recursive: true, force: true });
    delete process.env.FILES_DIR;
    delete process.env.AUTH_DEV_MODE;
  });

  describe('GET units', () => {
    it('member thấy mọi ĐVT kể cả đã ngừng (active=false), theo sort_order rồi tên, không có in_use/item_count', async () => {
      const off = await newUnit('Ngừng', { sort_order: -5 });
      await patchUnit(off.code, { active: false }).expect(200);
      const res = await member(http().get('/api/units')).expect(200);
      const units = res.body as Unit[];
      expect(units.find((u) => u.code === off.code)).toEqual({
        code: off.code,
        name: off.name,
        name_en: null,
        sort_order: -5,
        active: false,
      });
      const seeded = ['cai', 'hop', 'cay', 'ram', 'cuon', 'loc', 'bich'];
      expect(
        units.map((u) => u.code).filter((c) => seeded.includes(c)),
      ).toEqual(seeded);
      const orders = units.map((u) => u.sort_order);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
      expect(units.find((u) => u.code === 'cai')).toEqual({
        code: 'cai',
        name: 'cái',
        name_en: 'piece',
        sort_order: 10,
        active: true,
      });
    });

    it('?all=1 member → 403 FORBIDDEN_ROLE; admin có thêm in_use và item_count (0 / 2 món)', async () => {
      const res = await member(http().get('/api/units?all=1')).expect(403);
      expect(res.body).toMatchObject({ code: 'FORBIDDEN_ROLE' });
      const off = await newUnit('Ngừng2');
      await patchUnit(off.code, { active: false }).expect(200);
      const used = await newUnit('Dùng');
      await createItem(used.code).expect(201);
      await createItem(used.code).expect(201);
      const all = (await admin(http().get('/api/units?all=1')).expect(200))
        .body as Unit[];
      expect(all.find((u) => u.code === off.code)).toMatchObject({
        active: false,
        in_use: false,
        item_count: 0,
      });
      expect(all.find((u) => u.code === used.code)).toMatchObject({
        active: true,
        in_use: true,
        item_count: 2,
      });
    });
  });

  describe('POST admin/units', () => {
    it('tên 40 ký tự → 201, code sinh từ tên; 41 → 400 VALIDATION {fields:[name]}; name_en 41 → VALIDATION {fields:[name_en]}', async () => {
      const name40 = `Thùng ${RUN}`.padEnd(40, 'x');
      const ok = await postUnit({ name: `  ${name40}  ` }).expect(201);
      expect(ok.body).toMatchObject({
        name: name40,
        name_en: null,
        sort_order: 0,
        active: true,
      });
      expect((ok.body as Unit).code).toMatch(/^thung-[a-z0-9-]+$/);
      expect((ok.body as Unit).code.length).toBeLessThanOrEqual(32);
      const long = await postUnit({ name: `${name40}y` }).expect(400);
      expect(long.body).toMatchObject({ code: 'VALIDATION', fields: ['name'] });
      const longEn = await postUnit({
        name: `En ${RUN}`,
        name_en: 'e'.repeat(41),
      }).expect(400);
      expect(longEn.body).toMatchObject({
        code: 'VALIDATION',
        fields: ['name_en'],
      });
      await postUnit({ name: `En40 ${RUN}`, name_en: 'e'.repeat(40) }).expect(
        201,
      );
      const blank = await postUnit({ name: '   ' }).expect(400);
      expect(blank.body).toMatchObject({
        code: 'VALIDATION',
        fields: ['name'],
      });
    });

    it('trùng tên khác hoa thường → 409 UNIT_EXISTS; tên khác mà cùng code gốc → code thêm -2', async () => {
      const a = await newUnit('Gói');
      const dup = await postUnit({ name: `GÓI ${RUN}` }).expect(409);
      expect(dup.body).toMatchObject({ code: 'UNIT_EXISTS' });
      const b = await newUnit('Gồi');
      expect(b.code).toBe(`${a.code}-2`);
    });

    it('member POST → 403 FORBIDDEN_ROLE', async () => {
      const res = await member(http().post('/api/admin/units'))
        .send({ name: `M ${RUN}` })
        .expect(403);
      expect(res.body).toMatchObject({ code: 'FORBIDDEN_ROLE' });
    });

    it('audit unit.created có after', async () => {
      const u = await newUnit('Audit');
      expect(await auditOf('unit.created', u.code)).toEqual([
        { after: expect.objectContaining({ code: u.code, name: u.name }) },
      ]);
    });
  });

  describe('PATCH admin/units/:code', () => {
    it('sort_order ±1 000 000 → 200; ±1 000 001 hoặc số lẻ → 400 VALIDATION {fields:[sort_order]}', async () => {
      const u = await newUnit('Thứ tự');
      for (const sort_order of [1_000_000, -1_000_000]) {
        await patchUnit(u.code, { sort_order }).expect(200);
      }
      for (const sort_order of [1_000_001, -1_000_001, 1.5]) {
        const res = await patchUnit(u.code, { sort_order }).expect(400);
        expect(res.body).toMatchObject({
          code: 'VALIDATION',
          fields: ['sort_order'],
        });
      }
    });

    it('đổi tên/name_en/sort_order → 200, audit unit.updated có before/after; mã không có → 404 UNIT_NOT_FOUND; trùng tên → 409 UNIT_EXISTS', async () => {
      const u = await newUnit('Xấp');
      const other = await newUnit('Tập');
      const res = await patchUnit(u.code, {
        name: `Xấp lớn ${RUN}`,
        name_en: 'Stack',
        sort_order: 15,
      }).expect(200);
      expect(res.body).toMatchObject({
        code: u.code,
        name: `Xấp lớn ${RUN}`,
        name_en: 'Stack',
        sort_order: 15,
      });
      expect(await auditOf('unit.updated', u.code)).toEqual([
        {
          before: { name: u.name, name_en: null, sort_order: 0 },
          after: { name: `Xấp lớn ${RUN}`, name_en: 'Stack', sort_order: 15 },
        },
      ]);
      const missing = await patchUnit('khong-co', { name: 'x' }).expect(404);
      expect(missing.body).toMatchObject({ code: 'UNIT_NOT_FOUND' });
      const dup = await patchUnit(u.code, { name: other.name }).expect(409);
      expect(dup.body).toMatchObject({ code: 'UNIT_EXISTS' });
    });

    it('active:false rồi tạo món với mã đó → 400 UNIT_INACTIVE; mở lại → tạo được', async () => {
      const u = await newUnit('Cặp');
      await patchUnit(u.code, { active: false }).expect(200);
      const res = await createItem(u.code).expect(400);
      expect(res.body).toMatchObject({ code: 'UNIT_INACTIVE' });
      await patchUnit(u.code, { active: true }).expect(200);
      await createItem(u.code).expect(201);
    });

    it('sửa món: đổi sang ĐVT ngừng → 400 UNIT_INACTIVE; giữ ĐVT cũ đã ngừng mà sửa trường khác → 200', async () => {
      const u = await newUnit('Bao');
      const item = (await createItem(u.code).expect(201)).body as {
        id: string;
      };
      const off = await newUnit('Bó');
      await patchUnit(off.code, { active: false }).expect(200);
      const swap = await admin(http().patch(`/api/admin/items/${item.id}`))
        .send({ unit: off.code })
        .expect(400);
      expect(swap.body).toMatchObject({ code: 'UNIT_INACTIVE' });
      await patchUnit(u.code, { active: false }).expect(200);
      await admin(http().patch(`/api/admin/items/${item.id}`))
        .send({ unit: u.code, pack_note: 'giữ ĐVT' })
        .expect(200);
    });
  });

  describe('DELETE admin/units/:code', () => {
    it('đang có món dùng → 409 UNIT_IN_USE; chưa dùng → 204 và audit unit.deleted có before; xóa lại → 404', async () => {
      const used = await newUnit('Đôi');
      await createItem(used.code).expect(201);
      const res = await admin(
        http().delete(`/api/admin/units/${used.code}`),
      ).expect(409);
      expect(res.body).toMatchObject({ code: 'UNIT_IN_USE' });
      const free = await newUnit('Lố');
      await admin(http().delete(`/api/admin/units/${free.code}`)).expect(204);
      expect(await auditOf('unit.deleted', free.code)).toEqual([
        { before: expect.objectContaining({ code: free.code }) },
      ]);
      const again = await admin(
        http().delete(`/api/admin/units/${free.code}`),
      ).expect(404);
      expect(again.body).toMatchObject({ code: 'UNIT_NOT_FOUND' });
    });

    it('member DELETE → 403', async () => {
      await member(http().delete('/api/admin/units/cai')).expect(403);
    });
  });
});
