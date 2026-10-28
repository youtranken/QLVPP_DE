import { INestApplication } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { DRIZZLE_DB, PG_POOL } from '../src/database/database.module';
import type { Database } from '../src/database/database.module';
import { AuditWriterService } from '../src/modules/audit/audit-writer.service';
import { FileAccessPolicy } from '../src/modules/files/file-access.policy';
import { FilesCleanupJob } from '../src/modules/files/files-cleanup.job';
import { FilesService } from '../src/modules/files/files.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const MEMBER_A = 'e2e-files-a';
const MEMBER_B = 'e2e-files-b';
// Suite khác (catalog) chạy song song cùng DB và có items tham chiếu files: chỉ dọn tệp của suite này
const DELETE_OWN_FILES =
  "DELETE FROM files WHERE uploaded_by_sub LIKE 'e2e-files-%'";

describe('files: upload, đọc theo tham chiếu, dọn mồ côi', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let dir: string;

  const as = (req: request.Test, sub: string, role = 'member') =>
    req.set('x-dev-user-sub', sub).set('x-dev-role', role);
  const upload = (
    sub: string,
    buf: Buffer = PNG_1X1,
    purpose = 'item_image',
    filename = 'anh.png',
  ) =>
    as(request(app.getHttpServer()).post('/api/files'), sub)
      .field('purpose', purpose)
      .attach('file', buf, { filename, contentType: 'image/png' });
  const get = (id: string, sub: string, role = 'member') =>
    as(request(app.getHttpServer()).get(`/api/files/${id}`), sub, role);
  const backdate = (ids: string[]) =>
    pool.query(
      "UPDATE files SET created_at = now() - interval '25 hours' WHERE id = ANY($1)",
      [ids],
    );
  const filesAuditCount = async () =>
    Number(
      (
        await pool.query<{ n: string }>(
          "SELECT count(*) AS n FROM audit_log WHERE action LIKE 'files.%' AND actor LIKE 'e2e-files-%'",
        )
      ).rows[0].n,
    );

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.query(DELETE_OWN_FILES);
    await pool.query(
      'CREATE TABLE IF NOT EXISTS e2e_file_refs (file_id uuid NOT NULL, viewer_sub text NOT NULL)',
    );
    await pool.query('DELETE FROM e2e_file_refs');
    dir = await mkdtemp(join(tmpdir(), 'vpp-files-'));
    process.env.FILES_DIR = dir;
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
    app.get(FileAccessPolicy).registerReference({
      name: 'e2e_file_refs',
      purpose: 'item_image',
      readCondition:
        'EXISTS (SELECT 1 FROM e2e_file_refs r WHERE r.file_id = f.id AND r.viewer_sub = $2)',
      referencedCondition:
        'EXISTS (SELECT 1 FROM e2e_file_refs r WHERE r.file_id = f.id)',
    });
  });

  afterAll(async () => {
    await app.close();
    await pool.query('DROP TABLE IF EXISTS e2e_file_refs');
    await pool.query(DELETE_OWN_FILES);
    await pool.end();
    await rm(dir, { recursive: true, force: true });
    delete process.env.FILES_DIR;
    delete process.env.AUTH_DEV_MODE;
  });

  describe('POST /api/files', () => {
    it('PNG 1×1 thật → 201 {id, mime, size_bytes}, ghi <id>.png và bản ghi files, audit files.uploaded', async () => {
      const res = await upload(MEMBER_A).expect(201);
      const body = res.body as { id: string; mime: string; size_bytes: number };
      expect(body).toEqual({
        id: expect.any(String) as string,
        mime: 'image/png',
        size_bytes: PNG_1X1.length,
      });
      expect(existsSync(join(dir, `${body.id}.png`))).toBe(true);
      const row = await pool.query(
        'SELECT purpose, uploaded_by_sub, original_name FROM files WHERE id = $1',
        [body.id],
      );
      expect(row.rows[0]).toEqual({
        purpose: 'item_image',
        uploaded_by_sub: MEMBER_A,
        original_name: 'anh.png',
      });
      const audit = await pool.query(
        "SELECT actor FROM audit_log WHERE action = 'files.uploaded' AND object_id = $1",
        [body.id],
      );
      expect(audit.rows).toEqual([{ actor: MEMBER_A }]);
    });

    it('.exe đổi đuôi .png → 400 FILE_TYPE_INVALID, không ghi đĩa', async () => {
      const before = (await readdir(dir)).length;
      const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64)]);
      const res = await upload(MEMBER_A, exe).expect(400);
      expect(res.body).toMatchObject({ code: 'FILE_TYPE_INVALID' });
      expect((await readdir(dir)).length).toBe(before);
    });

    it('thiếu field file → 400 FILE_TYPE_INVALID', async () => {
      const res = await as(
        request(app.getHttpServer()).post('/api/files'),
        MEMBER_A,
      )
        .field('purpose', 'item_image')
        .expect(400);
      expect(res.body).toMatchObject({ code: 'FILE_TYPE_INVALID' });
    });

    it('5 MB + 1 byte → 413 FILE_TOO_LARGE', async () => {
      const big = Buffer.alloc(5 * 1024 * 1024 + 1);
      PNG_1X1.copy(big);
      const res = await upload(MEMBER_A, big).expect(413);
      expect(res.body).toMatchObject({ code: 'FILE_TOO_LARGE' });
    });

    it("purpose='x' → 400 PURPOSE_INVALID", async () => {
      const res = await upload(MEMBER_A, PNG_1X1, 'x').expect(400);
      expect(res.body).toMatchObject({ code: 'PURPOSE_INVALID' });
    });
  });

  describe('GET /api/files/:id', () => {
    let id: string;

    beforeAll(async () => {
      id = ((await upload(MEMBER_A).expect(201)).body as { id: string }).id;
    });

    it('người tải lên → 200 inline, Content-Type image/png, nosniff, cache private 1 ngày, đúng bytes', async () => {
      const res = await get(id, MEMBER_A).buffer(true).expect(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['content-disposition']).toBe('inline');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toBe('private, max-age=86400');
      expect(Buffer.compare(res.body as Buffer, PNG_1X1)).toBe(0);
    });

    it('member B không tham chiếu → 404; admin và sa → 200', async () => {
      await get(id, MEMBER_B).expect(404);
      await get(id, 'e2e-files-admin', 'admin').expect(200);
      await get(id, 'e2e-files-sa', 'sa').expect(200);
    });

    it('id không tồn tại hoặc không phải uuid → 404', async () => {
      await get('00000000-0000-4000-8000-000000000000', MEMBER_A).expect(404);
      await get('khong-phai-uuid', MEMBER_A).expect(404);
    });

    it('checker đã đăng ký tham chiếu tới B → B đọc được 200', async () => {
      await pool.query(
        'INSERT INTO e2e_file_refs (file_id, viewer_sub) VALUES ($1, $2)',
        [id, MEMBER_B],
      );
      await get(id, MEMBER_B).expect(200);
      expect(
        await app.get(FileAccessPolicy).canRead(id, {
          sub: MEMBER_B,
          role: 'member',
          devMode: true,
        }),
      ).toBe(true);
      await pool.query('DELETE FROM e2e_file_refs');
    });

    it('GET không ghi audit files.*', async () => {
      const before = await filesAuditCount();
      await get(id, MEMBER_A).expect(200);
      await get(id, 'e2e-files-admin', 'admin').expect(200);
      await get(id, MEMBER_B).expect(404);
      expect(await filesAuditCount()).toBe(before);
    });
  });

  describe('FilesService.assertOwnedBy', () => {
    it('đúng người tải + đúng purpose → qua; khác người/purpose/không tồn tại → FILE_FORBIDDEN', async () => {
      const id = ((await upload(MEMBER_A).expect(201)).body as { id: string })
        .id;
      const files = app.get(FilesService);
      await expect(
        files.assertOwnedBy(id, MEMBER_A, 'item_image'),
      ).resolves.toBeUndefined();
      for (const [fileId, sub, purpose] of [
        [id, MEMBER_B, 'item_image'],
        [id, MEMBER_A, 'line_image'],
        ['00000000-0000-4000-8000-000000000000', MEMBER_A, 'item_image'],
        ['khong-phai-uuid', MEMBER_A, 'item_image'],
      ] as const) {
        await expect(
          files.assertOwnedBy(fileId, sub, purpose),
        ).rejects.toMatchObject({ response: { code: 'FILE_FORBIDDEN' } });
      }
    });
  });

  describe('FilesCleanupJob.run', () => {
    it('xóa tệp > 24 h chưa tham chiếu (bản ghi + đĩa), giữ tệp được tham chiếu và tệp còn mới', async () => {
      await pool.query(DELETE_OWN_FILES);
      const orphan = (
        (await upload(MEMBER_A).expect(201)).body as { id: string }
      ).id;
      const kept = ((await upload(MEMBER_A).expect(201)).body as { id: string })
        .id;
      await pool.query(
        'INSERT INTO e2e_file_refs (file_id, viewer_sub) VALUES ($1, $2)',
        [kept, MEMBER_B],
      );
      const job = app.get(FilesCleanupJob);

      expect(await job.run(new Date())).toBe(0);
      expect(existsSync(join(dir, `${orphan}.png`))).toBe(true);

      // Lùi tuổi tệp của mình thay vì tua đồng hồ: tua sẽ xóa luôn ảnh mới tải của suite song song
      await backdate([orphan, kept]);
      expect(await job.run(new Date())).toBe(1);
      const left = await pool.query<{ id: string }>(
        "SELECT id FROM files WHERE uploaded_by_sub LIKE 'e2e-files-%'",
      );
      expect(left.rows.map((r) => r.id)).toEqual([kept]);
      expect(existsSync(join(dir, `${orphan}.png`))).toBe(false);
      expect(existsSync(join(dir, `${kept}.png`))).toBe(true);
    });
  });

  describe('FilesCleanupJob.run — fail-closed theo purpose', () => {
    beforeEach(async () => {
      await pool.query(DELETE_OWN_FILES);
    });

    it('purpose chưa có reference đăng ký (line_image) → giữ nguyên dù > 24 h', async () => {
      const line = (
        (await upload(MEMBER_A, PNG_1X1, 'line_image').expect(201)).body as {
          id: string;
        }
      ).id;
      await backdate([line]);
      expect(await app.get(FilesCleanupJob).run(new Date())).toBe(0);
      expect(existsSync(join(dir, `${line}.png`))).toBe(true);
    });

    it('chưa đăng ký reference nào → không xóa tệp nào', async () => {
      const id = ((await upload(MEMBER_A).expect(201)).body as { id: string })
        .id;
      const bare = new FilesCleanupJob(
        app.get<Database>(DRIZZLE_DB),
        app.get(AuditWriterService),
        new FileAccessPolicy(app.get<Pool>(PG_POOL)),
      );
      expect(await bare.run(new Date(Date.now() + 25 * 3600_000))).toBe(0);
      expect(existsSync(join(dir, `${id}.png`))).toBe(true);
    });
  });

  describe('throttle upload', () => {
    it('21 lần/phút cùng user → lần 21 bị 429; user khác vẫn tải được (đếm theo user, không theo IP)', async () => {
      const sub = 'e2e-files-burst';
      for (let i = 0; i < 20; i += 1) {
        await upload(sub).expect(201);
      }
      await upload(sub).expect(429);
      await upload('e2e-files-other').expect(201);
    });
  });
});
