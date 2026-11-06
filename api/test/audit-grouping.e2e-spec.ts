import { stockFixture } from './stock.fixture';

interface AuditItem {
  id: string;
  action: string;
  objectType: string | null;
  objectId: string | null;
  objectLabel: { name: string | null; ym: string | null } | null;
  detail: Record<string, unknown>;
  batch?: {
    ym: string;
    units: number;
    items: {
      item_id: string;
      name: string;
      name_en: string | null;
      qty: number;
    }[];
  };
}

describe('Nhật ký gộp một lần Lưu hàng về thành một dòng', () => {
  const f = stockFixture();
  const YM = '2024-06';
  const ACTOR = `e2e-audit-batch-${process.pid}-${Date.now().toString(36)}`;
  const asActor = (req: ReturnType<ReturnType<typeof f.http>['get']>) =>
    req.set('x-dev-user-sub', ACTOR).set('x-dev-role', 'admin');
  const receive = (lines: { item_id: string; qty: number }[]) =>
    asActor(f.http().post('/api/admin/stock/receipts'))
      .send({
        ym: YM,
        lines: lines.map((l) => ({ ...l, expected_stock_qty: 0 })),
      })
      .expect(200);
  const auditPage = async (query = '') =>
    (
      (
        await asActor(
          f.http().get(`/api/admin/audit?actor=${ACTOR}&limit=50${query}`),
        ).expect(200)
      ).body as { items: AuditItem[] }
    ).items;
  const newItems = (n: number) =>
    Promise.all(Array.from({ length: n }, () => f.newItem(0)));

  it('một lần Lưu 5 món → 1 dòng gộp (kỳ, 5 món, tổng đơn vị); từng món gắn batch_id = id dòng gộp', async () => {
    const ids = await newItems(5);
    await receive(ids.map((item_id, i) => ({ item_id, qty: i + 1 })));
    const rows = await auditPage();
    expect(rows).toHaveLength(1);
    const [head] = rows;
    expect(head).toMatchObject({
      action: 'stock.receipt',
      objectType: 'period',
      objectId: YM,
      objectLabel: { ym: YM },
    });
    expect(head.batch).toEqual({
      ym: YM,
      units: 15,
      items: ids.map((item_id, i) => ({
        item_id,
        name: 'Giấy A4 db',
        name_en: null,
        qty: i + 1,
      })),
    });
    const children = await auditPage('&action=stock.purchase');
    expect(children).toHaveLength(5);
    for (const c of children) expect(c.detail.batch_id).toBe(head.id);
  });

  it('hai lần Lưu → hai dòng gộp riêng, mỗi dòng đúng số món của lần đó', async () => {
    const before = (await auditPage()).length;
    await receive((await newItems(2)).map((item_id) => ({ item_id, qty: 1 })));
    await receive((await newItems(3)).map((item_id) => ({ item_id, qty: 2 })));
    const rows = await auditPage();
    expect(rows).toHaveLength(before + 2);
    expect(
      rows.slice(0, 2).map((r) => [r.batch?.items.length, r.batch?.units]),
    ).toEqual([
      [3, 6],
      [2, 2],
    ]);
  });

  it('dòng không thuộc đợt (Điều chỉnh tồn tay) vẫn là một dòng riêng, không có batch', async () => {
    const [id] = await newItems(1);
    await asActor(f.http().post(`/api/admin/items/${id}/stock`))
      .send({ delta: 4, reason: 'adjust', note: 'kiểm kê' })
      .expect(201);
    const rows = await auditPage('&action=stock.adjust');
    expect(rows).toHaveLength(1);
    expect(rows[0].batch).toBeUndefined();
    expect(rows[0].detail.batch_id).toBeUndefined();
  });
});
