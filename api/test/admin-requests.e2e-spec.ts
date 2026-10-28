import { HttpException } from '@nestjs/common';
import { AFTER_DEADLINE, meRequestFixture } from './me-request.fixture';
import type { Line, RequestView } from './me-request.fixture';
import { DRIZZLE_DB } from '../src/database/database.module';
import type { Database } from '../src/database/database.module';
import { RequestLinesWriter } from '../src/modules/requests/request-lines.writer';

describe('admin/requests: Hành chính sửa phiếu, tạo hộ', () => {
  const f = meRequestFixture('admin');
  const { A, B, ADMIN, at, http, as, newItem, save, view, auditOf, pool } = f;
  const LOCKED = `e2e-req-locked-${f.SUFFIX}`;
  const FRESH = `e2e-req-fresh-${f.SUFFIX}`;
  const SA = 'local:sa';
  let item: string;
  let seededSa = false;

  const adminPut = (id: string, body: object, role = 'admin') =>
    as(http().put(`/api/admin/requests/${id}/lines`), ADMIN, role).send(body);
  const adminPost = (body: object) =>
    as(http().post('/api/admin/requests'), ADMIN, 'admin').send(body);
  const seed = async (lines: Line[], sub = A) =>
    view(await save(lines, {}, sub).expect(200));
  const keep = (r: RequestView): Line[] =>
    r.lines.map((l) => ({ id: l.id, qty: l.qty }));

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
  describe('PUT admin/requests/:id/lines', () => {
    it('member → 403', async () => {
      const r = await seed([{ item_id: item, qty: 2 }]);
      await adminPut(
        r.id,
        { lines: keep(r), expected_updated_at: r.updated_at },
        'member',
      ).expect(403);
    });

    it('thiếu expected_updated_at → 400 VALIDATION', async () => {
      const r = await seed([{ item_id: item, qty: 2 }]);
      const res = await adminPut(r.id, { lines: keep(r) }).expect(400);
      expect(res.body).toMatchObject({
        code: 'VALIDATION',
        fields: ['expected_updated_at'],
      });
    });

    it('phiếu không có → 404 REQUEST_NOT_FOUND', async () => {
      const res = await adminPut('00000000-0000-4000-8000-000000000000', {
        lines: [],
        expected_updated_at: '2026-11-01T00:00:00.000Z',
      }).expect(404);
      expect(res.body.code).toBe('REQUEST_NOT_FOUND');
    });

    it('sau hạn: không lý do / lý do < 3 ký tự sau trim → REASON_REQUIRED; có lý do → 200, audit ghi reason', async () => {
      const r = await seed([{ item_id: item, qty: 2 }]);
      at(AFTER_DEADLINE);
      const body = {
        lines: [{ id: r.lines[0].id, qty: 4 }],
        expected_updated_at: r.updated_at,
      };
      for (const reason of [undefined, '  ab  ']) {
        const res = await adminPut(r.id, { ...body, reason }).expect(400);
        expect(res.body.code).toBe('REASON_REQUIRED');
      }
      const res = await adminPut(r.id, {
        ...body,
        reason: '  Bổ sung theo email  ',
      }).expect(200);
      const after = view(res);
      expect(after.lines[0].qty).toBe(4);
      expect(after.is_open).toBe(false);
      const [detail] = await auditOf('request.updated', r.id);
      expect(detail).toMatchObject({
        reason: 'Bổ sung theo email',
        self: false,
        owner_sub: A,
      });
    });

    it('trong hạn không cần lý do', async () => {
      const r = await seed([{ item_id: item, qty: 2 }]);
      await adminPut(r.id, {
        lines: [{ id: r.lines[0].id, qty: 3 }],
        expected_updated_at: r.updated_at,
      }).expect(200);
    });

    it('admin giữ expected_updated_at cũ trong lúc member vừa lưu → 409 STALE_UPDATE', async () => {
      const r = await seed([{ item_id: item, qty: 2 }]);
      await save([{ id: r.lines[0].id, qty: 3 }], {
        expected_updated_at: r.updated_at,
      }).expect(200);
      const res = await adminPut(r.id, {
        lines: [{ id: r.lines[0].id, qty: 5 }],
        expected_updated_at: r.updated_at,
      }).expect(409);
      expect(res.body.code).toBe('STALE_UPDATE');
    });

    it('giảm qty dưới số đã giao → QTY_BELOW_DELIVERED {line_id, delivered}; bỏ dòng đã giao một phần → dòng còn nguyên', async () => {
      const other = await newItem();
      const r = await seed([
        { item_id: item, qty: 3 },
        { item_id: other, qty: 1 },
      ]);
      const delivered = r.lines.find((l) => l.item_id === item)!;
      await pool().query(
        'UPDATE request_lines SET delivered_qty = 2 WHERE id = $1',
        [delivered.id],
      );
      const low = await adminPut(r.id, {
        lines: keep(r).map((l) =>
          l.id === delivered.id ? { ...l, qty: 1 } : l,
        ),
        expected_updated_at: r.updated_at,
      }).expect(400);
      expect(low.body).toMatchObject({
        code: 'QTY_BELOW_DELIVERED',
        line_id: delivered.id,
        delivered: 2,
      });
      const res = await adminPut(r.id, {
        lines: keep(r).filter((l) => l.id !== delivered.id),
        expected_updated_at: r.updated_at,
      }).expect(200);
      expect(view(res).lines.map((l) => [l.id, l.qty])).toEqual(
        r.lines.map((l) => [l.id, l.qty]),
      );
    });

    it('thêm món admin_only → 200, added_by_admin; member thấy readonly_for_member', async () => {
      const paper = await newItem({ admin_only: true });
      const r = await seed([{ item_id: item, qty: 2 }]);
      const res = await adminPut(r.id, {
        lines: [...keep(r), { item_id: paper, qty: 3 }],
        expected_updated_at: r.updated_at,
      }).expect(200);
      const added = view(res).lines.find((l) => l.item_id === paper)!;
      expect(added.added_by_admin).toBe(true);
      const mine = await as(http().get('/api/me/request'), A).expect(200);
      const seen = (mine.body as RequestView).lines.find(
        (l) => l.item_id === paper,
      )!;
      expect(seen.readonly_for_member).toBe(true);
      expect(
        (mine.body as RequestView).lines.find((l) => l.item_id === item)!
          .added_by_admin,
      ).toBe(false);
    });

    it('Hành chính sửa phiếu của chính mình → audit self:true, lọc GET admin/audit?self=true thấy', async () => {
      const r = await seed([{ item_id: item, qty: 2 }], ADMIN);
      await adminPut(r.id, {
        lines: [{ id: r.lines[0].id, qty: 1 }],
        expected_updated_at: r.updated_at,
      }).expect(200);
      const [detail] = await auditOf('request.updated', r.id);
      expect(detail.self).toBe(true);
      const find = async (self: string) =>
        (
          (
            await as(http().get('/api/admin/audit'), ADMIN, 'admin')
              .query({ action: 'request.updated', actor: ADMIN, self })
              .expect(200)
          ).body as { items: { objectId: string }[] }
        ).items.map((i) => i.objectId);
      expect(await find('true')).toContain(r.id);
      expect(await find('false')).not.toContain(r.id);
    });

    it('member gửi reason khi lưu phiếu của mình → nhật ký không ghi reason', async () => {
      const r = await seed([{ item_id: item, qty: 2 }]);
      await save([{ id: r.lines[0].id, qty: 3 }], {
        expected_updated_at: r.updated_at,
        reason: 'tự ghi lý do',
      }).expect(200);
      const [detail] = await auditOf('request.updated', r.id);
      expect(detail).not.toHaveProperty('reason');
    });
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

    it('đã có phiếu kỳ đang mở → 409 REQUEST_EXISTS', async () => {
      await seed([{ item_id: item, qty: 2 }]);
      const res = await adminPost({
        user_sub: A,
        lines: [{ item_id: item, qty: 1 }],
      }).expect(409);
      expect(res.body.code).toBe('REQUEST_EXISTS');
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
    const write = (period_ym: string, now: string) => {
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
        }),
      );
    };
    const codeOf = (p: Promise<unknown>) =>
      p.then(
        () => 'OK',
        (e: unknown) =>
          e instanceof HttpException
            ? (e.getResponse() as { code: string }).code
            : (e as Error).message,
      );

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
  });
});
