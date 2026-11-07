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

  const itemWith = async (stock: number, level: number | null) => {
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

  it('tồn 10 giữ 9 mức 20 → Sắp hết; tồn 3 giữ 10 (thiếu, kể cả chưa có mức) → Sắp hết ở Home/Danh mục/chuông, "Thiếu" ở Tủ, không bao giờ "Còn"; tồn 3 không ai giữ → Sắp hết; tồn 20 giữ 15 (trống 5 > 4) → không', async () => {
    const x = await itemWith(10, 20);
    const y = await itemWith(3, 20);
    const z = await itemWith(3, 20);
    const w = await itemWith(3, null);
    const ok = await itemWith(20, 20);
    await seedLine(YM, A, { item_id: x, qty: 9 });
    await seedLine(YM, B, { item_id: y, qty: 10 });
    await seedLine(YM, A, { item_id: w, qty: 10 });
    await seedLine(YM, B, { item_id: ok, qty: 15 });
    const mine = [x, y, z, w, ok];
    const expected = [x, y, z, w].sort();

    const home = await get<{ id: string }[]>('/api/admin/stock/low');
    expect(
      pick(
        home.map((i) => i.id),
        mine,
      ),
    ).toEqual(expected);

    const stock =
      await get<{ item_id: string; stock_state: string }[]>('/api/admin/stock');
    const tuState = (id: string) =>
      stock.find((r) => r.item_id === id)?.stock_state;
    expect([x, y, z, w, ok].map(tuState)).toEqual([
      'low',
      'short',
      'low',
      'short',
      'ok',
    ]);

    const catalog =
      await get<{ id: string; stock_state: string }[]>('/api/admin/items');
    const danhMuc = catalog.filter((i) => i.stock_state === 'low');
    expect(
      pick(
        danhMuc.map((i) => i.id),
        mine,
      ),
    ).toEqual(expected);
    expect(catalog.find((i) => i.id === ok)?.stock_state).toBe('ok');

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
