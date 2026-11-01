import { INestApplication } from '@nestjs/common';
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

describe('sort_order mặc định khi tạo nhóm món / ĐVT = max + 10 (Postgres thật)', () => {
  let app: INestApplication<App>;
  let pool: Pool;

  const post = (path: string, body: object) =>
    request(app.getHttpServer())
      .post(path)
      .set('x-dev-user-sub', 'db-sort-admin')
      .set('x-dev-role', 'admin')
      .send(body);
  const sortOf = (r: request.Response) => {
    expect(r.status).toBe(201);
    return (r.body as { sort_order: number }).sort_order;
  };

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.query('DELETE FROM items');
    await pool.query('DELETE FROM item_categories');
    await pool.query('DELETE FROM units');
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
  });

  // Bảng ĐVT/nhóm bị xóa trắng: dựng lại schema + seed để e2e chạy sau không thiếu ĐVT gốc
  afterAll(async () => {
    await app?.close();
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.end();
  });

  describe.each([
    ['nhóm món', '/api/admin/item-categories', 'item_categories'],
    ['ĐVT', '/api/admin/units', 'units'],
  ])('%s', (_label, path, table) => {
    it('bảng trống, không gửi sort_order → 10', async () => {
      expect(sortOf(await post(path, { name: 'Đầu tiên' }))).toBe(10);
    });

    it('không gửi sort_order → max hiện có + 10 (max = 10 → 20, max = 995 → 1005)', async () => {
      expect(sortOf(await post(path, { name: 'Thứ hai' }))).toBe(20);
      expect(
        sortOf(await post(path, { name: 'Gửi rõ', sort_order: 995 })),
      ).toBe(995);
      expect(sortOf(await post(path, { name: 'Sau 995' }))).toBe(1005);
    });

    it('gửi sort_order rõ thì giữ nguyên, kể cả nhỏ hơn max (5) và 0', async () => {
      expect(sortOf(await post(path, { name: 'Rõ năm', sort_order: 5 }))).toBe(
        5,
      );
      expect(
        sortOf(await post(path, { name: 'Rõ không', sort_order: 0 })),
      ).toBe(0);
    });

    it('hai request tạo đồng thời → hai sort_order khác nhau, nối sau max', async () => {
      const [a, b] = await Promise.all([
        post(path, { name: 'Song song A' }),
        post(path, { name: 'Song song B' }),
      ]);
      expect([sortOf(a), sortOf(b)].sort((x, y) => x - y)).toEqual([
        1015, 1025,
      ]);
    });

    it('max + 10 không vượt trần DTO 1 000 000 (max 999 989 → 999 999, 999 990 → 1 000 000, 999 995 → 1 000 000, 1 000 000 → 1 000 000)', async () => {
      const after = async (max: number, tag: string) => {
        await pool.query(`DELETE FROM ${table} WHERE sort_order >= 999000`);
        sortOf(await post(path, { name: `Mốc ${tag}`, sort_order: max }));
        return sortOf(await post(path, { name: `Sau ${tag}` }));
      };
      expect(await after(999_989, 'a')).toBe(999_999);
      expect(await after(999_990, 'b')).toBe(1_000_000);
      expect(await after(999_995, 'c')).toBe(1_000_000);
      expect(await after(1_000_000, 'd')).toBe(1_000_000);
    });
  });
});
