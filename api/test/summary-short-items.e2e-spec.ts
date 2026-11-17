import { adminSummaryFixture } from './admin-summary.fixture';

// Kỳ quá khứ riêng — không suite nào khác ghi phiếu vào 2023-04
const YM = '2023-04';

type Row = { request_id: string; short_items: string[] };

describe('admin/periods/:ym/requests by=person — short_items (G1 cột Tủ)', () => {
  // Khai báo trước fixture: afterAll chạy theo thứ tự khai báo, fixture đóng pool
  afterAll(async () => {
    await fx()
      .pool()
      .query('DELETE FROM request_lines WHERE item_id = $1', [enough]);
    await fx().pool().query('DELETE FROM requests WHERE id = $1', [debtReq]);
    await fx().pool().query('DELETE FROM items WHERE id = $1', [enough]);
  });
  const f = adminSummaryFixture(YM);
  const fx = () => f;
  const { SUFFIX, ids, asAdmin } = f;
  let enough = '';
  let debtReq = '00000000-0000-0000-0000-000000000000';

  const rowsOf = async () =>
    (
      (await asAdmin(`/periods/${YM}/requests?by=person`).expect(200)).body as {
        items: Row[];
      }
    ).items;

  beforeAll(async () => {
    enough = (
      await f
        .pool()
        .query<{ id: string }>(
          `INSERT INTO items (name, unit, max_qty, stock_qty) VALUES ($1, 'cay', 9, 10) RETURNING id`,
          [`e2e-sum-enough-${SUFFIX}`],
        )
    ).rows[0].id;
    await f.addLine(ids.r1, { item_id: enough, qty: 4 });
    await f.addLine(ids.r2, { item_id: enough, qty: 6 });
  });

  const setStock = (id: string, qty: number) =>
    f.pool().query('UPDATE items SET stock_qty = $2 WHERE id = $1', [id, qty]);

  it('tủ = tổng còn phải giao cả kỳ (4 + 6 = 10) → không thiếu; tủ = 9 → cả hai người có món đó trong short_items', async () => {
    await setStock(enough, 10);
    let rows = await rowsOf();
    expect(rows.find((r) => r.request_id === ids.r1)!.short_items).toEqual([]);
    await setStock(enough, 9);
    rows = await rowsOf();
    expect(rows.find((r) => r.request_id === ids.r1)!.short_items).toEqual([
      `e2e-sum-enough-${SUFFIX}`,
    ]);
    expect(rows.find((r) => r.request_id === ids.r2)!.short_items).toContain(
      `e2e-sum-enough-${SUFFIX}`,
    );
  });

  it('dòng đã giao đủ không tính: U1 giao xong món chính (3/3) nên món đó không vào short_items của U1 dù tủ 0', async () => {
    await setStock(ids.item, 0);
    await setStock(enough, 10);
    const rows = await rowsOf();
    expect(rows.find((r) => r.request_id === ids.r1)!.short_items).toEqual([]);
    // U2 còn 2 cây món chính chưa giao, tủ 0 → thiếu
    expect(rows.find((r) => r.request_id === ids.r2)!.short_items).toEqual([
      `e2e-sum-item-${SUFFIX}`,
    ]);
  });

  it('tính cả nợ kỳ trước như Giao hàng: còn phải giao kỳ này 10 + nợ 2023-03 là 2 → tủ 12 đủ, tủ 11 thiếu', async () => {
    const pool = f.pool();
    await pool.query(
      `INSERT INTO periods (ym, deadline) VALUES ('2023-03-01', '2023-03-10T17:00:00Z') ON CONFLICT (ym) DO NOTHING`,
    );
    debtReq = (
      await pool.query<{ id: string }>(
        `INSERT INTO requests (period_ym, user_sub, department, created_by_sub)
         VALUES ('2023-03-01', $1, 'Phòng B', $1) RETURNING id`,
        [f.U3],
      )
    ).rows[0].id;
    await f.addLine(debtReq, { item_id: enough, qty: 2 });
    try {
      await setStock(enough, 12);
      let rows = await rowsOf();
      expect(rows.find((r) => r.request_id === ids.r1)!.short_items).toEqual(
        [],
      );
      await setStock(enough, 11);
      rows = await rowsOf();
      expect(rows.find((r) => r.request_id === ids.r1)!.short_items).toEqual([
        `e2e-sum-enough-${SUFFIX}`,
      ]);
    } finally {
      await pool.query('DELETE FROM requests WHERE id = $1', [debtReq]);
    }
  });

  it('kỳ sau kỳ đang xem không tính: phiếu 2023-05 còn 5 không làm 2023-04 thiếu khi tủ 10', async () => {
    const pool = f.pool();
    await pool.query(
      `INSERT INTO periods (ym, deadline) VALUES ('2023-05-01', '2023-05-10T17:00:00Z') ON CONFLICT (ym) DO NOTHING`,
    );
    const later = (
      await pool.query<{ id: string }>(
        `INSERT INTO requests (period_ym, user_sub, department, created_by_sub)
         VALUES ('2023-05-01', $1, 'Phòng B', $1) RETURNING id`,
        [f.U3],
      )
    ).rows[0].id;
    await f.addLine(later, { item_id: enough, qty: 5 });
    try {
      await setStock(enough, 10);
      const rows = await rowsOf();
      expect(rows.find((r) => r.request_id === ids.r1)!.short_items).toEqual(
        [],
      );
    } finally {
      await pool.query('DELETE FROM requests WHERE id = $1', [later]);
    }
  });
});
