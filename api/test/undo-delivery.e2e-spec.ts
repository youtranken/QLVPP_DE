import { randomUUID } from 'node:crypto';
import { deliveryFixture } from './delivery.fixture';
import type { DeliverResult } from './delivery.fixture';
import { AFTER_DEADLINE } from './me-request.fixture';

const T = Date.parse(AFTER_DEADLINE);
const plus = (ms: number) => new Date(T + ms).toISOString();

describe('POST admin/undo/delivery: hoàn tác giao trong 5 giây', () => {
  const f = deliveryFixture('undodlv');
  const {
    A,
    B,
    ADMIN,
    as,
    auditOf,
    deliver,
    deliveriesOf,
    freeze,
    http,
    lockedLine,
    movementsOf,
    notificationsOf,
    stockOf,
  } = f;

  f.onCleanup((pool) =>
    pool.query('DELETE FROM undo_actions WHERE actor_sub LIKE $1', [
      `e2e-req-%-${f.SUFFIX}`,
    ]),
  );

  const undo = (ids: string[], sub = ADMIN, role = 'admin') =>
    as(http().post('/api/admin/undo/delivery'), sub, role).send({ ids });
  const lineRow = async (id: string) =>
    (
      await f
        .pool()
        .query<{ delivered_qty: number; last_delivered_at: Date | null }>(
          'SELECT delivered_qty, last_delivered_at FROM request_lines WHERE id = $1',
          [id],
        )
    ).rows[0];
  const giveThree = async () => {
    const seeded = await lockedLine(10);
    freeze(plus(0));
    const res = await deliver(seeded.line.id, {
      qty: 3,
      expected_delivered_qty: 0,
    }).expect(200);
    return { ...seeded, body: res.body as DeliverResult };
  };

  it('hoàn tác ở 4 999 ms → 200 {undone: 1}: đã giao về 0, tủ về 10, sổ có return +3 trỏ movement giao, mất đợt giao', async () => {
    const { item, line, body } = await giveThree();
    expect(await stockOf(item)).toBe(7);
    freeze(plus(4999));
    const res = await undo([body.undo_id]).expect(200);
    expect(res.body).toEqual({ undone: 1 });
    expect(await lineRow(line.id)).toEqual({
      delivered_qty: 0,
      last_delivered_at: null,
    });
    expect(await stockOf(item)).toBe(10);
    expect(await deliveriesOf(line.id)).toEqual([]);
    const { rows } = await f.pool().query<{
      delta: number;
      reason: string;
      ref_movement_id: string | null;
    }>('SELECT delta, reason, ref_movement_id FROM stock_movements WHERE ref_line_id = $1 ORDER BY delta', [line.id]);
    expect(rows).toEqual([
      { delta: -3, reason: 'delivery', ref_movement_id: null },
      { delta: 3, reason: 'return', ref_movement_id: body.movement_id },
    ]);
  });

  it('hoàn tác ở 5 000 ms → 409 UNDO_EXPIRED, không đổi gì (đã giao 3, tủ 7)', async () => {
    const { item, line, body } = await giveThree();
    freeze(plus(5000));
    const res = await undo([body.undo_id]).expect(409);
    expect(res.body).toMatchObject({ code: 'UNDO_EXPIRED' });
    expect((await lineRow(line.id)).delivered_qty).toBe(3);
    expect(await stockOf(item)).toBe(7);
    expect(await deliveriesOf(line.id)).toHaveLength(1);
    expect(await auditOf('line.delivery_undone', line.id)).toEqual([]);
  });

  it('hoàn tác hai lần → lần sau 409 UNDO_ALREADY_DONE, tủ chỉ cộng một lần', async () => {
    const { item, body } = await giveThree();
    freeze(plus(1000));
    await undo([body.undo_id]).expect(200);
    freeze(plus(2000));
    const again = await undo([body.undo_id]).expect(409);
    expect(again.body).toMatchObject({ code: 'UNDO_ALREADY_DONE' });
    expect(await stockOf(item)).toBe(10);
  });

  it('có audit line.delivery_undone before/after delivered_qty, actor là người hoàn tác', async () => {
    const { line, body } = await giveThree();
    freeze(plus(10));
    await undo([body.undo_id]).expect(200);
    expect(await auditOf('line.delivery_undone', line.id)).toEqual([
      expect.objectContaining({
        before: { delivered_qty: 3 },
        after: { delivered_qty: 0 },
        qty: 3,
        undo_ids: [body.undo_id],
      }),
    ]);
  });

  it('người khác hoàn tác → 404 UNDO_NOT_FOUND; id lạ → 404; vai member → 403 FORBIDDEN_ROLE', async () => {
    const { item, body } = await giveThree();
    freeze(plus(10));
    const other = await undo([body.undo_id], `${ADMIN}-2`).expect(404);
    expect(other.body).toMatchObject({ code: 'UNDO_NOT_FOUND' });
    await undo([randomUUID()]).expect(404);
    await undo([body.undo_id], A, 'member').expect(403);
    expect(await stockOf(item)).toBe(7);
  });

  it('ids: [] → 400; 101 id → 400; trùng → 400; 100 id lạ qua DTO → 404 UNDO_NOT_FOUND', async () => {
    for (const ids of [
      [],
      Array.from({ length: 101 }, () => randomUUID()),
      ['a', 'a'],
    ]) {
      const res = await undo(ids).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION' });
    }
    const dup = randomUUID();
    await undo([dup, dup]).expect(400);
    const hundred = Array.from({ length: 100 }, () => randomUUID());
    await undo(hundred).expect(404);
  });

  it('giao đủ có chuông "đã giao đủ" → hoàn tác gỡ chuông đó; giao lại đủ → chuông về', async () => {
    const { line } = await lockedLine(10);
    freeze(plus(0));
    const res = await deliver(line.id, {
      qty: 5,
      expected_delivered_qty: 0,
    }).expect(200);
    expect(await notificationsOf()).toHaveLength(1);
    freeze(plus(4999));
    await undo([(res.body as DeliverResult).undo_id]).expect(200);
    expect(await notificationsOf()).toEqual([]);
    await deliver(line.id, { qty: 5, expected_delivered_qty: 0 }).expect(200);
    expect(await notificationsOf()).toHaveLength(1);
  });

  it('hoàn tác lần giao sau → last_delivered_at về lần giao trước', async () => {
    const { line } = await lockedLine(10);
    freeze(plus(0));
    await deliver(line.id, { qty: 1, expected_delivered_qty: 0 }).expect(200);
    freeze(plus(60_000));
    const second = await deliver(line.id, {
      qty: 2,
      expected_delivered_qty: 1,
    }).expect(200);
    freeze(plus(64_999));
    await undo([(second.body as DeliverResult).undo_id]).expect(200);
    expect(await lineRow(line.id)).toEqual({
      delivered_qty: 1,
      last_delivered_at: new Date(plus(0)),
    });
  });

  it('bulk hai phiếu → một undo_id, hoàn tác ở 4 999 ms sau lúc lô xong trả cả hai; có reject_line_ids → undo_id null', async () => {
    const a = await lockedLine(10);
    const b = await lockedLine(10, 5, B);
    freeze(plus(0));
    const res = await as(
      http().post('/api/admin/deliveries/bulk'),
      ADMIN,
      'admin',
    )
      .send({
        requests: [a, b].map((s) => ({
          request_id: s.request.id,
          lines: [{ line_id: s.line.id, qty: 2, expected_delivered_qty: 0 }],
        })),
      })
      .expect(200);
    const undoId = (res.body as { undo_id: string | null }).undo_id;
    expect(undoId).toEqual(expect.any(String));
    freeze(plus(4999));
    await undo([undoId!]).expect(200);
    for (const s of [a, b]) {
      expect((await lineRow(s.line.id)).delivered_qty).toBe(0);
      expect(await stockOf(s.item)).toBe(10);
    }
    expect(await movementsOf(a.line.id)).toHaveLength(2);
  });

  it('bulk kèm reject_line_ids → undo_id null (ghi Không mua không đảo được)', async () => {
    const custom = await f.customLine();
    const seeded = await lockedLine(10, 5, B);
    freeze(plus(0));
    const res = await as(
      http().post('/api/admin/deliveries/bulk'),
      ADMIN,
      'admin',
    )
      .send({
        requests: [
          {
            request_id: seeded.request.id,
            lines: [
              { line_id: seeded.line.id, qty: 1, expected_delivered_qty: 0 },
            ],
          },
          {
            request_id: custom.request.id,
            lines: [],
            reject_line_ids: [custom.line.id],
          },
        ],
      })
      .expect(200);
    expect((res.body as { undo_id: string | null }).undo_id).toBeNull();
  });
});
