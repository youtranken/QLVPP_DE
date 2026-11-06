import { arrivalsFixture } from './arrivals.fixture';

const YM = '2026-11';
const LOCKED_AT = '2026-11-12T03:00:00Z';

describe('V2D-5 GET /admin/periods/:ym/arrivals-plan — Hàng về theo bản in (e2e)', () => {
  const f = arrivalsFixture('arrplan');
  const { A, B, ADMIN, insertSnapshot, plan, pool, purchase, receipts } = f;

  beforeEach(async () => {
    await f.resetPeriod(YM);
    f.freeze(LOCKED_AT);
  });

  const snapshotOf = (
    rows: { item: string; requested?: number; backlog?: number }[],
    orderQty: Record<string, number>,
  ) => ({
    ym: YM,
    byItem: rows.map((r) => ({
      key: r.item,
      item_id: r.item,
      name: 'x',
      unit: 'cay',
      requested: r.requested ?? 0,
      backlog_prev: r.backlog ?? 0,
      stock: 0,
      need: 0,
    })),
    custom: [],
    order_qty: orderQty,
  });

  it('nguồn = bản có hàng mới nhất: print 10:00 + xlsx 10:05 → 10:05; thêm print 10:10 → 10:10; bản rỗng mới hơn không là nguồn', async () => {
    const item = await f.stockItem(0);
    const data = snapshotOf([{ item }], { [item]: 2 });
    await insertSnapshot(YM, data, '2026-11-11T03:00:00Z', 'print');
    const xlsx = await insertSnapshot(YM, data, '2026-11-11T03:05:00Z', 'xlsx');
    expect((await plan(YM)).snapshot).toMatchObject({ id: xlsx, kind: 'xlsx' });
    const print = await insertSnapshot(YM, data, '2026-11-11T03:10:00Z');
    await insertSnapshot(
      YM,
      snapshotOf([{ item }], { [item]: 0 }),
      '2026-11-11T03:20:00Z',
    );
    expect((await plan(YM)).snapshot?.id).toBe(print);
  });

  it('cùng created_at → bản có id lớn hơn là nguồn', async () => {
    const item = await f.stockItem(0);
    const data = JSON.stringify(snapshotOf([{ item }], { [item]: 1 }));
    const at = '2026-11-11T04:00:00Z';
    for (const id of [
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      '00000000-0000-4000-8000-000000000001',
    ]) {
      await pool().query(
        `INSERT INTO report_snapshots (id, period_ym, kind, data, created_by_sub, created_at)
         VALUES ($1, '2026-11-01', 'print', $2::jsonb, $3, $4)`,
        [id, data, ADMIN, at],
      );
    }
    expect((await plan(YM)).snapshot?.id).toBe(
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
    );
  });

  it('ordered = order_qty[key] (12 khi số gộp 10); thiếu khóa → wantOf; received cộng nhiều đợt cùng receipt_ym, kỳ khác không tính; về 13 > 12 → remaining 0', async () => {
    const edited = await f.stockItem(0);
    const missing = await f.stockItem(0);
    await insertSnapshot(
      YM,
      snapshotOf(
        [
          { item: edited, requested: 8, backlog: 2 },
          { item: missing, requested: 3, backlog: 1 },
        ],
        { [edited]: 12 },
      ),
      '2026-11-11T05:00:00Z',
    );
    await purchase(edited, 2, YM, '2026-11-11T06:00:00Z');
    await purchase(edited, 2, YM, '2026-11-11T07:00:00Z');
    await purchase(edited, 50, '2026-10', '2026-11-11T07:30:00Z');
    let p = await plan(YM);
    expect(p.rows.find((r) => r.item_id === edited)).toMatchObject({
      key: edited,
      ordered: 12,
      received: 4,
      remaining: 8,
    });
    expect(p.rows.find((r) => r.item_id === missing)).toMatchObject({
      ordered: 4,
      received: 0,
      remaining: 4,
    });
    await purchase(edited, 9, YM, '2026-11-11T08:00:00Z');
    p = await plan(YM);
    expect(p.rows.find((r) => r.item_id === edited)).toMatchObject({
      received: 13,
      remaining: 0,
    });
  });

  it('chưa có bản (hoặc chỉ bản rỗng): snapshot null, ordered = đăng ký 8 + nợ 2 = 10, không trừ tủ 5', async () => {
    const item = await f.stockItem(5);
    await f.seedLine(YM, A, { item_id: item, qty: 8 });
    await f.seedLine('2026-10', B, { item_id: item, qty: 2 });
    await insertSnapshot(
      YM,
      snapshotOf([{ item }], { [item]: 0 }),
      '2026-11-11T05:00:00Z',
    );
    const p = await plan(YM);
    expect(p.snapshot).toBeNull();
    expect(p.custom).toEqual([]);
    expect(p.rows.find((r) => r.item_id === item)).toMatchObject({
      ordered: 10,
      received: 0,
      remaining: 10,
      stock_qty: 5,
      usable: true,
      adm_out: false,
      adm_out_final: false,
      reduced_after_snapshot: 0,
    });
  });

  it('món ngừng có trong bản in đặt 3 → nhập 3 thành công, ghi receipt_ym; hàng usable false; món ngừng không trong bản in → 404 ITEM_NOT_FOUND', async () => {
    const stopped = await f.stockItem(0);
    const stray = await f.stockItem(0);
    await insertSnapshot(
      YM,
      snapshotOf([{ item: stopped, requested: 3 }], { [stopped]: 3 }),
      '2026-11-11T05:00:00Z',
    );
    await pool().query(
      'UPDATE items SET active = false WHERE id = ANY($1::uuid[])',
      [[stopped, stray]],
    );
    const res = await receipts({
      ym: YM,
      lines: [{ item_id: stopped, qty: 3, expected_stock_qty: 0 }],
    }).expect(200);
    expect(res.body.items[0]).toMatchObject({ item_id: stopped, stock_qty: 3 });
    const { rows } = await pool().query<{ receipt_ym: string; note: string }>(
      "SELECT to_char(receipt_ym, 'YYYY-MM') AS receipt_ym, note FROM stock_movements WHERE item_id = $1",
      [stopped],
    );
    expect(rows).toEqual([{ receipt_ym: YM, note: `Hàng về kỳ ${YM}` }]);
    expect(
      (await plan(YM)).rows.find((r) => r.item_id === stopped),
    ).toMatchObject({
      usable: false,
      inactive_reason: 'item',
      ordered: 3,
      received: 3,
      remaining: 0,
    });
    await receipts({
      ym: YM,
      lines: [{ item_id: stray, qty: 3, expected_stock_qty: 0 }],
    }).expect(404, /ITEM_NOT_FOUND/);
    expect(
      (await plan(YM)).rows.find((r) => r.item_id === stray),
    ).toBeUndefined();
  });

  it('reduced_after_snapshot: giảm 3 lúc T+1ms → 3; giảm lúc T (không sau bản) → 0', async () => {
    const after = await f.stockItem(0);
    const at = await f.stockItem(0);
    const T = '2026-11-11T05:00:00.000Z';
    await insertSnapshot(
      YM,
      snapshotOf(
        [
          { item: after, requested: 10 },
          { item: at, requested: 10 },
        ],
        { [after]: 10, [at]: 10 },
      ),
      T,
    );
    const adjust = (item: string, createdAt: string) =>
      pool().query(
        `INSERT INTO request_line_adjustments
           (batch_id, period_ym, user_sub, request_id, line_id, item_id, name, unit,
            qty_before, qty_after, reason_code, actor_sub, created_at)
         VALUES (gen_random_uuid(), '2026-11-01', $1, gen_random_uuid(), gen_random_uuid(),
                 $2, 'x', 'cay', 10, 7, 'over_quota', $3, $4)`,
        [A, item, ADMIN, createdAt],
      );
    await adjust(after, '2026-11-11T05:00:00.001Z');
    await adjust(at, T);
    const p = await plan(YM);
    expect(
      p.rows.find((r) => r.item_id === after)?.reduced_after_snapshot,
    ).toBe(3);
    expect(p.rows.find((r) => r.item_id === at)?.reduced_after_snapshot).toBe(
      0,
    );
  });

  it('batches: hai lần nhập → 2 đợt (mới trước) với người nhập, số món, đơn vị, ghi chú của người nhập; hàng thêm ngoài bản in có ordered 0', async () => {
    const a = await f.stockItem(0);
    const b = await f.stockItem(0);
    await insertSnapshot(
      YM,
      snapshotOf([{ item: a, requested: 5 }], { [a]: 5 }),
      '2026-11-11T05:00:00Z',
    );
    await receipts({
      ym: YM,
      lines: [{ item_id: a, qty: 2, expected_stock_qty: 0 }],
    }).expect(200);
    await receipts({
      ym: YM,
      note: 'đợt hai',
      lines: [
        { item_id: a, qty: 3, expected_stock_qty: 2 },
        { item_id: b, qty: 1, expected_stock_qty: 0 },
      ],
    }).expect(200);
    const p = await plan(YM);
    const mine = p.batches.filter((x) => x.actor_name === 'Hành chính');
    expect(mine.slice(0, 2)).toEqual([
      {
        at: expect.any(String),
        actor_name: 'Hành chính',
        items: 2,
        units: 4,
        note: 'đợt hai',
      },
      {
        at: expect.any(String),
        actor_name: 'Hành chính',
        items: 1,
        units: 2,
        note: null,
      },
    ]);
    expect(p.rows.find((r) => r.item_id === b)).toMatchObject({
      ordered: 0,
      received: 1,
      remaining: 0,
    });
  });

  it('member → 403; kỳ mở → 409 PERIOD_NOT_LOCKED', async () => {
    await f
      .as(f.http().get(`/api/admin/periods/${YM}/arrivals-plan`), A)
      .expect(403);
    f.freeze('2026-11-10T16:59:59.999Z');
    await f.planRes(YM).expect(409, /PERIOD_NOT_LOCKED/);
    f.freeze('2026-11-10T17:00:00.000Z');
    await f.planRes(YM).expect(200);
  });
});
