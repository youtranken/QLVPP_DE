import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
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

  it('cursor hỏng → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/audit')
      .query({ cursor: 'rac' })
      .set('x-dev-user-sub', 'dev-admin')
      .set('x-dev-role', 'admin')
      .expect(400);
  });
});
