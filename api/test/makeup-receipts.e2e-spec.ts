import { arrivalsFixture } from './arrivals.fixture';

const P = '2026-12';
const K = '2027-01';
const K_LOCKED = '2027-01-12T03:00:00Z';

describe('V2D-5 Về bù kỳ trước, ADM không giao nữa (e2e)', () => {
  const f = arrivalsFixture('makeup');
  const { A, plan, pool, receipts, closeOwed, reopenOwed } = f;

  beforeAll(async () => {
    await f.ensurePeriod(P);
    await f.ensurePeriod(K);
  });

  beforeEach(async () => {
    await f.resetPeriod(P);
    await f.resetPeriod(K);
  });

  // Kỳ 12 đặt BB 7, về 3, A còn chờ 4; kỳ 01 khóa
  const seedOwed = async () => {
    const bb = await f.stockItem(3);
    await f.seedLine(P, A, { item_id: bb, qty: 7, delivered_qty: 3 });
    await f.insertSnapshot(
      P,
      {
        ym: P,
        byItem: [{ key: bb, item_id: bb, requested: 7, backlog_prev: 0 }],
        custom: [],
        order_qty: { [bb]: 7 },
      },
      '2026-12-11T03:00:00Z',
    );
    await f.purchase(bb, 3, P, '2026-12-15T03:00:00Z');
    f.freeze(K_LOCKED);
    return bb;
  };
  const kRow = async (bb: string) => f.itemRow(await f.build(K), bb);

  it('kỳ 01 có makeup kỳ 12 BB 4; nhập 4 với ym 2026-12 → received kỳ 12 = 7, ghi chú "Về bù kỳ 2026-12", không vào kỳ 01; khối về bù hết hàng', async () => {
    const bb = await seedOwed();
    expect((await plan(K)).makeup).toEqual([
      {
        ym: P,
        rows: [
          expect.objectContaining({
            key: bb,
            item_id: bb,
            ordered: 7,
            received: 3,
            adm_owed: 4,
            stock_qty: 3,
          }),
        ],
      },
    ]);
    expect(await kRow(bb)).toMatchObject({ backlog_prev: 4, adm_owed: 4 });
    await receipts({
      ym: P,
      lines: [{ item_id: bb, qty: 4, expected_stock_qty: 3 }],
    }).expect(200);
    const { rows } = await pool().query<{ note: string; receipt_ym: string }>(
      `SELECT note, to_char(receipt_ym, 'YYYY-MM') AS receipt_ym FROM stock_movements
       WHERE item_id = $1 AND actor_sub = $2 AND delta = 4`,
      [bb, f.ADMIN],
    );
    expect(rows).toEqual([{ note: `Về bù kỳ ${P}`, receipt_ym: P }]);
    expect((await plan(P)).rows.find((r) => r.item_id === bb)).toMatchObject({
      ordered: 7,
      received: 7,
      remaining: 0,
    });
    const k = await plan(K);
    expect(k.makeup).toEqual([]);
    expect(k.rows.find((r) => r.item_id === bb)?.received ?? 0).toBe(0);
    expect((await kRow(bb))?.adm_owed).toBe(0);
  });

  it('ADM không giao nữa → admOwed 0 (đề nghị kỳ 01 cộng lại 4), audit before/after, PUT lặp không ghi thêm; DELETE → trừ lại', async () => {
    const bb = await seedOwed();
    const audits = async (action: string) =>
      (await f.auditRows(action, P)).filter((r) => r.detail.line_key === bb);
    await closeOwed(P, bb).expect(200, {
      line_key: bb,
      item_id: bb,
      owed_closed: true,
    });
    await closeOwed(P, bb).expect(200);
    expect(
      (await audits('arrival.adm_owed_closed')).map((r) => r.detail),
    ).toEqual([
      {
        line_key: bb,
        before: { owed_closed: false },
        after: { owed_closed: true },
      },
    ]);
    expect(await kRow(bb)).toMatchObject({ backlog_prev: 4, adm_owed: 0 });
    expect((await plan(K)).makeup).toEqual([]);
    await reopenOwed(P, bb).expect(204);
    expect(await audits('arrival.adm_owed_reopened')).toHaveLength(1);
    expect((await kRow(bb))?.adm_owed).toBe(4);
    await reopenOwed(P, bb).expect(204);
    expect(await audits('arrival.adm_owed_reopened')).toHaveLength(1);
  });

  it('kỳ P không có bản in (chưa gửi / không cần đề nghị) → không có hàng về bù', async () => {
    const bb = await f.stockItem(0);
    await f.seedLine(P, A, { item_id: bb, qty: 7 });
    f.freeze(K_LOCKED);
    expect(
      (await plan(K)).makeup.flatMap((m) => m.rows).map((r) => r.key),
    ).not.toContain(bb);
  });
});
