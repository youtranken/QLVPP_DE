import { deliveryFixture } from './delivery.fixture';

const T = Date.parse('2026-11-12T03:00:00Z');
const plus = (ms: number) => new Date(T + ms).toISOString();

describe('POST admin/undo/item-delete: hoàn tác xóa món trong 5 giây', () => {
  const f = deliveryFixture('undoitem');
  const { ADMIN, as, freeze, http, newItem } = f;

  f.onCleanup((pool) =>
    pool.query('DELETE FROM undo_actions WHERE actor_sub LIKE $1', [
      `e2e-req-%-${f.SUFFIX}`,
    ]),
  );

  const admin = (req: ReturnType<ReturnType<typeof http>['post']>) =>
    as(req, ADMIN, 'admin');
  const undo = (ids: string[]) =>
    admin(http().post('/api/admin/undo/item-delete')).send({ ids });
  const fullRow = async (id: string) =>
    (
      await f
        .pool()
        .query<{ row: Record<string, unknown> }>(
          'SELECT to_jsonb(items.*) AS row FROM items WHERE id = $1',
          [id],
        )
    ).rows[0]?.row;
  const removeItem = async (code?: string) => {
    const id = await newItem({ max_qty: 7 });
    await f
      .pool()
      .query(
        'UPDATE items SET stock_qty = 0, code = $2, pack_note = $3 WHERE id = $1',
        [id, code ?? null, 'hộp 10'],
      );
    const before = await fullRow(id);
    freeze(plus(0));
    const res = await as(
      http().delete(`/api/admin/items/${id}`),
      ADMIN,
      'admin',
    ).expect(200);
    expect(await fullRow(id)).toBeUndefined();
    return { id, before, undoId: (res.body as { undo_id: string }).undo_id };
  };
  const auditDetail = async (id: string) =>
    (
      await f
        .pool()
        .query<{ actor: string; detail: Record<string, unknown> }>(
          "SELECT actor, detail FROM audit_log WHERE action = 'item.delete_undone' AND object_id = $1",
          [id],
        )
    ).rows;

  it('DELETE admin/items/:id → 200 {undo_id}; hoàn tác ở 4 999 ms → món về đúng id và mọi cột', async () => {
    const { id, before, undoId } = await removeItem();
    expect(undoId).toEqual(expect.any(String));
    freeze(plus(4999));
    const res = await undo([undoId]).expect(200);
    expect(res.body).toEqual({ undone: 1 });
    expect(await fullRow(id)).toEqual(before);
  });

  it('hoàn tác ở 5 000 ms → 409 UNDO_EXPIRED, món vẫn mất', async () => {
    const { id, undoId } = await removeItem();
    freeze(plus(5000));
    const res = await undo([undoId]).expect(409);
    expect(res.body).toMatchObject({ code: 'UNDO_EXPIRED' });
    expect(await fullRow(id)).toBeUndefined();
  });

  it('hoàn tác hai lần → lần sau 409 UNDO_ALREADY_DONE', async () => {
    const { undoId } = await removeItem();
    freeze(plus(10));
    await undo([undoId]).expect(200);
    const again = await undo([undoId]).expect(409);
    expect(again.body).toMatchObject({ code: 'UNDO_ALREADY_DONE' });
  });

  it('có audit item.delete_undone {before: null, after: món} do người hoàn tác', async () => {
    const { id, undoId } = await removeItem();
    freeze(plus(10));
    await undo([undoId]).expect(200);
    const rows = await auditDetail(id);
    expect(rows).toEqual([
      {
        actor: ADMIN,
        detail: {
          before: null,
          after: expect.objectContaining({
            id,
            max_qty: 7,
            pack_note: 'hộp 10',
          }),
        },
      },
    ]);
  });

  it('mã món đã bị món mới lấy trong 5 giây → 409 ITEM_CODE_EXISTS, không đánh dấu đã hoàn tác', async () => {
    const code = `UNDO-${f.SUFFIX}`;
    const { id, undoId } = await removeItem(code);
    const taker = await newItem();
    await f
      .pool()
      .query('UPDATE items SET code = $2 WHERE id = $1', [taker, code]);
    freeze(plus(10));
    const res = await undo([undoId]).expect(409);
    expect(res.body).toMatchObject({ code: 'ITEM_CODE_EXISTS' });
    expect(await fullRow(id)).toBeUndefined();
    await f.pool().query('UPDATE items SET code = NULL WHERE id = $1', [taker]);
    await undo([undoId]).expect(200);
  });
});
