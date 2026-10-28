import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { ITEM_USAGE_HOOK } from '../src/modules/catalog/item-usage.hook';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
export const ADMIN = 'db-stock-admin';
export const RECEIVER = 'db-stock-receiver';
export const LOCKED = 'db-stock-locked';

export interface Movement {
  id: string;
  delta: number;
  reason: string;
  note: string | null;
  actor_sub: string;
  recipient_sub: string | null;
}

// App + pool + người nhận cho các suite kho; đăng ký hook jest của suite gọi nó
export function stockFixture() {
  let app: INestApplication<App>;
  let pool: Pool;
  const usageHook = { isUsed: jest.fn().mockResolvedValue(false) };

  const http = () => request(app.getHttpServer());
  const admin = (req: request.Test) =>
    req.set('x-dev-user-sub', ADMIN).set('x-dev-role', 'admin');
  const stock = (id: string, body: object) =>
    admin(http().post(`/api/admin/items/${id}/stock`)).send(body);
  const issue = (id: string, body: object) =>
    admin(http().post(`/api/admin/items/${id}/issue`)).send(body);
  const qtyOf = async (id: string) =>
    (
      await pool.query<{ stock_qty: number; low: Date | null }>(
        'SELECT stock_qty, low_stock_notified_at AS low FROM items WHERE id = $1',
        [id],
      )
    ).rows[0];
  const newItem = async (stockQty = 0) =>
    (
      await pool.query<{ id: string }>(
        "INSERT INTO items (name, unit, stock_qty) VALUES ('Giấy A4 db', 'ram', $1) RETURNING id",
        [stockQty],
      )
    ).rows[0].id;
  const movements = async (id: string) =>
    (await admin(http().get(`/api/admin/items/${id}/movements`)).expect(200))
      .body as { items: Movement[]; next_cursor: string | null };

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.query(
      `INSERT INTO users (sub, full_name, status) VALUES
         ($1, 'Người nhận', 'active'), ($2, 'Đã khóa', 'locked')
       ON CONFLICT (sub) DO UPDATE SET status = EXCLUDED.status`,
      [RECEIVER, LOCKED],
    );
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp(
      [],
      [{ token: ITEM_USAGE_HOOK, useValue: usageHook }],
    )) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  return {
    http,
    admin,
    stock,
    issue,
    qtyOf,
    newItem,
    movements,
    usageHook,
    pool: () => pool,
  };
}
