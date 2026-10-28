import { AFTER_DEADLINE, meRequestFixture } from './me-request.fixture';
import type { RequestView } from './me-request.fixture';

describe('giảm số lượng dòng đã có khi món đổi trạng thái sau khi lưu', () => {
  const f = meRequestFixture('decrease');
  const { ADMIN, at, http, as, newItem, save, view, pool } = f;

  const patchItem = (id: string, body: object) =>
    as(http().patch(`/api/admin/items/${id}`), ADMIN, 'admin')
      .send(body)
      .expect(200);
  const adminPut = (r: RequestView, qty: number, reason?: string) =>
    as(http().put(`/api/admin/requests/${r.id}/lines`), ADMIN, 'admin').send({
      lines: [{ id: r.lines[0].id, qty }],
      expected_updated_at: r.updated_at,
      reason,
    });
  const memberPut = (r: RequestView, qty: number) =>
    save([{ id: r.lines[0].id, qty }], { expected_updated_at: r.updated_at });
  const seedLine = async (qty: number, max_qty = 10) => {
    const item = await newItem({ max_qty });
    return { item, r: view(await save([{ item_id: item, qty }]).expect(200)) };
  };

  it('member giảm dòng vượt max sau khi Hành chính hạ max_qty → 200; tăng → QTY_EXCEEDS_MAX', async () => {
    const { item, r } = await seedLine(8);
    await patchItem(item, { max_qty: 3 });
    const res = await memberPut(r, 9).expect(400);
    expect(res.body).toMatchObject({
      code: 'QTY_EXCEEDS_MAX',
      line_id: r.lines[0].id,
    });
    expect(view(await memberPut(r, 5).expect(200)).lines[0].qty).toBe(5);
  });

  it('member giảm dòng món đã ngừng → ITEM_INACTIVE {line_id}; bỏ dòng → 200, phiếu rỗng bị xóa', async () => {
    const { item, r } = await seedLine(4);
    await patchItem(item, { active: false });
    const res = await memberPut(r, 2).expect(400);
    expect(res.body).toMatchObject({
      code: 'ITEM_INACTIVE',
      line_id: r.lines[0].id,
    });
    const res2 = await save([], { expected_updated_at: r.updated_at });
    expect(res2.status).toBe(200);
    expect(res2.body).toEqual({ request: null });
  });

  it('member đổi qty dòng món chuyển admin_only → ADMIN_ONLY_ITEM', async () => {
    const { item, r } = await seedLine(4);
    await pool().query('UPDATE items SET admin_only = true WHERE id = $1', [
      item,
    ]);
    const res = await memberPut(r, 2).expect(400);
    expect(res.body.code).toBe('ADMIN_ONLY_ITEM');
  });

  it('Hành chính sau hạn (có lý do) giảm dòng món đã ngừng và vượt max → 200; tăng → ITEM_INACTIVE', async () => {
    const { item, r } = await seedLine(8);
    await patchItem(item, { active: false, max_qty: 3 });
    at(AFTER_DEADLINE);
    const up = await adminPut(r, 9, 'Bổ sung theo email').expect(400);
    expect(up.body).toMatchObject({
      code: 'ITEM_INACTIVE',
      line_id: r.lines[0].id,
    });
    const res = await adminPut(r, 6, 'Giảm theo email').expect(200);
    expect(view(res).lines[0].qty).toBe(6);
  });
});
