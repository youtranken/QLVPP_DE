import { arrivalsFixture } from './arrivals.fixture';

const YM = '2026-11';
const PREV = '2026-10';
const LOCKED_AT = '2026-11-12T03:00:00Z';
const LAST_OPEN_MS = '2026-11-10T16:59:59.999Z';
const FIRST_LOCKED_MS = '2026-11-10T17:00:00.000Z';

interface StockListRow {
  item_id: string;
  stock_qty: number;
  held: number;
  free: number;
  short: number;
  incoming: number;
  awaiting: number;
  waiting: number;
  stock_state: string;
}

describe('V2D-16 GET /admin/stock — Tủ/Kho theo người đang chờ (e2e)', () => {
  const f = arrivalsFixture('stkheld');
  const { A, B, ADMIN, as, http, insertSnapshot, pool, seedLine } = f;

  beforeEach(async () => {
    await f.resetPeriod(YM);
    await f.resetPeriod(PREV);
    await f.ensurePeriod('2026-12');
    f.freeze(LOCKED_AT);
  });

  const list = async (role = 'admin') =>
    (await as(http().get('/api/admin/stock'), ADMIN, role).expect(200))
      .body as StockListRow[];
  const rowOf = async (item: string) =>
    (await list()).find((r) => r.item_id === item)!;
  const setStock = (item: string, stock: number, level: number | null) =>
    pool().query(
      'UPDATE items SET stock_qty = $2, restock_level = $3 WHERE id = $1',
      [item, stock, level],
    );
  const itemWith = async (stock: number, level: number | null) => {
    const item = await f.stockItem(0);
    await setStock(item, stock, level);
    return item;
  };
  const snapshotOf = (ym: string, item: string, qty: number) => ({
    ym,
    byItem: [
      {
        key: item,
        item_id: item,
        name: 'x',
        unit: 'cai',
        requested: qty,
        backlog_prev: 0,
        stock: 0,
        need: 0,
      },
    ],
    custom: [],
    order_qty: { [item]: qty },
  });

  it.each([
    [0, 0, 5, { held: 0, free: 0, short: 0, stock_state: 'none' }],
    [0, 3, 5, { held: 3, free: 0, short: 3, stock_state: 'short' }],
    [10, 10, 2, { held: 10, free: 0, short: 0, stock_state: 'low' }],
    [10, 12, null, { held: 12, free: 0, short: 2, stock_state: 'short' }],
    [20, 2, 5, { held: 2, free: 18, short: 0, stock_state: 'ok' }],
    [4, 0, null, { held: 0, free: 4, short: 0, stock_state: 'untracked' }],
  ])('tủ %i, giữ %i, mức %p → %o', async (stock, held, level, expected) => {
    const item = await itemWith(stock, level);
    if (held > 0) await seedLine(YM, A, { item_id: item, qty: held });
    expect(await rowOf(item)).toMatchObject({
      stock_qty: stock,
      incoming: 0,
      ...expected,
    });
  });

  it('held = Σ remaining dòng kỳ khóa (sau giao/hủy), dòng kỳ mở không tính; waiting = số người', async () => {
    const item = await itemWith(1, null);
    await seedLine(YM, A, {
      item_id: item,
      qty: 6,
      delivered_qty: 2,
      cancelled_qty: 1,
    });
    await seedLine(PREV, B, { item_id: item, qty: 2 });
    await seedLine('2026-12', A, { item_id: item, qty: 9 });
    expect(await rowOf(item)).toMatchObject({
      held: 5,
      waiting: 2,
      short: 4,
    });
  });

  it('người đã nghỉ (status locked) không giữ hàng: chỉ phần của người đang làm vào held/waiting', async () => {
    const item = await itemWith(1, null);
    await seedLine(YM, A, { item_id: item, qty: 2 });
    await seedLine(YM, B, { item_id: item, qty: 3 });
    await pool().query("UPDATE users SET status = 'locked' WHERE sub = $1", [
      B,
    ]);
    try {
      expect(await rowOf(item)).toMatchObject({
        held: 2,
        waiting: 1,
        short: 1,
      });
    } finally {
      await pool().query("UPDATE users SET status = 'active' WHERE sub = $1", [
        B,
      ]);
    }
  });

  it('mốc khóa sổ tới ms: .999 dòng kỳ 2026-11 chưa giữ; .000 giữ', async () => {
    const item = await itemWith(0, null);
    await seedLine(YM, A, { item_id: item, qty: 2 });
    f.freeze(LAST_OPEN_MS);
    expect(await rowOf(item)).toMatchObject({ held: 0, stock_state: 'none' });
    f.freeze(FIRST_LOCKED_MS);
    expect(await rowOf(item)).toMatchObject({ held: 2, short: 2 });
  });

  it('ngay sau khóa: tủ 0 giữ 5 đặt 5 → incoming 5 "Chờ hàng về 5"; về 3 → awaiting 2; ADM hết hàng → short 2', async () => {
    const item = await itemWith(0, null);
    await seedLine(YM, A, { item_id: item, qty: 5 });
    await insertSnapshot(YM, snapshotOf(YM, item, 5), '2026-11-11T03:00:00Z');
    expect(await rowOf(item)).toMatchObject({
      incoming: 5,
      awaiting: 5,
      short: 0,
      stock_state: 'incoming',
    });

    await f.purchase(item, 3, YM, '2026-11-11T04:00:00Z');
    await setStock(item, 3, 3);
    expect(await rowOf(item)).toMatchObject({
      stock_qty: 3,
      incoming: 2,
      awaiting: 2,
      short: 0,
      stock_state: 'incoming',
    });

    await f.markOut(YM, item).expect(200);
    expect(await rowOf(item)).toMatchObject({
      incoming: 0,
      short: 2,
      stock_state: 'short',
    });
  });

  it('incoming cộng adm_owed kỳ trước: kỳ 10 đặt 4 chưa về, A còn chờ 4 → incoming 4', async () => {
    const item = await itemWith(0, null);
    await seedLine(PREV, A, { item_id: item, qty: 4 });
    await insertSnapshot(
      PREV,
      snapshotOf(PREV, item, 4),
      '2026-10-11T03:00:00Z',
    );
    expect(await rowOf(item)).toMatchObject({
      held: 4,
      incoming: 4,
      short: 0,
      stock_state: 'incoming',
    });
  });

  it('vai member → 403', async () => {
    await as(http().get('/api/admin/stock'), A, 'member').expect(403);
  });
});

describe('V2D-16 Xuất lẻ lấy phần đang giữ: audit took_held (e2e)', () => {
  const f = arrivalsFixture('stktook');
  const { A, B, ADMIN, as, http, seedLine } = f;

  beforeEach(() => f.freeze(LOCKED_AT));

  const issue = (item: string, qty: number) =>
    as(http().post(`/api/admin/items/${item}/issue`), ADMIN, 'admin').send({
      qty,
      reason: 'phòng họp',
    });
  const heldItem = async () => {
    const item = await f.stockItem(5);
    await seedLine(YM, A, { item_id: item, qty: 2 });
    await seedLine(YM, B, { item_id: item, qty: 2 });
    return item;
  };
  const tookHeld = async (item: string) =>
    (await f.auditRows('stock.issue', item)).map((r) => r.detail.took_held);

  it('tủ 5 giữ 4: xuất 1 → took_held 0', async () => {
    const item = await heldItem();
    await issue(item, 1).expect(201);
    expect(await tookHeld(item)).toEqual([0]);
  });

  it('tủ 5 giữ 4: xuất 3 → 201, took_held 2, tủ 2', async () => {
    const item = await heldItem();
    await issue(item, 3).expect(201);
    expect(await tookHeld(item)).toEqual([2]);
    expect(await f.stockOf(item)).toBe(2);
  });

  it('tủ 5: xuất 5 → took_held 4; xuất 6 → 409 STOCK_INSUFFICIENT, không audit', async () => {
    const item = await heldItem();
    await issue(item, 6).expect(409, /STOCK_INSUFFICIENT/);
    expect(await tookHeld(item)).toEqual([]);
    await issue(item, 5).expect(201);
    expect(await tookHeld(item)).toEqual([4]);
  });
});
