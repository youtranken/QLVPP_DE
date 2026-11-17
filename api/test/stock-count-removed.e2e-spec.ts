import { stockFixture } from './stock.fixture';

describe('G6: bỏ Kiểm kê', () => {
  const { http, admin, newItem, qtyOf } = stockFixture();

  it('POST admin/items/:id/stock/count → 404, tồn không đổi', async () => {
    const id = await newItem(3);
    await admin(http().post(`/api/admin/items/${id}/stock/count`))
      .send({ counted_qty: 5, expected_stock_qty: 3, note: 'đếm kho' })
      .expect(404);
    expect(await qtyOf(id)).toMatchObject({ stock_qty: 3 });
  });
});
