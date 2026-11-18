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
const BOX = { title: 'Chủ quản đơn vị', title_en: 'Head of Dept.', name: '' };
const ADMIN_SUB = 'e2e-config-admin';
// Kết quả lượt đồng bộ danh bạ (mốc, số người, lỗi gần nhất) do sync ghi; không thuộc phạm vi PUT admin/config
const EDITABLE_CONFIG_SQL =
  "SELECT key, value FROM config WHERE key NOT LIKE 'directory\\_sync\\_%' ORDER BY key";

describe('admin/config + public-config', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let snapshot: Array<{ key: string; value: unknown }>;

  const asAdmin = (req: request.Test) =>
    req.set('x-dev-user-sub', ADMIN_SUB).set('x-dev-role', 'admin');
  const put = (body: unknown) =>
    asAdmin(request(app.getHttpServer()).put('/api/admin/config')).send(
      body as object,
    );

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    snapshot = (await pool.query('SELECT key, value FROM config')).rows;
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    for (const row of snapshot) {
      await pool.query('UPDATE config SET value = $2 WHERE key = $1', [
        row.key,
        JSON.stringify(row.value),
      ]);
    }
    // Chỉ xóa khóa test này có thể lỡ ghi; suite khác chạy song song có marker riêng
    await pool.query('DELETE FROM config WHERE key = ANY($1)', [
      ['constructor', 'toString', '__proto__'],
    ]);
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('GET public-config không phiên → 200 {pmh_portal_url}, không còn admin_contact, không lộ khóa khác', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/public-config')
      .expect(200);
    // Test không có PMH_ISSUER_URL → không có cổng PMH ID
    expect(res.body).toEqual({ pmh_portal_url: null });
  });

  it('GET public-config: pmh_portal_url = gốc của PMH_ISSUER_URL (dev → dev-admin, không để cứng de-admin)', async () => {
    process.env.PMH_ISSUER_URL = 'https://dev-admin.pmh.com.vn:8443/oidc';
    try {
      const res = await request(app.getHttpServer())
        .get('/api/public-config')
        .expect(200);
      expect(res.body.pmh_portal_url).toBe(
        'https://dev-admin.pmh.com.vn:8443/',
      );
    } finally {
      delete process.env.PMH_ISSUER_URL;
    }
  });

  it('GET admin/config: member → 403; admin → đủ khóa VPP, không còn admin_group/authorized_groups', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/config')
      .set('x-dev-user-sub', 'e2e-config-member')
      .set('x-dev-role', 'member')
      .expect(403);
    const res = await asAdmin(
      request(app.getHttpServer()).get('/api/admin/config'),
    ).expect(200);
    expect(Object.keys(res.body as object).sort()).toEqual([
      'default_max_qty',
      'registration_last_day',
      'reminder_days_left',
      'signature_boxes',
    ]);
  });

  it.each([
    [{ registration_last_day: 29 }, 'registration_last_day'],
    [{ registration_last_day: 2 }, 'registration_last_day'],
    [{ registration_last_day: '10' }, 'registration_last_day'],
    [{ reminder_days_left: 0 }, 'reminder_days_left'],
    [{ reminder_days_left: 8 }, 'reminder_days_left'],
    [{ signature_boxes: [] }, 'signature_boxes'],
    [{ signature_boxes: [BOX, BOX, BOX, BOX] }, 'signature_boxes'],
    [
      { signature_boxes: [BOX, { ...BOX, title: 'x'.repeat(61) }] },
      'signature_boxes.1.title',
    ],
    [
      { signature_boxes: [{ ...BOX, name: 'x'.repeat(201) }] },
      'signature_boxes.0.name',
    ],
    [{ signers: { head: 'A' } }, 'signers'],
    [{ default_max_qty: 0 }, 'default_max_qty'],
    [{ default_max_qty: 1000 }, 'default_max_qty'],
    [{ admin_group: 'x' }, 'admin_group'],
    [{ low_stock_notify: false }, 'low_stock_notify'],
    [{ admin_contact: 'Chị Lan' }, 'admin_contact'],
    [{ authorized_groups: ['IT'] }, 'authorized_groups'],
    [{ constructor: 'x' }, 'constructor'],
    [{ toString: 'x' }, 'toString'],
  ])('PUT %j → 400 CONFIG_INVALID field %s, không ghi', async (body, field) => {
    const before = await pool.query(EDITABLE_CONFIG_SQL);
    const res = await put(body).expect(400);
    expect(res.body).toMatchObject({ code: 'CONFIG_INVALID', field });
    const after = await pool.query(EDITABLE_CONFIG_SQL);
    expect(after.rows).toEqual(before.rows);
  });

  it.each([
    ['registration_last_day', 28],
    ['default_max_qty', 1],
    ['default_max_qty', 999],
  ])(
    'PUT %s = %d (biên trong) → 200, GET trả đúng giá trị',
    async (key, value) => {
      const res = await put({ [key]: value }).expect(200);
      expect(res.body[key]).toBe(value);
      const got = await asAdmin(
        request(app.getHttpServer()).get('/api/admin/config'),
      ).expect(200);
      expect(got.body[key]).toBe(value);
    },
  );

  it('PUT body thô {"__proto__":…} → 400 CONFIG_INVALID, không 500', async () => {
    const res = await put('{"__proto__": {"x": 1}}')
      .set('Content-Type', 'application/json')
      .expect(400);
    expect(res.body).toMatchObject({ code: 'CONFIG_INVALID' });
    const keys = await pool.query(
      "SELECT key FROM config WHERE key IN ('constructor', 'toString', '__proto__')",
    );
    expect(keys.rows).toEqual([]);
  });

  it('PUT hợp lệ một khóa + một khóa sai → 400, khóa hợp lệ cũng không ghi', async () => {
    await put({ default_max_qty: 30, registration_last_day: 29 }).expect(400);
    const res = await asAdmin(
      request(app.getHttpServer()).get('/api/admin/config'),
    ).expect(200);
    expect(res.body.default_max_qty).not.toBe(30);
  });

  it.each([1, 3])(
    'PUT signature_boxes %d ô → 200, thay cả mảng (không gộp), audit config.updated before/after',
    async (n) => {
      const first = [
        { ...BOX, name: 'Cũ' },
        { ...BOX, title: 'Người yêu cầu' },
      ];
      await put({ signature_boxes: first }).expect(200);
      const next = Array.from({ length: n }, (_, i) => ({
        title: `Ô ${i} ${'t'.repeat(50)}`.slice(0, 60),
        title_en: '',
        name: 'n'.repeat(200),
      }));
      const res = await put({ signature_boxes: next }).expect(200);
      expect(res.body.signature_boxes).toEqual(next);
      expect(res.body).not.toHaveProperty('admin_group');
      const audit = await pool.query(
        `SELECT object_id, detail FROM audit_log
         WHERE action = 'config.updated' AND actor = $1
         ORDER BY created_at DESC LIMIT 1`,
        [ADMIN_SUB],
      );
      expect(audit.rows[0]).toEqual({
        object_id: 'signature_boxes',
        detail: {
          before: { signature_boxes: first },
          after: { signature_boxes: next },
        },
      });
    },
  );

  it('PUT title dài đúng 60 → 200', async () => {
    const res = await put({
      signature_boxes: [{ ...BOX, title: 'x'.repeat(60) }],
    }).expect(200);
    expect(res.body.signature_boxes[0].title).toBe('x'.repeat(60));
  });

  it.each([1, 7])(
    'PUT reminder_days_left %d (registration_last_day 10) → 200',
    async (n) => {
      await put({ registration_last_day: 10 }).expect(200);
      const res = await put({ reminder_days_left: n }).expect(200);
      expect(res.body.reminder_days_left).toBe(n);
    },
  );

  it('registration_last_day 3: reminder 2 → 200; reminder 3 → 400 field reminder_days_left', async () => {
    await put({ registration_last_day: 3, reminder_days_left: 2 }).expect(200);
    const res = await put({ reminder_days_left: 3 }).expect(400);
    expect(res.body).toMatchObject({
      code: 'CONFIG_INVALID',
      field: 'reminder_days_left',
    });
    await put({ registration_last_day: 10 }).expect(200);
  });

  it('reminder hiện 7: chỉ vá registration_last_day 8 → 200; 7 → 400 field registration_last_day, không ghi', async () => {
    await put({ registration_last_day: 10, reminder_days_left: 7 }).expect(200);
    await put({ registration_last_day: 8 }).expect(200);
    const res = await put({ registration_last_day: 7 }).expect(400);
    expect(res.body).toMatchObject({
      code: 'CONFIG_INVALID',
      field: 'registration_last_day',
    });
    const got = await asAdmin(
      request(app.getHttpServer()).get('/api/admin/config'),
    ).expect(200);
    expect(got.body.registration_last_day).toBe(8);
    await put({ registration_last_day: 10, reminder_days_left: 3 }).expect(200);
  });

  it('PUT registration_last_day=12 → GET trả số 12 (hiệu lực ngay, không chờ cache)', async () => {
    await put({ registration_last_day: 12 }).expect(200);
    const res = await asAdmin(
      request(app.getHttpServer()).get('/api/admin/config'),
    ).expect(200);
    expect(res.body.registration_last_day).toBe(12);
  });
});
