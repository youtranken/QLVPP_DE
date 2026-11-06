import { DRIZZLE_DB } from '../src/database/database.module';
import type { Database } from '../src/database/database.module';
import { StockService } from '../src/modules/catalog/stock.service';
import { arrivalsFixture } from './arrivals.fixture';

const YM = '2026-11';
const LOCKED_AT = '2026-11-12T03:00:00Z';

class Rollback extends Error {}

// "Sắp hết" một luật theo phần trống (tồn − đang giữ) cho Tủ, thẻ Home, Danh mục và chuông
describe('V2D-16 Sắp hết theo phần trống ở mọi nơi (e2e)', () => {
  const f = arrivalsFixture('lowfree');
  const { A, B, ADMIN, as, http, pool, seedLine } = f;

  beforeEach(async () => {
    await f.resetPeriod(YM);
    await f.ensurePeriod('2026-12');
    f.freeze(LOCKED_AT);
  });

  const itemWith = async (stock: number, level: number) => {
    const item = await f.stockItem(0);
    await pool().query(
      'UPDATE items SET stock_qty = $2, restock_level = $3 WHERE id = $1',
      [item, stock, level],
    );
    return item;
  };
  const get = async <T>(url: string) =>
    (await as(http().get(url), ADMIN, 'admin').expect(200)).body as T;
  const pick = (ids: string[], mine: string[]) =>
    ids.filter((id) => mine.includes(id)).sort();

  it('tồn 10 giữ 9 mức 20 → Sắp hết; tồn 3 giữ 5 → không (thiếu); tồn 3 không ai giữ → Sắp hết: Home, Tủ, Danh mục, chuông cùng một tập', async () => {
    const x = await itemWith(10, 20);
    const y = await itemWith(3, 20);
    const z = await itemWith(3, 20);
    await seedLine(YM, A, { item_id: x, qty: 9 });
    await seedLine(YM, B, { item_id: y, qty: 5 });
    const mine = [x, y, z];
    const expected = [x, z].sort();

    const home = await get<{ id: string }[]>('/api/admin/stock/low');
    expect(
      pick(
        home.map((i) => i.id),
        mine,
      ),
    ).toEqual(expected);

    const stock =
      await get<{ item_id: string; stock_state: string }[]>('/api/admin/stock');
    const tu = stock.filter((r) => r.stock_state === 'low');
    expect(
      pick(
        tu.map((r) => r.item_id),
        mine,
      ),
    ).toEqual(expected);

    const catalog =
      await get<{ id: string; stock_state: string }[]>('/api/admin/items');
    const danhMuc = catalog.filter((i) => i.stock_state === 'low');
    expect(
      pick(
        danhMuc.map((i) => i.id),
        mine,
      ),
    ).toEqual(expected);

    let claimed: string[] = [];
    await f
      .app()
      .get<Database>(DRIZZLE_DB)
      .transaction(async (tx) => {
        const rows = await f
          .app()
          .get(StockService)
          .claimLowStockWithin(tx, new Date(LOCKED_AT));
        claimed = rows.map((r) => r.id);
        throw new Rollback();
      })
      .catch((e: unknown) => {
        if (!(e instanceof Rollback)) throw e;
      });
    expect(pick(claimed, mine)).toEqual(expected);
  });
});
