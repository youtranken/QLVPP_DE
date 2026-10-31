import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const FILE = '0112_config_signature_boxes.sql';
const box = (title: string, title_en: string, name: string) => ({
  title,
  title_en,
  name,
});

describe('0112 config: signers → signature_boxes, seed reminder_days_left', () => {
  let pool: Pool;

  const configValue = async (key: string) =>
    (
      await pool.query<{ value: unknown }>(
        'SELECT value FROM config WHERE key = $1',
        [key],
      )
    ).rows[0]?.value;

  // Đưa DB về trạng thái trước 0112 với config cũ rồi chạy lại runner
  async function reapplyFrom(signers: object | null, lastDay: number) {
    await pool.query('DELETE FROM _migrations WHERE name = $1', [FILE]);
    await pool.query(
      "DELETE FROM config WHERE key IN ('signature_boxes', 'reminder_days_left', 'signers')",
    );
    if (signers) {
      await pool.query(
        "INSERT INTO config (key, value) VALUES ('signers', $1::jsonb)",
        [JSON.stringify(signers)],
      );
    }
    await pool.query(
      "UPDATE config SET value = $1::jsonb WHERE key = 'registration_last_day'",
      [JSON.stringify(lastDay)],
    );
    expect(await runMigrations(pool, resolveMigrationsDir(), silent)).toEqual([
      FILE,
    ]);
  }

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await runMigrations(pool, resolveMigrationsDir(), silent);
  });

  afterAll(async () => {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.end();
  });

  it('DB mới: 2 ô ký mẫu D&E tên trống, reminder_days_left 3, không còn signers', async () => {
    expect(await configValue('signature_boxes')).toEqual([
      box('Chủ quản đơn vị', 'Head of Dept.', ''),
      box('Người yêu cầu', 'Applicant', ''),
    ]);
    expect(await configValue('reminder_days_left')).toBe(3);
    expect(await configValue('signers')).toBeUndefined();
  });

  it("signers {head:'A', preparer:'B', approver:'C'} → 2 ô: Chủ quản đơn vị = A, Người yêu cầu = B; approver bỏ; signers bị xóa", async () => {
    await reapplyFrom({ head: 'A', preparer: 'B', approver: 'C' }, 10);
    expect(await configValue('signature_boxes')).toEqual([
      box('Chủ quản đơn vị', 'Head of Dept.', 'A'),
      box('Người yêu cầu', 'Applicant', 'B'),
    ]);
    expect(await configValue('signers')).toBeUndefined();
    expect(await configValue('reminder_days_left')).toBe(3);
  });

  it('signers thiếu khóa → tên trống; registration_last_day 3 → reminder_days_left 2, 4 → 3 (≤ hạn − 1)', async () => {
    await reapplyFrom({ preparer: 'B' }, 3);
    expect(await configValue('signature_boxes')).toEqual([
      box('Chủ quản đơn vị', 'Head of Dept.', ''),
      box('Người yêu cầu', 'Applicant', 'B'),
    ]);
    expect(await configValue('reminder_days_left')).toBe(2);
    await reapplyFrom(null, 4);
    expect(await configValue('reminder_days_left')).toBe(3);
  });

  it('chạy lại nội dung 0112 khi đã có signature_boxes/reminder_days_left → không ghi đè', async () => {
    const custom = [box('Duyệt', '', 'X')];
    await pool.query(
      "UPDATE config SET value = $1::jsonb WHERE key = 'signature_boxes'",
      [JSON.stringify(custom)],
    );
    await pool.query(
      "UPDATE config SET value = '5' WHERE key = 'reminder_days_left'",
    );
    await pool.query(
      await readFile(join(resolveMigrationsDir(), FILE), 'utf8'),
    );
    expect(await configValue('signature_boxes')).toEqual(custom);
    expect(await configValue('reminder_days_left')).toBe(5);
  });
});
