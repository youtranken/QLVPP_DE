import { copyFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };

describe('migration 0129: bỏ items.admin_only (G7)', () => {
  let pool: Pool;

  async function migrateBelow(lastExclusive: string): Promise<void> {
    const dir = await mkdtemp(join(tmpdir(), 'vpp-mig-0129-'));
    try {
      const all = await readdir(resolveMigrationsDir());
      for (const f of all.filter(
        (n) => n.endsWith('.sql') && n < lastExclusive,
      )) {
        await copyFile(join(resolveMigrationsDir(), f), join(dir, f));
      }
      await runMigrations(pool, dir, silent);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  async function reset(): Promise<void> {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await migrateBelow('0129');
  }

  beforeAll(() => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
  });

  afterAll(async () => {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.end();
  });

  it('còn món admin_only = true → migration dừng, cột vẫn còn', async () => {
    await reset();
    await pool.query(
      `INSERT INTO items (name, unit, admin_only) VALUES ('Giấy A4', 'ram', true)`,
    );
    await expect(
      runMigrations(pool, resolveMigrationsDir(), silent),
    ).rejects.toThrow(/admin_only/);
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'admin_only'`,
    );
    expect(rows).toHaveLength(1);
  });

  it('không món nào admin_only → cột admin_only không còn', async () => {
    await reset();
    await pool.query(
      `INSERT INTO items (name, unit, admin_only) VALUES ('Bút bi', 'cay', false)`,
    );
    await runMigrations(pool, resolveMigrationsDir(), silent);
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'admin_only'`,
    );
    expect(rows).toHaveLength(0);
  });
});
