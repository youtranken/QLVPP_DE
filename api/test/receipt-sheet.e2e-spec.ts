import { arrivalsFixture } from './arrivals.fixture';

const YM = '2026-11';
const LOCKED_AT = '2026-11-12T03:00:00Z';

// Đủ hàng/Lưu đợt gửi id bản in đã đọc: bản mới hơn (Làm bản mới) → 409, không nhập theo số bản cũ
describe('V2D-5 nhập Hàng về kèm snapshot_id của bản in đang xem (e2e)', () => {
  const f = arrivalsFixture('rcsheet');
  const { A, insertSnapshot, pool, receipts, customReceive } = f;

  beforeEach(async () => {
    await f.resetPeriod(YM);
    f.freeze(LOCKED_AT);
  });

  const sheet = (orderQty: Record<string, number>, custom: object[] = []) => ({
    ym: YM,
    byItem: Object.keys(orderQty)
      .filter((k) => !k.startsWith('custom:'))
      .map((k) => ({
        key: k,
        item_id: k,
        name: 'x',
        unit: 'cay',
        requested: orderQty[k],
        backlog_prev: 0,
        stock: 0,
        need: 0,
      })),
    custom,
    order_qty: orderQty,
  });
  const stockOf = async (item: string) =>
    (
      await pool().query<{ stock_qty: number }>(
        'SELECT stock_qty FROM items WHERE id = $1',
        [item],
      )
    ).rows[0].stock_qty;
  const receive = (
    item: string,
    expected: number,
    snapshotId?: string | null,
  ) =>
    receipts({
      ym: YM,
      lines: [{ item_id: item, qty: 1, expected_stock_qty: expected }],
      ...(snapshotId === undefined ? {} : { snapshot_id: snapshotId }),
    });

  it('bản A → nhập với A 200; Làm bản mới B → nhập với A 409 STALE_UPDATE {snapshot_id: B}, tồn không đổi; với B 200; không gửi snapshot_id (về bù) → không kiểm', async () => {
    const item = await f.stockItem(0);
    const a = await insertSnapshot(
      YM,
      sheet({ [item]: 3 }),
      '2026-11-11T03:00:00Z',
    );
    await receive(item, 0, a).expect(200);
    const b = await insertSnapshot(
      YM,
      sheet({ [item]: 5 }),
      '2026-11-11T04:00:00Z',
    );
    const stale = await receive(item, 1, a).expect(409);
    expect(stale.body).toMatchObject({ code: 'STALE_UPDATE', snapshot_id: b });
    expect(await stockOf(item)).toBe(1);
    await receive(item, 1, b).expect(200);
    await receive(item, 2).expect(200);
  });

  it('client chưa thấy bản (snapshot_id null) mà nay đã có bản → 409 STALE_UPDATE; chưa có bản thật → 409 REPORT_NOT_SENT (chưa gửi NCC thì không nhận)', async () => {
    const item = await f.stockItem(0);
    const notSent = await receive(item, 0, null).expect(409);
    expect(notSent.body).toMatchObject({ code: 'REPORT_NOT_SENT', ym: YM });
    const a = await insertSnapshot(
      YM,
      sheet({ [item]: 3 }),
      '2026-11-11T03:00:00Z',
    );
    const stale = await receive(item, 1, null).expect(409);
    expect(stale.body).toMatchObject({ code: 'STALE_UPDATE', snapshot_id: a });
  });

  it('hàng ngoài DM: Lưu đợt với id bản cũ → 409 STALE_UPDATE, với bản mới nhất → 201', async () => {
    const name = f.customName('Kéo cắt');
    const line = await f.seedLine(YM, A, f.customCols(name, 2));
    const key = await f.customKey(line);
    const custom = [{ key, name, unit: 'cai', requested: 2, backlog_prev: 0 }];
    const a = await insertSnapshot(
      YM,
      sheet({ [key]: 2 }, custom),
      '2026-11-11T03:00:00Z',
    );
    const b = await insertSnapshot(
      YM,
      sheet({ [key]: 2 }, custom),
      '2026-11-11T04:00:00Z',
    );
    const body = { line_key: key, qty: 1, expected_received: 0 };
    const stale = await customReceive(YM, { ...body, snapshot_id: a }).expect(
      409,
    );
    expect(stale.body).toMatchObject({ code: 'STALE_UPDATE', snapshot_id: b });
    await customReceive(YM, { ...body, snapshot_id: b }).expect(201);
  });

  it('món còn bật nhưng nhóm đã ngừng, không có trong bản in → 404 ITEM_NOT_FOUND (như món ngừng)', async () => {
    const item = await f.stockItem(0);
    const { rows } = await pool().query<{ id: string }>(
      `INSERT INTO item_categories (name, active) VALUES ($1, false) RETURNING id`,
      [`rcsheet-stopped-${f.SUFFIX}`],
    );
    await pool().query('UPDATE items SET category_id = $2 WHERE id = $1', [
      item,
      rows[0].id,
    ]);
    // Kỳ đã gửi NCC (bản in không có món này)
    await insertSnapshot(
      YM,
      sheet({ 'custom:["khác","cai"]': 1 }),
      '2026-11-11T03:00:00Z',
    );
    try {
      const res = await receive(item, 0).expect(404);
      expect(res.body).toMatchObject({ code: 'ITEM_NOT_FOUND', item_id: item });
    } finally {
      await pool().query('UPDATE items SET category_id = NULL WHERE id = $1', [
        item,
      ]);
      await pool().query('DELETE FROM item_categories WHERE id = $1', [
        rows[0].id,
      ]);
    }
  });
});
