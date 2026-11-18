import { AFTER_DEADLINE, BEFORE_DEADLINE } from './me-request.fixture';
import { DEBT_AT, deliveryFixture } from './delivery.fixture';

interface RequestCancelBody {
  user_sub: string;
  cancelled_now: number;
  lines: {
    id: string;
    qty: number;
    delivered_qty: number;
    cancelled_qty: number;
    cancel_note: string | null;
    cancelled_now: number;
  }[];
  undo_id: string | null;
}

const T = Date.parse(AFTER_DEADLINE);
const plus = (ms: number) => new Date(T + ms).toISOString();

describe('POST admin/users/:sub/cancel-remaining: hủy mọi phiếu còn nợ của người đã nghỉ', () => {
  const f = deliveryFixture('cnlreq');
  const { A, ADMIN, as, at, auditOf, deliver, freeze, http, pool, seed } = f;

  f.onCleanup((p) =>
    p.query('DELETE FROM undo_actions WHERE actor_sub LIKE $1', [
      `e2e-req-%-${f.SUFFIX}`,
    ]),
  );
  beforeEach(() =>
    pool().query("UPDATE users SET status = 'active' WHERE sub = $1", [A]),
  );

  const setStatus = (status: string) =>
    pool().query('UPDATE users SET status = $2 WHERE sub = $1', [A, status]);
  const cancelReq = (owner: string, body: object, role = 'admin', sub = ADMIN) =>
    as(
      http().post(`/api/admin/users/${owner}/cancel-remaining`),
      sub,
      role,
    ).send(body);
  const undo = (ids: string[]) =>
    as(http().post('/api/admin/undo/cancel'), ADMIN, 'admin').send({ ids });
  const freeOf = async (item: string) =>
    (
      (await as(http().get('/api/admin/stock'), ADMIN, 'admin').expect(200))
        .body as { item_id: string; free: number }[]
    ).find((r) => r.item_id === item)!.free;
  const twoLines = async () => {
    const i1 = await f.stockItem(10);
    const i2 = await f.stockItem(10);
    at(BEFORE_DEADLINE);
    const request = await seed([
      { item_id: i1, qty: 3 },
      { item_id: i2, qty: 4 },
    ]);
    freeze(AFTER_DEADLINE);
    const [l1, l2] = [i1, i2].map((item) =>
      request.lines.find((l) => l.item_id === item)!,
    );
    return { request, i1, i2, l1, l2 };
  };
  // audit_log chỉ ghi thêm, cùng chủ A qua nhiều test → lọc theo dòng của test
  const userAudits = async (lineId: string) =>
    (await auditOf('user.cancel_remaining', A)).filter((d) =>
      JSON.stringify(d).includes(lineId),
    );
  const expectedOf = (lines: { id: string }[], remaining: number[]) => ({
    expected_lines: lines.map((l, k) => ({
      line_id: l.id,
      remaining: remaining[k],
    })),
  });

  it('chủ phiếu đang làm (active) → 409 USER_NOT_LEFT, không dòng nào bị hủy', async () => {
    const { request, l1, l2 } = await twoLines();
    const res = await cancelReq(A, expectedOf([l1, l2], [3, 4]));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('USER_NOT_LEFT');
    expect((await f.lineRow(l1.id)).cancelled_qty).toBe(0);
  });

  it.each(['locked', 'deleted', 'no_access'])(
    'chủ phiếu %s → 200: hủy hết phần còn lại mọi dòng với "Người đã nghỉ", Tủ trống tăng đúng 2 + 4 so với lúc còn làm',
    async (status) => {
      const { request, i1, i2, l1, l2 } = await twoLines();
      await deliver(l1.id, { qty: 1, expected_delivered_qty: 0 }).expect(200);
      // Tủ trống tính lúc người còn làm: người đã nghỉ vốn không giữ hàng (heldSql), sau hủy phần đó không quay lại khi mở khóa
      const freeBefore = [await freeOf(i1), await freeOf(i2)];
      await setStatus(status);
      const res = await cancelReq(
        A,
        expectedOf([l1, l2], [2, 4]),
      ).expect(200);
      const body = res.body as RequestCancelBody;
      expect(body.cancelled_now).toBe(6);
      expect(body.undo_id).toEqual(expect.any(String));
      expect(body.lines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: l1.id,
            delivered_qty: 1,
            cancelled_qty: 2,
            cancelled_now: 2,
            cancel_note: 'Người đã nghỉ',
          }),
          expect.objectContaining({
            id: l2.id,
            cancelled_qty: 4,
            cancelled_now: 4,
          }),
        ]),
      );
      await setStatus('active');
      expect(await freeOf(i1)).toBe(freeBefore[0] + 2);
      expect(await freeOf(i2)).toBe(freeBefore[1] + 4);
      expect(await f.bellsOf('line_cancelled')).toEqual([]);
    },
  );

  it('audit một bản ghi cha request.cancel_remaining + line.cancel_remaining từng dòng có before/after', async () => {
    const { request, l1, l2 } = await twoLines();
    await setStatus('locked');
    await cancelReq(A, expectedOf([l1, l2], [3, 4])).expect(200);
    const [parent] = await userAudits(l1.id);
    expect(parent).toMatchObject({
      requests: [{ request_id: request.id, ym: '2026-11' }],
      reason_code: 'user_left',
      lines: expect.arrayContaining([
        {
          line_id: l1.id,
          before: { cancelled_qty: 0 },
          after: { cancelled_qty: 3 },
        },
      ]),
    });
    expect(await auditOf('line.cancel_remaining', l2.id)).toEqual([
      expect.objectContaining({
        before: { cancelled_qty: 0 },
        after: { cancelled_qty: 4 },
        reason_code: 'user_left',
      }),
    ]);
  });

  it('gọi lại khi phiếu không còn nợ → 200 cancelled_now 0, undo_id null, không audit thêm', async () => {
    const { request, l1, l2 } = await twoLines();
    await setStatus('locked');
    const body = expectedOf([l1, l2], [3, 4]);
    await cancelReq(A, body).expect(200);
    const again = await cancelReq(A, body).expect(200);
    expect(again.body).toMatchObject({
      cancelled_now: 0,
      undo_id: null,
      lines: [],
    });
    expect(await userAudits(l1.id)).toHaveLength(1);
  });

  it('expected lệch (remaining 3 trong khi DB còn 2) → 409 STALE_UPDATE kèm số hiện tại, không hủy', async () => {
    const { request, l1, l2 } = await twoLines();
    await deliver(l1.id, { qty: 1, expected_delivered_qty: 0 }).expect(200);
    await setStatus('locked');
    const res = await cancelReq(A, expectedOf([l1, l2], [3, 4]));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STALE_UPDATE');
    expect(res.body.lines).toEqual(
      expect.arrayContaining([{ line_id: l1.id, remaining: 2 }]),
    );
    expect((await f.lineRow(l2.id)).cancelled_qty).toBe(0);
  });

  it('expected thiếu một dòng còn nợ → 409 STALE_UPDATE', async () => {
    const { request, l1 } = await twoLines();
    await setStatus('locked');
    const res = await cancelReq(A, expectedOf([l1], [3]));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STALE_UPDATE');
  });

  it('vai nhân viên → 403; người không có → 404 USER_NOT_FOUND; expected_lines sai dạng → 400 VALIDATION', async () => {
    const { request, l1, l2 } = await twoLines();
    await setStatus('locked');
    const body = expectedOf([l1, l2], [3, 4]);
    await cancelReq(A, body, 'member', A).expect(403);
    const missing = await cancelReq(`e2e-req-none-${f.SUFFIX}`, body);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('USER_NOT_FOUND');
    const bad = await cancelReq(A, {
      expected_lines: [{ line_id: l1.id, remaining: 0 }],
    });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('VALIDATION');
  });

  it('kỳ chưa khóa: 16:59:59.999Z ngày 10 → 409 PERIOD_NOT_LOCKED; 17:00:00.000Z → 200', async () => {
    const { request, l1, l2 } = await twoLines();
    await setStatus('locked');
    const body = expectedOf([l1, l2], [3, 4]);
    freeze('2026-11-10T16:59:59.999Z');
    const early = await cancelReq(A, body);
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('PERIOD_NOT_LOCKED');
    freeze('2026-11-10T17:00:00.000Z');
    await cancelReq(A, body).expect(200);
  });

  it('hoàn tác bằng undo/cancel trong 4 999 ms → mọi dòng về như trước; 5 000 ms → UNDO_EXPIRED', async () => {
    const { request, l1, l2 } = await twoLines();
    await setStatus('locked');
    freeze(plus(0));
    const body = expectedOf([l1, l2], [3, 4]);
    const res = await cancelReq(A, body).expect(200);
    const undoId = (res.body as RequestCancelBody).undo_id!;
    freeze(plus(4999));
    expect((await undo([undoId]).expect(200)).body).toEqual({ undone: 2 });
    for (const l of [l1, l2]) {
      const row = await f.lineRow(l.id);
      expect([row.cancelled_qty, row.cancel_note]).toEqual([0, null]);
    }
    freeze(plus(10000));
    const second = await cancelReq(A, body).expect(200);
    freeze(plus(15000));
    const late = await undo([(second.body as RequestCancelBody).undo_id!]);
    expect(late.status).toBe(409);
    expect(late.body.code).toBe('UNDO_EXPIRED');
  });

  describe('người có phiếu nợ tháng 11 và phiếu tháng 12 đang giao', () => {
    const twoRequests = async () => {
      const i1 = await f.stockItem(10);
      const i2 = await f.stockItem(10);
      at(BEFORE_DEADLINE);
      const nov = await seed([{ item_id: i1, qty: 3 }]);
      // Phiếu tháng 12 ghi thẳng: đường lưu của nhân viên chỉ ghi kỳ đang mở theo đồng hồ của fixture
      freeze(DEBT_AT);
      const dec = await pool().query<{ id: string }>(
        `WITH r AS (INSERT INTO requests (period_ym, user_sub, created_by_sub)
           VALUES ('2026-12-01', $1, $1) RETURNING id)
         INSERT INTO request_lines (request_id, item_id, qty)
         SELECT r.id, $2, 4 FROM r RETURNING id`,
        [A, i2],
      );
      return { nov: nov.lines[0], dec: dec.rows[0] };
    };

    it('một lần gọi hủy cả hai phiếu: một audit cha, một undo_id hoàn tác cả hai', async () => {
      const { nov, dec } = await twoRequests();
      await setStatus('locked');
      const res = await cancelReq(A, expectedOf([nov, dec], [3, 4])).expect(200);
      const body = res.body as RequestCancelBody;
      expect([body.user_sub, body.cancelled_now]).toEqual([A, 7]);
      expect((await f.lineRow(nov.id)).cancelled_qty).toBe(3);
      expect((await f.lineRow(dec.id)).cancelled_qty).toBe(4);
      const [parent] = await userAudits(nov.id);
      expect((parent as { requests: unknown[] }).requests).toHaveLength(2);
      await undo([body.undo_id!]).expect(200);
      expect((await f.lineRow(nov.id)).cancelled_qty).toBe(0);
      expect((await f.lineRow(dec.id)).cancelled_qty).toBe(0);
    });

    it('dòng phiếu tháng 12 lệch (expected 3, còn 4) → 409 STALE_UPDATE, phiếu tháng 11 cũng không bị hủy', async () => {
      const { nov, dec } = await twoRequests();
      await setStatus('locked');
      const res = await cancelReq(A, expectedOf([nov, dec], [3, 3]));
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('STALE_UPDATE');
      expect(res.body.lines).toEqual(
        expect.arrayContaining([
          { line_id: nov.id, remaining: 3 },
          { line_id: dec.id, remaining: 4 },
        ]),
      );
      expect((await f.lineRow(nov.id)).cancelled_qty).toBe(0);
      expect((await f.lineRow(dec.id)).cancelled_qty).toBe(0);
      expect(await userAudits(nov.id)).toEqual([]);
    });
  });
});
