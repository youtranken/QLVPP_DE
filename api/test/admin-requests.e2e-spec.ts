import { AFTER_DEADLINE, meRequestFixture } from './me-request.fixture';
import type { Line, RequestView } from './me-request.fixture';

describe('admin/requests: Hành chính sửa phiếu', () => {
  const f = meRequestFixture('admin');
  const { A, ADMIN, at, http, as, newItem, save, view, auditOf, pool } = f;
  let item: string;

  const adminPut = (id: string, body: object, role = 'admin') =>
    as(http().put(`/api/admin/requests/${id}/lines`), ADMIN, role).send(body);
  const seed = async (lines: Line[], sub = A) =>
    view(await save(lines, {}, sub).expect(200));
  // Hành chính không lưu được me/request → phiếu của Hành chính là dữ liệu cũ, dựng bằng SQL
  const seedLegacy = async (sub: string, qty: number) => {
    const id = (
      await pool().query<{ id: string }>(
        `INSERT INTO requests (period_ym, user_sub, created_by_sub)
         VALUES ('2026-11-01', $1, $1) RETURNING id`,
        [sub],
      )
    ).rows[0].id;
    await pool().query(
      'INSERT INTO request_lines (request_id, item_id, qty) VALUES ($1, $2, $3)',
      [id, item, qty],
    );
    return (
      await as(http().get(`/api/admin/requests/${id}`), ADMIN, 'admin').expect(
        200,
      )
    ).body as RequestView;
  };
  const keep = (r: RequestView): Line[] =>
    r.lines.map((l) => ({ id: l.id, qty: l.qty }));

  beforeAll(async () => {
    item = await newItem({ max_qty: 10 });
    await pool().query(
      `INSERT INTO users (sub, full_name, department, status) VALUES ($1, 'Hành chính', 'Phòng HC', 'active')`,
      [ADMIN],
    );
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

    it('thêm dòng ngoài DM không ảnh → 200; ảnh Hành chính tải → 200; ảnh của người khác → 403 FILE_FORBIDDEN', async () => {
      const r = await seed([{ item_id: item, qty: 2 }]);
      at(AFTER_DEADLINE);
      const base = { custom_name: 'Kẹp lạ', custom_unit: 'cai', qty: 1 };
      const reason = 'Bổ sung theo email';
      const none = await adminPut(r.id, {
        lines: [...keep(r), base],
        expected_updated_at: r.updated_at,
        reason,
      }).expect(200);
      const added = (none.body as { request: RequestView }).request;
      expect(added.lines.find((l) => l.custom_name === 'Kẹp lạ')).toMatchObject(
        { image_file_id: null },
      );
      const own = await adminPut(r.id, {
        lines: [
          ...keep(added),
          {
            ...base,
            custom_name: 'Kẹp có ảnh',
            image_file_id: await f.upload(ADMIN, 'line_image', 'admin'),
          },
        ],
        expected_updated_at: added.updated_at,
        reason,
      }).expect(200);
      const next = (own.body as { request: RequestView }).request;
      const bad = await adminPut(r.id, {
        lines: [
          ...keep(next),
          {
            ...base,
            custom_name: 'Kẹp ảnh lạ',
            image_file_id: await f.upload(f.B),
          },
        ],
        expected_updated_at: next.updated_at,
        reason,
      }).expect(403);
      expect(bad.body).toMatchObject({ code: 'FILE_FORBIDDEN' });
    });

    it('thiếu expected_updated_at → 400 VALIDATION', async () => {
      const r = await seed([{ item_id: item, qty: 2 }]);
      const res = await adminPut(r.id, { lines: keep(r) }).expect(400);
      expect(res.body).toMatchObject({
        code: 'VALIDATION',
        fields: ['expected_updated_at'],
      });
    });

    it("expected_updated_at 'hôm qua' / ngày không có thật / năm 0000, 1999 → 400 VALIDATION {fields: [expected_updated_at]}", async () => {
      const r = await seed([{ item_id: item, qty: 2 }]);
      for (const stamp of [
        'hôm qua',
        '2026-02-30T00:00:00Z',
        '0000-01-01T00:00:00Z',
        '1999-12-31T23:59:59Z',
      ]) {
        const res = await adminPut(r.id, {
          lines: keep(r),
          expected_updated_at: stamp,
        }).expect(400);
        expect(res.body).toMatchObject({
          code: 'VALIDATION',
          fields: ['expected_updated_at'],
        });
      }
    });

    it('reason 501 ký tự → 400 VALIDATION {fields: [reason]}; 500 ký tự → 200, audit lưu đủ 500', async () => {
      const r = await seed([{ item_id: item, qty: 2 }]);
      at(AFTER_DEADLINE);
      const body = {
        lines: [{ id: r.lines[0].id, qty: 3 }],
        expected_updated_at: r.updated_at,
      };
      const long = await adminPut(r.id, {
        ...body,
        reason: 'r'.repeat(501),
      }).expect(400);
      expect(long.body).toMatchObject({
        code: 'VALIDATION',
        fields: ['reason'],
      });
      await adminPut(r.id, { ...body, reason: 'r'.repeat(500) }).expect(200);
      const [detail] = await auditOf('request.updated', r.id);
      expect(detail).toMatchObject({ reason: 'r'.repeat(500) });
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

    it('mốc hạn: 23:59:59.999 ngày 10 → 409 PERIOD_NOT_LOCKED {ym, deadline}, phiếu không đổi; 00:00:00.000 ngày 11 thiếu lý do → REASON_REQUIRED, lý do "  abc  " (đúng 3 ký tự sau trim) → 200', async () => {
      const r = await seed([{ item_id: item, qty: 2 }]);
      f.freeze('2026-11-10T16:59:59.999Z');
      const body = {
        lines: [{ id: r.lines[0].id, qty: 4 }],
        expected_updated_at: r.updated_at,
      };
      const open = await adminPut(r.id, { ...body, reason: 'Bổ sung' }).expect(
        409,
      );
      expect(open.body).toMatchObject({
        code: 'PERIOD_NOT_LOCKED',
        ym: '2026-11',
        deadline: '2026-11-10T17:00:00.000Z',
      });
      expect(await auditOf('request.updated', r.id)).toEqual([]);
      f.freeze('2026-11-10T17:00:00.000Z');
      const missing = await adminPut(r.id, body).expect(400);
      expect(missing.body.code).toBe('REASON_REQUIRED');
      const res = await adminPut(r.id, { ...body, reason: '  abc  ' }).expect(
        200,
      );
      expect(view(res)).toMatchObject({ is_open: false });
      const details = await auditOf('request.updated', r.id);
      expect(details).toContainEqual(
        expect.objectContaining({ reason: 'abc' }),
      );
    });

    it('admin giữ expected_updated_at cũ trong lúc member vừa lưu (trước khóa) → 409 STALE_UPDATE', async () => {
      const r = await seed([{ item_id: item, qty: 2 }]);
      await save([{ id: r.lines[0].id, qty: 3 }], {
        expected_updated_at: r.updated_at,
      }).expect(200);
      at(AFTER_DEADLINE);
      const res = await adminPut(r.id, {
        lines: [{ id: r.lines[0].id, qty: 5 }],
        expected_updated_at: r.updated_at,
        reason: 'Bổ sung',
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
      at(AFTER_DEADLINE);
      const low = await adminPut(r.id, {
        lines: keep(r).map((l) =>
          l.id === delivered.id ? { ...l, qty: 1 } : l,
        ),
        expected_updated_at: r.updated_at,
        reason: 'Giảm theo kho',
      }).expect(400);
      expect(low.body).toMatchObject({
        code: 'QTY_BELOW_DELIVERED',
        line_id: delivered.id,
        delivered: 2,
      });
      const res = await adminPut(r.id, {
        lines: keep(r).filter((l) => l.id !== delivered.id),
        expected_updated_at: r.updated_at,
        reason: 'Giảm theo kho',
      }).expect(200);
      expect(view(res).lines.map((l) => [l.id, l.qty])).toEqual(
        r.lines.map((l) => [l.id, l.qty]),
      );
    });

    it('giảm qty đúng bằng số đã giao 2 → 200; qty 1 → QTY_BELOW_DELIVERED {delivered: 2}', async () => {
      const r = await seed([{ item_id: item, qty: 3 }]);
      const line = r.lines[0];
      await pool().query(
        'UPDATE request_lines SET delivered_qty = 2 WHERE id = $1',
        [line.id],
      );
      at(AFTER_DEADLINE);
      const low = await adminPut(r.id, {
        lines: [{ id: line.id, qty: 1 }],
        expected_updated_at: r.updated_at,
        reason: 'Giảm theo kho',
      }).expect(400);
      expect(low.body).toMatchObject({
        code: 'QTY_BELOW_DELIVERED',
        line_id: line.id,
        delivered: 2,
      });
      const res = await adminPut(r.id, {
        lines: [{ id: line.id, qty: 2 }],
        expected_updated_at: r.updated_at,
        reason: 'Giảm theo kho',
      }).expect(200);
      expect(view(res).lines[0]).toMatchObject({ id: line.id, qty: 2 });
    });

    it('thêm món admin_only → 200, added_by_admin; member thấy readonly_for_member', async () => {
      const paper = await newItem({ admin_only: true });
      const r = await seed([{ item_id: item, qty: 2 }]);
      at(AFTER_DEADLINE);
      const res = await adminPut(r.id, {
        lines: [...keep(r), { item_id: paper, qty: 3 }],
        expected_updated_at: r.updated_at,
        reason: 'Bổ sung giấy',
      }).expect(200);
      const added = view(res).lines.find((l) => l.item_id === paper)!;
      expect(added.added_by_admin).toBe(true);
      const mine = await as(http().get('/api/me/request?ym=2026-11'), A).expect(
        200,
      );
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
      at(AFTER_DEADLINE);
      const r = await seedLegacy(ADMIN, 2);
      await adminPut(r.id, {
        lines: [{ id: r.lines[0].id, qty: 1 }],
        expected_updated_at: r.updated_at,
        reason: 'Giảm còn 1',
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
});
