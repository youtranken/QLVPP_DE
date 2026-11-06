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
    r.lines.map((l) => ({ id: l.id, qty: l.qty, expected_qty: l.qty }));
  const reduce = (r: RequestView, qty: number): Line[] => [
    {
      id: r.lines[0].id,
      qty,
      expected_qty: r.lines[0].qty,
      reason_code: 'over_quota',
    },
  ];

  beforeAll(async () => {
    item = await newItem({ max_qty: 10 });
    await pool().query(
      `INSERT INTO users (sub, full_name, department, status) VALUES ($1, 'Hành chính', 'Phòng HC', 'active')`,
      [ADMIN],
    );
  });

  it('GET admin/requests/:id: mỗi dòng có max_qty hiện tại của món (hạ sau khi lưu vẫn thấy số mới); dòng ngoài DM → null', async () => {
    const r = await seed([{ item_id: item, qty: 2 }, f.custom()]);
    await pool().query('UPDATE items SET max_qty = 1 WHERE id = $1', [item]);
    try {
      at(AFTER_DEADLINE);
      const got = (
        await as(
          http().get(`/api/admin/requests/${r.id}`),
          ADMIN,
          'admin',
        ).expect(200)
      ).body as { lines: { item_id: string | null; max_qty: number | null }[] };
      expect(got.lines.map((l) => [l.item_id, l.max_qty])).toEqual([
        [item, 1],
        [null, null],
      ]);
    } finally {
      await pool().query('UPDATE items SET max_qty = 10 WHERE id = $1', [item]);
    }
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

    it('qty -1 / 1.5 → 400 VALIDATION {fields: [qty]}; qty 0 hợp lệ ở DTO', async () => {
      const r = await seed([{ item_id: item, qty: 2 }]);
      at(AFTER_DEADLINE);
      for (const qty of [-1, 1.5]) {
        const res = await adminPut(r.id, {
          lines: reduce(r, qty),
          expected_updated_at: r.updated_at,
        }).expect(400);
        expect(res.body).toMatchObject({
          code: 'VALIDATION',
          fields: ['qty'],
          line_index: 0,
        });
      }
      await adminPut(r.id, {
        lines: reduce(r, 0),
        expected_updated_at: r.updated_at,
      }).expect(200);
    });

    it('phiếu không có → 404 REQUEST_NOT_FOUND', async () => {
      const res = await adminPut('00000000-0000-4000-8000-000000000000', {
        lines: [],
        expected_updated_at: '2026-11-01T00:00:00.000Z',
      }).expect(404);
      expect(res.body.code).toBe('REQUEST_NOT_FOUND');
    });

    it('mốc hạn: 23:59:59.999 ngày 10 → 409 PERIOD_NOT_LOCKED {ym, deadline}, phiếu không đổi; 00:00:00.000 ngày 11 → 200', async () => {
      const r = await seed([{ item_id: item, qty: 2 }]);
      f.freeze('2026-11-10T16:59:59.999Z');
      const body = { lines: reduce(r, 1), expected_updated_at: r.updated_at };
      const open = await adminPut(r.id, body).expect(409);
      expect(open.body).toMatchObject({
        code: 'PERIOD_NOT_LOCKED',
        ym: '2026-11',
        deadline: '2026-11-10T17:00:00.000Z',
      });
      expect(await auditOf('request.updated', r.id)).toEqual([]);
      f.freeze('2026-11-10T17:00:00.000Z');
      const res = await adminPut(r.id, body).expect(200);
      expect(view(res)).toMatchObject({ is_open: false });
    });

    it('admin giữ expected_updated_at cũ trong lúc member vừa lưu (trước khóa) → 409 STALE_UPDATE', async () => {
      const r = await seed([{ item_id: item, qty: 2 }]);
      await save([{ id: r.lines[0].id, qty: 3 }], {
        expected_updated_at: r.updated_at,
      }).expect(200);
      at(AFTER_DEADLINE);
      const res = await adminPut(r.id, {
        lines: reduce(r, 1),
        expected_updated_at: r.updated_at,
      }).expect(409);
      expect(res.body.code).toBe('STALE_UPDATE');
    });

    it('Hành chính sửa phiếu của chính mình → audit self:true, lọc GET admin/audit?self=true thấy', async () => {
      at(AFTER_DEADLINE);
      const r = await seedLegacy(ADMIN, 2);
      await adminPut(r.id, {
        lines: reduce(r, 1),
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
});
