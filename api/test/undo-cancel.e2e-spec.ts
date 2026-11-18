import { DEBT_AT, deliveryFixture } from './delivery.fixture';

const T = Date.parse(DEBT_AT);
const plus = (ms: number) => new Date(T + ms).toISOString();
const NOT_NEEDED = 'Người nhận không cần nữa';

interface CancelBody {
  cancelled_now: number;
  undo_id: string | null;
}

describe('POST admin/undo/cancel: hoàn tác hủy nợ trong 5 giây', () => {
  const f = deliveryFixture('undocnl');
  const { ADMIN, as, auditOf, backlog, bellsOf, cancel, debtLine, deliver } = f;
  const { freeze, http } = f;

  f.onCleanup((pool) =>
    pool.query('DELETE FROM undo_actions WHERE actor_sub LIKE $1', [
      `e2e-req-%-${f.SUFFIX}`,
    ]),
  );

  const undo = (ids: string[], path = 'cancel') =>
    as(http().post(`/api/admin/undo/${path}`), ADMIN, 'admin').send({ ids });
  const lineRow = async (id: string) =>
    (
      await f
        .pool()
        .query<{ cancelled_qty: number; cancel_note: string | null }>(
          'SELECT cancelled_qty, cancel_note FROM request_lines WHERE id = $1',
          [id],
        )
    ).rows[0];
  const backlogIds = async () =>
    (await backlog('item')).flatMap((g) => g.lines.map((l) => l.line_id));
  const cancelDebt = async () => {
    const seeded = await debtLine(10);
    freeze(plus(0));
    const res = await cancel(seeded.line.id, {
      reason_code: 'not_needed',
      expected_delivered_qty: 0,
      expected_qty: 5,
    }).expect(200);
    return { ...seeded, body: res.body as CancelBody };
  };

  it('hoàn tác ở 4 999 ms → 200: số hủy về 0, ghi chú về null, dòng về Còn nợ, chuông line_cancelled bị gỡ', async () => {
    const { line, body } = await cancelDebt();
    expect(body.undo_id).toEqual(expect.any(String));
    expect(await bellsOf('line_cancelled')).toHaveLength(1);
    freeze(plus(4999));
    const res = await undo([body.undo_id!]).expect(200);
    expect(res.body).toEqual({ undone: 1 });
    expect(await lineRow(line.id)).toEqual({
      cancelled_qty: 0,
      cancel_note: null,
    });
    expect(await backlogIds()).toContain(line.id);
    expect(await bellsOf('line_cancelled')).toEqual([]);
  });

  it('hoàn tác ở 5 000 ms → 409 UNDO_EXPIRED, dòng vẫn đã hủy 5', async () => {
    const { line, body } = await cancelDebt();
    freeze(plus(5000));
    const res = await undo([body.undo_id!]).expect(409);
    expect(res.body).toMatchObject({ code: 'UNDO_EXPIRED' });
    expect(await lineRow(line.id)).toEqual({
      cancelled_qty: 5,
      cancel_note: NOT_NEEDED,
    });
  });

  it('hoàn tác hai lần → lần sau 409 UNDO_ALREADY_DONE', async () => {
    const { body } = await cancelDebt();
    freeze(plus(100));
    await undo([body.undo_id!]).expect(200);
    const again = await undo([body.undo_id!]).expect(409);
    expect(again.body).toMatchObject({ code: 'UNDO_ALREADY_DONE' });
  });

  it('có audit line.cancel_undone before/after cancelled_qty và cancel_note', async () => {
    const { line, body } = await cancelDebt();
    freeze(plus(100));
    await undo([body.undo_id!]).expect(200);
    expect(await auditOf('line.cancel_undone', line.id)).toEqual([
      expect.objectContaining({
        before: { cancelled_qty: 5, cancel_note: NOT_NEEDED },
        after: { cancelled_qty: 0, cancel_note: null },
      }),
    ]);
  });

  it('id hủy nợ gửi sang undo/delivery → 404 UNDO_NOT_FOUND (khác loại), dòng không đổi', async () => {
    const { line, body } = await cancelDebt();
    freeze(plus(100));
    const res = await undo([body.undo_id!], 'delivery').expect(404);
    expect(res.body).toMatchObject({ code: 'UNDO_NOT_FOUND' });
    expect((await lineRow(line.id)).cancelled_qty).toBe(5);
  });

  it('hủy lần hai không còn gì (cancelled_now 0) → undo_id null', async () => {
    const { line } = await cancelDebt();
    const again = await cancel(line.id, {
      reason_code: 'not_needed',
      expected_delivered_qty: 0,
      expected_qty: 5,
    }).expect(200);
    expect(again.body).toMatchObject({ cancelled_now: 0, undo_id: null });
  });

  it('đã giao 2 rồi hủy 3 → hoàn tác giữ phần đã giao, về lại còn nợ 3', async () => {
    const seeded = await debtLine(10);
    await deliver(seeded.line.id, {
      qty: 2,
      expected_delivered_qty: 0,
    }).expect(200);
    freeze(plus(0));
    const res = await cancel(seeded.line.id, {
      reason_code: 'not_needed',
      expected_delivered_qty: 2,
      expected_qty: 5,
    }).expect(200);
    freeze(plus(4999));
    await undo([(res.body as CancelBody).undo_id!]).expect(200);
    const row = await f
      .pool()
      .query<{ delivered_qty: number; cancelled_qty: number }>(
        'SELECT delivered_qty, cancelled_qty FROM request_lines WHERE id = $1',
        [seeded.line.id],
      );
    expect(row.rows[0]).toEqual({ delivered_qty: 2, cancelled_qty: 0 });
  });
});
