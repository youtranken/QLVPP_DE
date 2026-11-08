import { adjustFixture } from './adjust.fixture';
import { AFTER_DEADLINE } from './me-request.fixture';
import type { RequestView } from './me-request.fixture';

describe('PUT admin/requests/:id/lines: Hành chính chỉ giảm/bỏ dòng, có lý do từng dòng', () => {
  const f = adjustFixture('adjust');
  const { A, ADMIN, as, at, freeze, http, pool, seed, adminPut, cut } = f;
  const { linesOf, recordsOf, bellsOf, view, auditOf, newItem, save } = f;
  const over = { reason_code: 'over_quota' };

  beforeAll(async () => {
    await pool().query(
      `INSERT INTO users (sub, full_name, department, status) VALUES ($1, 'Hành chính', 'Phòng HC', 'active')`,
      [ADMIN],
    );
  });

  it('member → 403', async () => {
    const r = await seed([5]);
    at(AFTER_DEADLINE);
    await cut(r, {}).set('x-dev-role', 'member').expect(403);
  });

  it('5 → 6 → 400 QTY_INCREASE_FORBIDDEN line_id; 5 → 5 kèm over_quota → 200, 0 bản ghi, 0 chuông, updated_at không đổi', async () => {
    const r = await seed([5]);
    at(AFTER_DEADLINE);
    const up = await cut(r, { 0: { qty: 6, ...over } }).expect(400);
    expect(up.body).toMatchObject({
      code: 'QTY_INCREASE_FORBIDDEN',
      line_id: r.lines[0].id,
    });
    const same = await cut(r, { 0: { qty: 5, ...over } }).expect(200);
    expect(view(same).updated_at).toBe(r.updated_at);
    expect(same.body.adjustments).toEqual([]);
    expect(await recordsOf(r.id)).toEqual([]);
    expect(await bellsOf(A)).toEqual([]);
  });

  it('dòng không id (món hay ngoài DM) → 400 LINE_ADD_FORBIDDEN line_index', async () => {
    const r = await seed([5]);
    at(AFTER_DEADLINE);
    for (const extra of [
      { item_id: await newItem(), qty: 1 },
      { custom_name: 'Kẹp lạ', custom_unit: 'cai', qty: 1 },
    ]) {
      const res = await adminPut(r.id, {
        expected_updated_at: r.updated_at,
        lines: [...linesOf(r), extra],
      }).expect(400);
      expect(res.body).toMatchObject({
        code: 'LINE_ADD_FORBIDDEN',
        line_index: 1,
      });
    }
  });

  it('vắng một dòng → 400 LINE_MISSING line_id; lines [] trên phiếu 2 dòng → LINE_MISSING dòng đầu', async () => {
    const r = await seed([5, 3]);
    at(AFTER_DEADLINE);
    const missing = await adminPut(r.id, {
      expected_updated_at: r.updated_at,
      lines: linesOf(r).slice(0, 1),
    }).expect(400);
    expect(missing.body).toMatchObject({
      code: 'LINE_MISSING',
      line_id: r.lines[1].id,
    });
    const empty = await adminPut(r.id, {
      expected_updated_at: r.updated_at,
      lines: [],
    }).expect(400);
    expect(empty.body).toMatchObject({
      code: 'LINE_MISSING',
      line_id: r.lines[0].id,
    });
  });

  it('sàn delivered + cancelled: giao 2 hủy 1 → 5 → 3 200; 5 → 2 và 5 → 0 → 400 QTY_BELOW_DELIVERED {delivered: 2}', async () => {
    const r = await seed([5]);
    await pool().query(
      'UPDATE request_lines SET delivered_qty = 2, cancelled_qty = 1 WHERE id = $1',
      [r.lines[0].id],
    );
    at(AFTER_DEADLINE);
    for (const qty of [2, 0]) {
      const low = await cut(r, { 0: { qty, ...over } }).expect(400);
      expect(low.body).toMatchObject({
        code: 'QTY_BELOW_DELIVERED',
        line_id: r.lines[0].id,
        delivered: 2,
      });
    }
    const ok = await cut(r, { 0: { qty: 3, ...over } }).expect(200);
    expect(view(ok).lines[0].qty).toBe(3);
  });

  it('5 → 0 chưa giao, trạng thái accepted → dòng xóa + bản ghi after 0; dòng còn lại giữ', async () => {
    const r = await seed([5, 2]);
    await pool().query(
      "UPDATE request_lines SET review_status = 'accepted', item_id = NULL, custom_name = 'Kẹp', custom_unit = 'cai' WHERE id = $1",
      [r.lines[0].id],
    );
    at(AFTER_DEADLINE);
    const res = await cut(r, { 0: { qty: 0, ...over } }).expect(200);
    expect(view(res).lines.map((l) => l.id)).toEqual([r.lines[1].id]);
    expect(await recordsOf(r.id)).toMatchObject([
      { line_id: r.lines[0].id, qty_before: 5, qty_after: 0 },
    ]);
  });

  it('kỳ mở: 16:59:59.999Z ngày 10 → 409 PERIOD_NOT_LOCKED, 0 bản ghi; 17:00:00.000Z → 200', async () => {
    const r = await seed([5]);
    freeze('2026-11-10T16:59:59.999Z');
    const open = await cut(r, { 0: { qty: 4, ...over } }).expect(409);
    expect(open.body).toMatchObject({
      code: 'PERIOD_NOT_LOCKED',
      ym: '2026-11',
    });
    expect(await recordsOf(r.id)).toEqual([]);
    freeze('2026-11-10T17:00:00.000Z');
    await cut(r, { 0: { qty: 4, ...over } }).expect(200);
    expect(await recordsOf(r.id)).toHaveLength(1);
  });

  it('thứ tự lỗi: VALIDATION trước REQUEST_NOT_FOUND; phiếu không có → 404; STALE (updated_at) trước LINE_MISSING', async () => {
    const ghost = '00000000-0000-4000-8000-000000000000';
    const bad = await adminPut(ghost, {
      expected_updated_at: '2026-11-01T00:00:00.000Z',
      lines: [{ id: ghost, qty: 1, expected_qty: 2, reason_code: 'xyz' }],
    }).expect(400);
    expect(bad.body).toMatchObject({
      code: 'VALIDATION',
      fields: ['lines.reason_code'],
      line_index: 0,
    });
    const none = await adminPut(ghost, {
      expected_updated_at: '2026-11-01T00:00:00.000Z',
      lines: [],
    }).expect(404);
    expect(none.body.code).toBe('REQUEST_NOT_FOUND');
    const r = await seed([5, 3]);
    at(AFTER_DEADLINE);
    const stale = await adminPut(r.id, {
      expected_updated_at: '2026-11-01T00:00:00.000Z',
      lines: [],
    }).expect(409);
    expect(stale.body.code).toBe('STALE_UPDATE');
  });

  it('expected_qty lệch 1 → 409 STALE_UPDATE {line_id, qty hiện tại}; thiếu expected_qty → 400 VALIDATION', async () => {
    const r = await seed([5]);
    at(AFTER_DEADLINE);
    const body = { expected_updated_at: r.updated_at };
    const off = await adminPut(r.id, {
      ...body,
      lines: [{ id: r.lines[0].id, qty: 4, expected_qty: 4, ...over }],
    }).expect(409);
    expect(off.body).toMatchObject({
      code: 'STALE_UPDATE',
      line_id: r.lines[0].id,
      qty: 5,
    });
    const missing = await adminPut(r.id, {
      ...body,
      lines: [{ id: r.lines[0].id, qty: 4, ...over }],
    }).expect(400);
    expect(missing.body).toMatchObject({
      code: 'VALIDATION',
      fields: ['expected_qty'],
    });
  });

  it('bảng mã/ghi chú qua DTO: không mã → REASON_REQUIRED; other "ab" → REASON_REQUIRED, "abc" → 200; ghi chú 201 mã điểm → VALIDATION, 200 (NFD) → 200 lưu NFC', async () => {
    const r = await seed([5]);
    at(AFTER_DEADLINE);
    const noCode = await cut(r, { 0: { qty: 4 } }).expect(400);
    expect(noCode.body).toMatchObject({
      code: 'REASON_REQUIRED',
      line_id: r.lines[0].id,
    });
    const short = await cut(r, {
      0: { qty: 4, reason_code: 'other', reason_note: '  ab ' },
    }).expect(400);
    expect(short.body.code).toBe('REASON_REQUIRED');
    const long = await cut(r, {
      0: { qty: 4, ...over, reason_note: 'x'.repeat(201) },
    }).expect(400);
    expect(long.body).toMatchObject({
      code: 'VALIDATION',
      fields: ['lines.reason_note'],
    });
    const nfd = 'ú'.repeat(200);
    const done = await cut(r, {
      0: { qty: 4, ...over, reason_note: nfd },
    }).expect(200);
    const after = view(done);
    await cut(after, {
      0: { qty: 3, reason_code: 'other', reason_note: 'abc' },
    }).expect(200);
    expect(
      (await recordsOf(r.id)).map((x) => [x.reason_code, x.reason_note]),
    ).toEqual([
      ['over_quota', 'ú'.repeat(200)],
      ['other', 'abc'],
    ]);
  });

  it('client cũ gửi reason cấp phiếu → bị lột, 200; audit có adjustments đủ trường, không reason; trả adjustments', async () => {
    const r = await seed([5]);
    at(AFTER_DEADLINE);
    const res = await cut(
      r,
      { 0: { qty: 3, reason_code: 'duplicate', reason_note: 'trùng phiếu B' } },
      { reason: 'lý do cũ' },
    ).expect(200);
    const expected = {
      line_id: r.lines[0].id,
      item_id: r.lines[0].item_id,
      before: 5,
      after: 3,
      reason_code: 'duplicate',
      reason_note: 'trùng phiếu B',
    };
    expect(res.body.adjustments).toEqual([
      { ...expected, name: expect.stringContaining('e2e-req-item-') },
    ]);
    const [detail] = await auditOf('request.updated', r.id);
    expect(detail).not.toHaveProperty('reason');
    expect(detail).toMatchObject({
      self: false,
      owner_sub: A,
      adjustments: [expected],
      changed: [{ id: r.lines[0].id }],
    });
    expect(await recordsOf(r.id)).toMatchObject([{ actor_sub: ADMIN }]);
  });

  it('bỏ hết dòng → phiếu giữ với 0 dòng, vẫn tính đã đăng ký; không chuông "đã giao đủ"', async () => {
    const r = await seed([5, 2]);
    at(AFTER_DEADLINE);
    const get = (path: string) =>
      as(http().get(`/api/admin/${path}`), ADMIN, 'admin').expect(200);
    const before = (await get('periods/2026-11/summary')).body;
    const res = await cut(r, {
      0: { qty: 0, ...over },
      1: { qty: 0, reason_code: 'adm_out_of_stock' },
    }).expect(200);
    expect(view(res)).toMatchObject({ id: r.id, lines: [] });
    expect((await get(`requests/${r.id}`)).body.lines).toEqual([]);
    expect((await get('periods/2026-11/summary')).body.registered).toBe(
      before.registered,
    );
    const unregistered = (await get('periods/2026-11/unregistered')).body as {
      items: { sub: string }[];
    };
    expect(unregistered.items.map((u) => u.sub)).not.toContain(A);
    expect(await recordsOf(r.id)).toHaveLength(2);
    expect(await bellsOf(A, 'request_delivered')).toEqual([]);
  });

  it('giảm về đúng số đã giao → phiếu giao đủ nhưng 0 chuông request_delivered', async () => {
    const r = await seed([5]);
    await pool().query(
      'UPDATE request_lines SET delivered_qty = 2 WHERE id = $1',
      [r.lines[0].id],
    );
    at(AFTER_DEADLINE);
    await cut(r, { 0: { qty: 2, ...over } }).expect(200);
    expect(await bellsOf(A, 'request_delivered')).toEqual([]);
  });

  it('món đã ngừng sau khóa → vẫn giảm được 200', async () => {
    const r = await seed([5]);
    await pool().query('UPDATE items SET active = false WHERE id = $1', [
      r.lines[0].item_id,
    ]);
    at(AFTER_DEADLINE);
    const res = await cut(r, { 0: { qty: 1, ...over } }).expect(200);
    expect(view(res).lines[0].qty).toBe(1);
  });

  describe('nhân viên lưu sát giờ khóa: writer đọc lại đồng hồ sau khi khóa phiếu', () => {
    const raceSave = async (lateClock: string) => {
      const r = await seed([2]);
      freeze('2026-11-10T16:59:59.990Z');
      const blocker = await pool().connect();
      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT 1 FROM requests WHERE id = $1 FOR UPDATE', [
          r.id,
        ]);
        const pending = save([{ id: r.lines[0].id, qty: 3 }], {
          expected_updated_at: r.updated_at,
        }).then((res) => res);
        await new Promise((ok) => setTimeout(ok, 300));
        freeze(lateClock);
        await blocker.query('COMMIT');
        return { r, res: await pending };
      } finally {
        blocker.release();
      }
    };
    const qtyOf = async (r: RequestView) =>
      (
        await pool().query<{ qty: number }>(
          'SELECT qty FROM request_lines WHERE id = $1',
          [r.lines[0].id],
        )
      ).rows[0].qty;

    it('đồng hồ qua 17:00:00.000Z trong lúc chờ khóa → 409 PERIOD_LOCKED, phiếu không đổi', async () => {
      const { r, res } = await raceSave('2026-11-10T17:00:00.000Z');
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('PERIOD_LOCKED');
      expect(await qtyOf(r)).toBe(2);
    });

    it('vẫn 16:59:59.999Z khi được khóa → 200', async () => {
      const { r, res } = await raceSave('2026-11-10T16:59:59.999Z');
      expect(res.status).toBe(200);
      expect(await qtyOf(r)).toBe(3);
    });
  });
});
