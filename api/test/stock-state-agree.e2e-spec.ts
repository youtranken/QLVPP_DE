import { DRIZZLE_DB } from '../src/database/database.module';
import type { Database } from '../src/database/database.module';
import { StockService } from '../src/modules/catalog/stock.service';
import { arrivalsFixture } from './arrivals.fixture';

const YM = '2026-11';
const LOCKED_AT = '2026-11-12T03:00:00Z';

class Rollback extends Error {}

// Một món, mọi nơi cùng một trạng thái: Tủ/Kho, Danh mục (GET admin/items), thẻ Home, KPI Home và chuông sắp hết
describe('Trạng thái kho thống nhất Tủ ↔ Danh mục ↔ Home ↔ chuông (e2e)', () => {
  const f = arrivalsFixture('stkagree');
  const { A, B, ADMIN, as, http, insertSnapshot, pool, seedLine } = f;

  beforeEach(async () => {
    await f.resetPeriod(YM);
    await f.ensurePeriod('2026-12');
    f.freeze(LOCKED_AT);
  });

  const itemWith = async (stock: number, level: number | null) => {
    const item = await f.stockItem(0);
    await pool().query('UPDATE items SET stock_qty = $2, restock_level = $3 WHERE id = $1', [item, stock, level]);
    return item;
  };
  const get = async <T>(url: string) => (await as(http().get(url), ADMIN, 'admin').expect(200)).body as T;
  const row = (item: string, qty: number) => ({ key: item, item_id: item, name: 'x', unit: 'cai', requested: qty, backlog_prev: 0, stock: 0, need: 0 });
  const claimed = async () => {
    let ids: string[] = [];
    await f
      .app()
      .get<Database>(DRIZZLE_DB)
      .transaction(async (tx) => {
        ids = (await f.app().get(StockService).claimLowStockWithin(tx, new Date(LOCKED_AT))).map((r) => r.id);
        throw new Rollback();
      })
      .catch((e: unknown) => {
        if (!(e instanceof Rollback)) throw e;
      });
    return ids;
  };

  it('ok · low · thiếu có hàng đang về (Chờ hàng về) · thiếu không hàng về · chưa theo dõi: Tủ, Danh mục, Home, KPI, chuông khớp nhau', async () => {
    const ok = await itemWith(10, 10);
    const low = await itemWith(1, 10);
    const coming = await itemWith(1, 10);
    const short = await itemWith(1, 10);
    const untracked = await itemWith(5, null);
    await seedLine(YM, A, { item_id: coming, qty: 3 });
    await seedLine(YM, B, { item_id: short, qty: 3 });
    // Bản in K* đặt 2 cho món đang chờ 3 với tủ 1 → đủ khi hàng về
    await insertSnapshot(YM, { ym: YM, byItem: [row(coming, 3)], custom: [], order_qty: { [coming]: 2 } }, '2026-11-11T03:00:00Z');
    const mine = [ok, low, coming, short, untracked];

    const tu = await get<{ item_id: string; stock_state: string }[]>('/api/admin/stock');
    expect(mine.map((id) => tu.find((r) => r.item_id === id)?.stock_state)).toEqual(['ok', 'low', 'incoming', 'short', 'untracked']);

    const catalog = await get<{ id: string; active: boolean; stock_state: string }[]>('/api/admin/items');
    expect(mine.map((id) => catalog.find((i) => i.id === id)?.stock_state)).toEqual(['ok', 'low', 'incoming', 'low', 'untracked']);

    const flagged = [low, short].sort();
    const home = await get<{ id: string; stock_state: string }[]>('/api/admin/stock/low');
    expect(home.filter((i) => mine.includes(i.id)).map((i) => i.id).sort()).toEqual(flagged);
    expect(home.every((i) => i.stock_state === 'low')).toBe(true);

    const kpi = await get<{ low_stock: number }>(`/api/admin/periods/${YM}/summary`);
    expect(kpi.low_stock).toBe(home.length);
    expect(catalog.filter((i) => i.active && i.stock_state === 'low').map((i) => i.id).sort()).toEqual(home.map((i) => i.id).sort());

    expect((await claimed()).filter((id) => mine.includes(id)).sort()).toEqual(flagged);
  });
});
