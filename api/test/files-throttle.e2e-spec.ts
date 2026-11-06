import { INestApplication } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const SUB = 'e2e-filesthr-a';
const LIMIT = 5;

describe('GET /api/files/:id không tính vào giới hạn tốc độ (Đ48)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let dir: string;
  const saved = {
    ip: process.env.THROTTLE_IP_PER_MIN,
    user: process.env.THROTTLE_USER_PER_MIN,
    hops: process.env.TRUST_PROXY_HOPS,
  };

  const restore = (key: string, value: string | undefined): void => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  const as = (req: request.Test, ip: string) =>
    req
      .set('x-dev-user-sub', SUB)
      .set('x-dev-role', 'member')
      .set('X-Forwarded-For', ip);

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    dir = await mkdtemp(join(tmpdir(), 'vpp-files-thr-'));
    process.env.FILES_DIR = dir;
    process.env.AUTH_DEV_MODE = 'true';
    process.env.THROTTLE_IP_PER_MIN = String(LIMIT);
    process.env.THROTTLE_USER_PER_MIN = String(LIMIT);
    process.env.TRUST_PROXY_HOPS = '1';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    await pool.query(
      "DELETE FROM files WHERE uploaded_by_sub LIKE 'e2e-filesthr-%'",
    );
    await pool.end();
    await rm(dir, { recursive: true, force: true });
    delete process.env.FILES_DIR;
    delete process.env.AUTH_DEV_MODE;
    restore('THROTTLE_IP_PER_MIN', saved.ip);
    restore('THROTTLE_USER_PER_MIN', saved.user);
    restore('TRUST_PROXY_HOPS', saved.hops);
  });

  it(`${LIMIT + 3} lần GET ảnh cùng IP và user đều 200; route thường vẫn 429 ở giới hạn`, async () => {
    const up = await as(
      request(app.getHttpServer()).post('/api/files'),
      '203.0.113.90',
    )
      .field('purpose', 'item_image')
      .attach('file', PNG_1X1, { filename: 'a.png', contentType: 'image/png' })
      .expect(201);
    const id = (up.body as { id: string }).id;
    for (let i = 0; i < LIMIT + 3; i += 1) {
      await as(
        request(app.getHttpServer()).get(`/api/files/${id}`),
        '203.0.113.91',
      ).expect(200);
    }
    // Ảnh không làm cạn hạn mức của route khác cùng IP/user
    const me = () =>
      as(request(app.getHttpServer()).get('/api/auth/me'), '203.0.113.91');
    for (let i = 0; i < LIMIT; i += 1) await me().expect(200);
    await me().expect(429);
  });
});
