import { HttpException } from '@nestjs/common';
import {
  AFTER_DEADLINE,
  BEFORE_DEADLINE,
  meRequestFixture,
} from './me-request.fixture';
import type { Line } from './me-request.fixture';
import { DRIZZLE_DB } from '../src/database/database.module';
import type { Database } from '../src/database/database.module';
import { RequestLinesWriter } from '../src/modules/requests/request-lines.writer';

describe('admin/requests: Hành chính tạo phiếu hộ', () => {
  const f = meRequestFixture('adminc');
  const { A, B, ADMIN, at, http, as, newItem, save, view, auditOf, pool } = f;
  const LOCKED = `e2e-req-locked-${f.SUFFIX}`;
  const FRESH = `e2e-req-fresh-${f.SUFFIX}`;
  const SA = 'local:sa';
  let item: string;
  let seededSa = false;

  const adminPost = (body: object) =>
    as(http().post('/api/admin/requests'), ADMIN, 'admin').send(body);
  const seed = async (lines: Line[], sub = A) =>
    view(await save(lines, {}, sub).expect(200));

  beforeAll(async () => {
    item = await newItem({ max_qty: 10 });
    await pool().query(
      `INSERT INTO users (sub, full_name, department, status) VALUES
         ($1, 'Hành chính', 'Phòng HC', 'active'),
         ($2, 'Người nghỉ', 'Phòng CT', 'locked'),
         ($3, 'Người mới', 'Phòng CT', 'active')`,
      [ADMIN, LOCKED, FRESH],
    );
    // ensureLocalSa tạo dòng users active cho SA mỗi lần đăng nhập; có thể đã có từ suite khác
    seededSa =
      (
        await pool().query(
          `INSERT INTO users (sub, full_name, status) VALUES ($1, 'SA', 'active')
           ON CONFLICT (sub) DO NOTHING`,
          [SA],
        )
      ).rowCount === 1;
  });

  f.onCleanup(async (pool) => {
    await pool.query(
      'DELETE FROM requests WHERE user_sub = $1 AND created_by_sub = $2',
      [SA, ADMIN],
    );
    if (seededSa) await pool.query('DELETE FROM users WHERE sub = $1', [SA]);
  });
  describe('POST admin/requests (tạo hộ)', () => {
    const owners = async (sub: string) =>
      (
        await pool().query<{ period: string; created_by_sub: string }>(
          `SELECT to_char(period_ym, 'YYYY-MM') AS period, created_by_sub
           FROM requests WHERE user_sub = $1`,
          [sub],
        )
      ).rows;

    it('người đã mở app nhưng chưa lưu → 201, created_by = Hành chính, dòng không phải added_by_admin', async () => {
      const res = await adminPost({
        user_sub: FRESH,
        lines: [{ item_id: item, qty: 2 }],
      }).expect(201);
      const r = view(res);
      expect(r).toMatchObject({ user_sub: FRESH, period_ym: '2026-11' });
      expect(r.lines[0]).toMatchObject({
        added_by_admin: false,
        readonly_for_member: false,
      });
      expect(await owners(FRESH)).toEqual([
        { period: '2026-11', created_by_sub: ADMIN },
      ]);
      const [detail] = await auditOf('request.created', r.id);
      expect(detail).toMatchObject({ owner_sub: FRESH, self: false });
    });

    it('sau hạn kỳ 11 → ghi vào kỳ 12 (luôn kỳ đang mở)', async () => {
      at(AFTER_DEADLINE);
      const res = await adminPost({
        user_sub: B,
        lines: [{ item_id: item, qty: 1 }],
      }).expect(201);
      expect(view(res).period_ym).toBe('2026-12');
      expect(await owners(B)).toEqual([
        { period: '2026-12', created_by_sub: ADMIN },
      ]);
    });

    it.each([
      ['người bị khóa', 400, 'USER_INACTIVE', () => LOCKED],
      ['sub lạ', 404, 'USER_NOT_FOUND', () => `e2e-req-ghost-${f.SUFFIX}`],
      ['SA cục bộ (không có trong danh bạ)', 404, 'USER_NOT_FOUND', () => SA],
    ])('%s → %s %s', async (_n, status, code, sub) => {
      const res = await adminPost({
        user_sub: sub(),
        lines: [{ item_id: item, qty: 1 }],
      }).expect(status);
      expect(res.body.code).toBe(code);
      expect(await owners(sub())).toEqual([]);
    });

    it('đã có phiếu kỳ đang mở → 409 REQUEST_EXISTS kèm request_id để mở Điều chỉnh', async () => {
      const existing = await seed([{ item_id: item, qty: 2 }]);
      const res = await adminPost({
        user_sub: A,
        lines: [{ item_id: item, qty: 1 }],
      }).expect(409);
      expect(res.body.code).toBe('REQUEST_EXISTS');
      expect(res.body.request_id).toBe(existing.id);
    });

    it('hai lần tạo hộ song song cùng người → một 201, lần kia 409 REQUEST_EXISTS (không STALE_UPDATE)', async () => {
      for (let round = 0; round < 10; round++) {
        await pool().query('DELETE FROM requests WHERE user_sub = $1', [B]);
        const results = await Promise.all(
          [1, 2].map((qty) =>
            adminPost({ user_sub: B, lines: [{ item_id: item, qty }] }),
          ),
        );
        const outcomes = results
          .map((r) => (r.status === 201 ? '201' : `${r.status} ${r.body.code}`))
          .sort();
        expect(outcomes).toEqual(['201', '409 REQUEST_EXISTS']);
        const created = results.find((r) => r.status === 201)!;
        const lost = results.find((r) => r.status === 409)!;
        expect(lost.body.request_id).toBe(view(created).id);
      }
    });

    it('không dòng nào → 400 LINES_EMPTY', async () => {
      const res = await adminPost({ user_sub: B, lines: [] }).expect(400);
      expect(res.body.code).toBe('LINES_EMPTY');
    });

    it('dòng tạo hộ là đăng ký của người đó → món admin_only bị chặn ADMIN_ONLY_ITEM', async () => {
      const paper = await newItem({ admin_only: true });
      const res = await adminPost({
        user_sub: B,
        lines: [{ item_id: paper, qty: 1 }],
      }).expect(400);
      expect(res.body).toMatchObject({
        code: 'ADMIN_ONLY_ITEM',
        line_index: 0,
      });
    });
  });

  describe('RequestLinesWriter mode admin khi chưa có phiếu', () => {
    const write = (period_ym: string, now: string, on_behalf = false) => {
      const db = f.app().get<Database>(DRIZZLE_DB);
      const writer = f.app().get(RequestLinesWriter);
      return db.transaction((tx) =>
        writer.save(tx, {
          request: null,
          owner_sub: B,
          period_ym,
          actor: { sub: ADMIN, role: 'admin' } as never,
          mode: 'admin',
          body: { lines: [{ item_id: item, qty: 1 }], reason: 'Bổ sung' },
          now: new Date(now),
          on_behalf,
        }),
      );
    };
    const bodyOf = (p: Promise<unknown>) =>
      p.then(
        () => ({ code: 'OK' }),
        (e: unknown) =>
          e instanceof HttpException
            ? (e.getResponse() as { code: string })
            : { code: (e as Error).message },
      );
    const codeOf = async (p: Promise<unknown>) => (await bodyOf(p)).code;

    it('kỳ chưa có dòng periods → INVALID_PERIOD (không 500 vì FK)', async () => {
      expect(await codeOf(write('2001-01', AFTER_DEADLINE))).toBe(
        'INVALID_PERIOD',
      );
    });

    it('kỳ đã khóa → PERIOD_LOCKED: không tạo phiếu mới cho kỳ đã khóa dù có lý do', async () => {
      expect(await codeOf(write('2026-11', AFTER_DEADLINE))).toBe(
        'PERIOD_LOCKED',
      );
      expect(await f.requestsOf(B)).toEqual([]);
    });

    it('tạo hộ (on_behalf) mà phiếu kỳ đó đã có (thua đua) → REQUEST_EXISTS kèm request_id, không STALE_UPDATE', async () => {
      const existing = await seed([{ item_id: item, qty: 2 }], B);
      expect(await bodyOf(write('2026-11', BEFORE_DEADLINE, true))).toEqual(
        expect.objectContaining({
          code: 'REQUEST_EXISTS',
          request_id: existing.id,
        }),
      );
    });
  });
});
