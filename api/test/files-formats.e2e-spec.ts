import { INestApplication } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
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
import { FilesCleanupJob } from '../src/modules/files/files-cleanup.job';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name));
const JPEG = fixture('white-1x1.jpg');
const WEBP = fixture('white-1x1.webp');
const MEMBER = 'e2e-filefmt-a';
const DELETE_OWN_FILES = 'DELETE FROM files WHERE uploaded_by_sub = $1';

describe('files: JPEG/WebP thật, mép 24 h của dọn mồ côi', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let dir: string;

  const upload = (buf: Buffer, filename: string, contentType: string) =>
    request(app.getHttpServer())
      .post('/api/files')
      .set('x-dev-user-sub', MEMBER)
      .set('x-dev-role', 'member')
      .field('purpose', 'line_image')
      .attach('file', buf, { filename, contentType });
  const ageBy = (id: string, interval: string) =>
    pool.query(
      'UPDATE files SET created_at = now() - $2::interval WHERE id = $1',
      [id, interval],
    );

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    dir = await mkdtemp(join(tmpdir(), 'vpp-filefmt-'));
    process.env.FILES_DIR = dir;
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    await pool.query(DELETE_OWN_FILES, [MEMBER]);
    await pool.end();
    await rm(dir, { recursive: true, force: true });
    delete process.env.FILES_DIR;
    delete process.env.AUTH_DEV_MODE;
  });

  it.each([
    ['JPEG', 'image/jpeg', 'jpg', JPEG],
    ['WebP', 'image/webp', 'webp', WEBP],
  ])(
    '%s thật 1×1 → 201 {mime %s}, lưu <id>.%s',
    async (_label, mime, ext, buf) => {
      // Content-Type client gửi sai cố ý: chỉ magic bytes quyết định
      const res = await upload(buf, `anh.${ext}`, 'application/octet-stream');
      expect(res.status).toBe(201);
      const body = res.body as { id: string; mime: string; size_bytes: number };
      expect(body).toMatchObject({ mime, size_bytes: buf.length });
      expect(existsSync(join(dir, `${body.id}.${ext}`))).toBe(true);
    },
  );

  it('dọn mồ côi: tệp 23 h 59 phút chưa tham chiếu → giữ; 24 h 01 phút → xóa (bản ghi + đĩa)', async () => {
    const id = async () =>
      (
        (await upload(WEBP, 'a.webp', 'image/webp').expect(201)).body as {
          id: string;
        }
      ).id;
    const young = await id();
    const old = await id();
    await ageBy(young, '23 hours 59 minutes');
    await ageBy(old, '24 hours 1 minute');
    await app.get(FilesCleanupJob).run(new Date());
    const left = await pool.query<{ id: string }>(
      'SELECT id FROM files WHERE id = ANY($1)',
      [[young, old]],
    );
    expect(left.rows.map((r) => r.id)).toEqual([young]);
    expect(existsSync(join(dir, `${young}.webp`))).toBe(true);
    expect(existsSync(join(dir, `${old}.webp`))).toBe(false);
  });
});
