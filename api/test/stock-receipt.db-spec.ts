import { randomUUID } from 'node:crypto';
import { stockFixture } from './stock.fixture';

const YM = '2024-06';

describe('POST admin/stock/receipts: tất cả hoặc không, đồng thời (Postgres thật)', () => {
  const f = stockFixture();
  const { http, admin, qtyOf, newItem } = f;
  const receipts = (body: object) =>
    admin(http().post('/api/admin/stock/receipts')).send(body);
  const line = (item_id: string, qty: number, expected_stock_qty: number) => ({
    item_id,
    qty,
    expected_stock_qty,
  });
  const counts = async (ids: string[]) =>
    (
      await f.pool().query<{ m: string; a: string }>(
        `SELECT (SELECT count(*) FROM stock_movements WHERE item_id = ANY($1::uuid[])) AS m,
                (SELECT count(*) FROM audit_log al WHERE al.object_id = ANY($1::text[])
                   OR EXISTS (SELECT 1 FROM unnest($1::text[]) x
                              WHERE al.action = 'stock.receipt'
                                AND al.detail->'lines' @> jsonb_build_array(jsonb_build_object('item_id', x)))) AS a`,
        [ids],
      )
    ).rows[0];

  it('gửi lại cùng body (expected cũ) → 409 STALE_UPDATE, tồn không đổi', async () => {
    const a = await newItem(2);
    const body = { lines: [line(a, 5, 2)], ym: YM };
    await receipts(body).expect(200);
    const again = await receipts(body).expect(409);
    expect(again.body).toMatchObject({
      code: 'STALE_UPDATE',
      item_id: a,
      stock_qty: 7,
    });
    expect((await qtyOf(a)).stock_qty).toBe(7);
  });

  it('một dòng sai expected → không món nào được cộng, không movement, không audit', async () => {
    const a = await newItem(1);
    const b = await newItem(4);
    const res = await receipts({
      lines: [line(a, 5, 1), line(b, 5, 3)],
      ym: YM,
    }).expect(409);
    expect(res.body).toMatchObject({
      code: 'STALE_UPDATE',
      item_id: b,
      stock_qty: 4,
    });
    expect((await qtyOf(a)).stock_qty).toBe(1);
    expect((await qtyOf(b)).stock_qty).toBe(4);
    expect(await counts([a, b])).toEqual({ m: '0', a: '0' });
  });

  it('dòng sau không tồn tại → dòng trước cũng không được cộng (rollback, không savepoint)', async () => {
    const a = await newItem(1);
    await receipts({
      lines: [line(a, 5, 1), line(randomUUID(), 1, 0)],
      ym: YM,
    }).expect(404);
    expect((await qtyOf(a)).stock_qty).toBe(1);
    expect(await counts([a])).toEqual({ m: '0', a: '0' });
  });

  it('hai request đồng thời cùng expected (Promise.all) → đúng một 200, một 409, tồn cộng một lần', async () => {
    for (let round = 0; round < 5; round++) {
      const a = await newItem(0);
      const b = await newItem(0);
      const body = { lines: [line(a, 3, 0), line(b, 4, 0)], ym: YM };
      const res = await Promise.all([receipts(body), receipts(body)]);
      expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
      expect((await qtyOf(a)).stock_qty).toBe(3);
      expect((await qtyOf(b)).stock_qty).toBe(4);
    }
  });

  it('nhập song song với giao (Promise.all receipt + deliver cùng món) → không deadlock, tồn cuối đúng', async () => {
    const pool = f.pool();
    const tag = Date.now().toString(36);
    const owners: string[] = [];
    await pool.query(
      `INSERT INTO periods (ym, deadline) VALUES (($1 || '-01')::date, '2024-06-10T17:00:00Z')
       ON CONFLICT (ym) DO NOTHING`,
      [YM],
    );
    const reqs: string[] = [];
    for (let round = 0; round < 5; round++) {
      const owner = `db-receipt-owner-${tag}-${round}`;
      owners.push(owner);
      await pool.query(
        "INSERT INTO users (sub, full_name, status) VALUES ($1, 'Người nhận hàng', 'active')",
        [owner],
      );
      const a = await newItem(10);
      const b = await newItem(10);
      const req = (
        await pool.query<{ id: string }>(
          "INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES (($1 || '-01')::date, $2, $2) RETURNING id",
          [YM, owner],
        )
      ).rows[0].id;
      const lines = (
        await pool.query<{ id: string }>(
          `INSERT INTO request_lines (request_id, item_id, qty)
           VALUES ($1, $2, 2), ($1, $3, 2) RETURNING id`,
          [req, a, b],
        )
      ).rows;
      const [rec, del] = await Promise.all([
        receipts({ lines: [line(b, 5, 10), line(a, 5, 10)], ym: YM }),
        admin(http().post(`/api/admin/requests/${req}/deliver-all`)),
      ]);
      expect([rec.status, del.status]).toEqual([200, 200]);
      expect((await qtyOf(a)).stock_qty).toBe(13);
      expect((await qtyOf(b)).stock_qty).toBe(13);
      expect(lines).toHaveLength(2);
      reqs.push(req);
    }
    await pool.query(
      'DELETE FROM line_deliveries WHERE line_id IN (SELECT id FROM request_lines WHERE request_id = ANY($1))',
      [reqs],
    );
    await pool.query(
      'DELETE FROM stock_movements WHERE ref_line_id IN (SELECT id FROM request_lines WHERE request_id = ANY($1))',
      [reqs],
    );
    await pool.query('DELETE FROM requests WHERE id = ANY($1)', [reqs]);
    await pool.query('DELETE FROM users WHERE sub = ANY($1)', [owners]);
  });
});
