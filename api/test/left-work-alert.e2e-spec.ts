import { INestApplication } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { MailOutbox } from '../src/modules/mail/mail-outbox';
import { MAIL_TRANSPORT } from '../src/modules/mail/mail-transport';
import { PeriodsService } from '../src/modules/periods/periods.service';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import type { DirectoryUser } from '../src/modules/users/directory.client';
import { DirectorySyncService } from '../src/modules/users/directory-sync.service';
import { directoryStub } from './directory.stub';
import { fakeMailTransport } from './mail.fake';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const SECRET = 'whsec-left-work-e2e';
const CLIENT_ID = 'client_vpp_left_work_e2e';
const P = `e2e-left-${process.pid}-${Date.now().toString(36)}-`;
const ADMINS = [`${P}admin-1`, `${P}admin-2`];
// Kỳ rất cũ: luôn đã khoá so với đồng hồ thật
const LOCKED_YM = '2001-04-01';
let seq = BigInt(Date.now()) * 1000n;
const nextSeq = () => (seq += 10n).toString();

describe('Báo Hành chính khi người mất quyền còn việc dở (mục 6 chuẩn PMH ID)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  const itemIds: string[] = [];
  let openYm: string;
  const mail = fakeMailTransport();
  const listed: DirectoryUser[] = [];
  const events: string[] = [];
  const originalSecret = process.env.PMH_WEBHOOK_SECRET;
  const originalClient = process.env.PMH_CLIENT_ID;

  const q = <T extends object = Record<string, unknown>>(
    text: string,
    params: unknown[] = [],
  ) => pool.query<T>(text, params);

  const webhook = async (type: string, sub: string, eventId = nextSeq()) => {
    events.push(eventId);
    const body = JSON.stringify({
      type,
      user_id: sub,
      event_id: eventId,
      detail: { client_id: CLIENT_ID },
      at: new Date().toISOString(),
    });
    const ts = String(Math.floor(Date.now() / 1000));
    await request(app.getHttpServer())
      .post('/api/webhooks/pmh-id')
      .set('Content-Type', 'application/json')
      .set('X-PMH-Timestamp', ts)
      .set(
        'X-PMH-Signature-V2',
        createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex'),
      )
      .send(body)
      .expect(200);
    return { body, ts };
  };

  const newUser = async (tag: string) => {
    const sub = `${P}${tag}`;
    await q(
      `INSERT INTO users (sub, full_name, email, status) VALUES ($1, $2, $3, 'active')`,
      [sub, `Người ${tag}`, `${tag}@vpp.test`],
    );
    return sub;
  };

  const request_ = async (sub: string, ym: string) =>
    (
      await q<{ id: string }>(
        `INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ($1, $2, $2) RETURNING id`,
        [ym, sub],
      )
    ).rows[0].id;

  const catalogLine = async (
    requestId: string,
    qty = 3,
    delivered = 0,
    item = 0,
  ): Promise<void> => {
    await q(
      `INSERT INTO request_lines (request_id, item_id, qty, delivered_qty) VALUES ($1, $2, $3, $4)`,
      [requestId, itemIds[item], qty, delivered],
    );
  };

  const customPending = async (requestId: string): Promise<void> => {
    await q(
      `INSERT INTO request_lines (request_id, custom_name, custom_unit, qty, review_status)
       VALUES ($1, 'Bìa còng lạ', 'cay', 1, 'pending')`,
      [requestId],
    );
  };

  const alerts = (sub: string) =>
    q<{
      user_sub: string;
      event_id: string;
      params: Record<string, unknown>;
      link: string;
    }>(
      `SELECT user_sub, event_id, params, link FROM in_app_notifications
       WHERE topic = 'user_left_with_work' AND event_id LIKE $1 AND user_sub = ANY($2)
       ORDER BY event_id, user_sub`,
      [`left-work:${sub}:%`, ADMINS],
    );

  const audits = (sub: string, action: string) =>
    q<{ detail: Record<string, unknown> }>(
      `SELECT detail FROM audit_log WHERE action = $1 AND object_id = $2`,
      [action, sub],
    );

  const mailsFor = async (sub: string) => {
    await app.get(MailOutbox).idle();
    return mail.sent.filter((m) =>
      m.subject.includes(`Người ${sub.slice(P.length)} `),
    );
  };

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    for (const [i, sub] of ADMINS.entries()) {
      await q(
        `INSERT INTO users (sub, full_name, email, role, status) VALUES ($1, $2, $3, 'admin', 'active')`,
        [sub, `HC ${i + 1}`, `hc${i + 1}-${process.pid}@vpp.test`],
      );
    }
    await q(
      `INSERT INTO periods (ym, deadline) VALUES ($1, '2001-04-10T17:00:00Z') ON CONFLICT (ym) DO NOTHING`,
      [LOCKED_YM],
    );
    for (const n of [1, 2, 3]) {
      const { rows } = await q<{ id: string }>(
        `INSERT INTO items (name, unit, max_qty) VALUES ($1, 'cay', 50) RETURNING id`,
        [`${P}item-${n}`],
      );
      itemIds.push(rows[0].id);
    }
    process.env.PMH_WEBHOOK_SECRET = SECRET;
    process.env.PMH_CLIENT_ID = CLIENT_ID;
    // Danh bạ = mọi user SSO khác trong DB test giữ nguyên status/role (đối chiếu không coi ai là vắng)
    // + kịch bản của test; chi tiết chỉ trả cho user của suite này
    const directory = directoryStub([], {
      fetchUsers: async () => {
        const mine = new Set(listed.map((u) => u.id));
        const others = await q<{
          sub: string;
          status: string;
          role: string;
          email: string | null;
          full_name: string | null;
        }>(
          `SELECT sub, status, role, email, full_name FROM users
           WHERE status IN ('active','locked') AND sub NOT LIKE 'local%'`,
        );
        return [
          ...others.rows
            .filter((r) => !mine.has(r.sub))
            .map(
              (r) =>
                ({
                  id: r.sub,
                  status: r.status,
                  app_role: r.role,
                  email: r.email,
                  full_name: r.full_name,
                }) as DirectoryUser,
            ),
          ...listed,
        ];
      },
      fetchUser: (id: string) =>
        id.startsWith(P)
          ? Promise.resolve({ id, status: 'active' } as DirectoryUser)
          : Promise.reject(new Error('không thuộc suite này')),
    });
    app = (await createTestApp(
      [],
      [
        { token: DIRECTORY_CLIENT, useValue: directory },
        { token: MAIL_TRANSPORT, useValue: mail },
      ],
    )) as INestApplication<App>;
    openYm = `${(await app.get(PeriodsService).openPeriod()).ym}-01`;
  });

  afterAll(async () => {
    await app.close();
    const mine = `${P}%`;
    await q(`DELETE FROM in_app_notifications WHERE event_id LIKE $1`, [
      `left-work:${mine}`,
    ]);
    await q(`DELETE FROM in_app_notifications WHERE user_sub LIKE $1`, [mine]);
    await q(`DELETE FROM requests WHERE user_sub LIKE $1`, [mine]);
    await q(`DELETE FROM items WHERE id = ANY($1)`, [itemIds]);
    await q(`DELETE FROM sessions WHERE user_sub LIKE $1`, [mine]);
    await q(`DELETE FROM webhook_user_order WHERE sub LIKE $1`, [mine]);
    await q(`DELETE FROM users WHERE sub LIKE $1`, [mine]);
    await q(`DELETE FROM processed_webhook_events WHERE event_id = ANY($1)`, [
      events,
    ]);
    await pool.end();
    if (originalSecret === undefined) delete process.env.PMH_WEBHOOK_SECRET;
    else process.env.PMH_WEBHOOK_SECRET = originalSecret;
    if (originalClient === undefined) delete process.env.PMH_CLIENT_ID;
    else process.env.PMH_CLIENT_ID = originalClient;
  });

  it('bị khoá khi còn nợ kỳ đã khoá + món chờ duyệt → mỗi HC active một chuông, đúng một email; gửi lại cùng sự kiện / sự kiện kế / sync kế → không thêm', async () => {
    const sub = await newUser('owe');
    const r = await request_(sub, LOCKED_YM);
    await catalogLine(r, 3, 1);
    await catalogLine(r, 2, 0, 1);
    await catalogLine(r, 2, 2, 2); // đã giao đủ → không tính
    await customPending(r);
    await catalogLine(await request_(sub, openYm), 1);

    const first = await webhook('user.locked', sub);
    const rows = (await alerts(sub)).rows;
    expect(rows.map((x) => x.user_sub)).toEqual(ADMINS);
    expect(new Set(rows.map((x) => x.event_id)).size).toBe(1);
    expect(rows[0].event_id).toMatch(new RegExp(`^left-work:${sub}:\\d+$`));
    expect(rows[0].params).toEqual({
      name: 'Người owe',
      reason: 'locked',
      owed_lines: 2,
      owed_months: 1,
      pending_lines: 1,
      open_request: true,
    });
    expect(rows[0].link).toBe(
      `/admin/delivery?person=${encodeURIComponent(sub)}`,
    );
    const sent = await mailsFor(sub);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(
      expect.arrayContaining(
        ADMINS.map((_, i) => `hc${i + 1}-${process.pid}@vpp.test`),
      ),
    );
    expect(sent[0].text).toContain(
      'Người owe bị khoá nhưng còn 2 món chưa nhận (1 tháng), 1 món ngoài danh mục chờ duyệt. Có phiếu kỳ đang mở.',
    );
    expect((await audits(sub, 'users.left_with_work')).rows).toHaveLength(1);

    // PMH ID gửi lại đúng sự kiện đó (cùng event_id, chữ ký mới)
    const again = JSON.parse(first.body) as { event_id: string };
    await webhook('user.locked', sub, again.event_id);
    // Sự kiện kế trong cùng lần mất quyền: đang khoá thì mất quyền vào VPP (mốc inactive_at đặt lại), rồi bị xoá
    await webhook('user.access_revoked', sub);
    await webhook('user.deleted', sub);
    // Sync kế vẫn báo deleted
    listed.splice(0, listed.length, {
      id: sub,
      status: 'deleted',
    } as DirectoryUser);
    await app.get(DirectorySyncService).sync('system');
    listed.length = 0;

    expect((await alerts(sub)).rows).toHaveLength(2);
    expect(await mailsFor(sub)).toHaveLength(1);
    expect((await audits(sub, 'users.left_with_work')).rows).toHaveLength(1);
  });

  it('mất quyền vào VPP (access_revoked) chỉ còn món chờ duyệt → chuông lý do no_access, link Duyệt món', async () => {
    const sub = await newUser('pending');
    await customPending(await request_(sub, LOCKED_YM));
    await webhook('user.access_revoked', sub);
    const rows = (await alerts(sub)).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0].params).toMatchObject({
      reason: 'no_access',
      owed_lines: 0,
      pending_lines: 1,
      open_request: false,
    });
    expect(rows[0].link).toBe('/admin/review');
    expect(await mailsFor(sub)).toHaveLength(1);
  });

  it('đồng bộ định kỳ thấy người đang active bị khoá ở PMH ID → báo (đường sync)', async () => {
    const sub = await newUser('sync');
    await catalogLine(await request_(sub, LOCKED_YM), 4);
    listed.splice(0, listed.length, {
      id: sub,
      status: 'locked',
      full_name: 'Người sync',
      email: 'sync@vpp.test',
    } as DirectoryUser);
    await app.get(DirectorySyncService).sync('system');
    listed.length = 0;
    expect((await alerts(sub)).rows).toHaveLength(2);
    expect((await alerts(sub)).rows[0].params).toMatchObject({
      reason: 'locked',
      owed_lines: 1,
    });
    expect(await mailsFor(sub)).toHaveLength(1);
  });

  it('không còn việc dở (đã giao hết) → không chuông, không email, chỉ nhật ký', async () => {
    const sub = await newUser('done');
    await catalogLine(await request_(sub, LOCKED_YM), 2, 2);
    await webhook('user.locked', sub);
    expect((await alerts(sub)).rows).toHaveLength(0);
    expect(await mailsFor(sub)).toHaveLength(0);
    const audit = (await audits(sub, 'users.left_no_work')).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0].detail).toEqual({ reason: 'locked', open_request: false });
  });

  it('chỉ có phiếu kỳ đang mở → không chuông (chỉ nhắc trong nội dung), nhật ký ghi có phiếu kỳ mở', async () => {
    const sub = await newUser('open');
    await catalogLine(await request_(sub, openYm), 2);
    await webhook('user.deleted', sub);
    expect((await alerts(sub)).rows).toHaveLength(0);
    expect(await mailsFor(sub)).toHaveLength(0);
    expect((await audits(sub, 'users.left_no_work')).rows[0].detail).toEqual({
      reason: 'deleted',
      open_request: true,
    });
  });

  it('được mở lại rồi mất quyền lần nữa → báo lần mới (event_id khác)', async () => {
    const sub = await newUser('again');
    await catalogLine(await request_(sub, LOCKED_YM), 1);
    await webhook('user.locked', sub);
    expect((await alerts(sub)).rows).toHaveLength(2);
    await webhook('user.unlocked', sub);
    const status = await q<{ status: string }>(
      'SELECT status FROM users WHERE sub = $1',
      [sub],
    );
    expect(status.rows[0].status).toBe('active');
    await webhook('user.locked', sub);
    const rows = (await alerts(sub)).rows;
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((x) => x.event_id)).size).toBe(2);
    expect(await mailsFor(sub)).toHaveLength(2);
  });
});
