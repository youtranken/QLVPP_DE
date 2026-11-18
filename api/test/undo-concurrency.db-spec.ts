import { DEBT_AT, deliveryFixture } from './delivery.fixture';
import type { DeliverResult } from './delivery.fixture';
import { AFTER_DEADLINE } from './me-request.fixture';

const plus = (iso: string, ms: number) =>
  new Date(Date.parse(iso) + ms).toISOString();

describe('Hoàn tác song song (Postgres thật, hai request HTTP thật)', () => {
  const f = deliveryFixture('undoconc');
  const { ADMIN, as, cancel, debtLine, deliver, freeze, http, lockedLine } = f;

  f.onCleanup((pool) =>
    pool.query('DELETE FROM undo_actions WHERE actor_sub LIKE $1', [
      `e2e-req-%-${f.SUFFIX}`,
    ]),
  );

  const undo = (path: string, id: string) =>
    as(http().post(`/api/admin/undo/${path}`), ADMIN, 'admin').send({
      ids: [id],
    });
  const outcomes = (rs: { status: number; body: { code?: string } }[]) =>
    rs
      .map((r) => (r.status === 200 ? '200' : `${r.status} ${r.body.code}`))
      .sort();

  it(`giao: hai hoàn tác cùng id cùng lúc → một 200, một 409 UNDO_ALREADY_DONE; tủ cộng đúng một lần (hai vòng, hai người)`, async () => {
    for (const sub of [f.A, f.B]) {
      const { item, line } = await lockedLine(10, 5, sub);
      freeze(AFTER_DEADLINE);
      const res = await deliver(line.id, {
        qty: 3,
        expected_delivered_qty: 0,
      }).expect(200);
      const id = (res.body as DeliverResult).undo_id;
      freeze(plus(AFTER_DEADLINE, 4999));
      const rs = await Promise.all([
        undo('delivery', id),
        undo('delivery', id),
      ]);
      expect(outcomes(rs)).toEqual(['200', '409 UNDO_ALREADY_DONE']);
      expect(await f.stockOf(item)).toBe(10);
    }
  });

  it('hủy nợ: hai hoàn tác cùng id cùng lúc → một 200, một 409 UNDO_ALREADY_DONE', async () => {
    const { line } = await debtLine(10);
    const res = await cancel(line.id, {
      reason_code: 'not_needed',
      expected_delivered_qty: 0,
      expected_qty: 5,
    }).expect(200);
    const id = (res.body as { undo_id: string }).undo_id;
    freeze(plus(DEBT_AT, 4999));
    const rs = await Promise.all([undo('cancel', id), undo('cancel', id)]);
    expect(outcomes(rs)).toEqual(['200', '409 UNDO_ALREADY_DONE']);
  });

  it('xóa món: hai hoàn tác cùng id cùng lúc → một 200, một 409 UNDO_ALREADY_DONE, món có đúng một dòng', async () => {
    const id = await f.newItem();
    freeze(AFTER_DEADLINE);
    const res = await as(
      http().delete(`/api/admin/items/${id}`),
      ADMIN,
      'admin',
    ).expect(200);
    const undoId = (res.body as { undo_id: string }).undo_id;
    freeze(plus(AFTER_DEADLINE, 4999));
    const rs = await Promise.all([
      undo('item-delete', undoId),
      undo('item-delete', undoId),
    ]);
    expect(outcomes(rs)).toEqual(['200', '409 UNDO_ALREADY_DONE']);
    const { rows } = await f
      .pool()
      .query('SELECT id FROM items WHERE id = $1', [id]);
    expect(rows).toHaveLength(1);
  });
});
