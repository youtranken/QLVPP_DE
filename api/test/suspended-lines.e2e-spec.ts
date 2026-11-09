import type { DeliveryPerson } from '../src/modules/delivery/delivery.dto';
import { arrivalsFixture } from './arrivals.fixture';

const YM = '2026-11';
const LOCKED_AT = '2026-11-12T03:00:00Z';

interface PersonRow {
  user_sub: string;
  line_count: number;
  total_qty: number;
  custom_pending: number;
}

// Mục 7 vòng 4: dòng món đang tạm ngưng (món hoặc nhóm) chưa giao gì và dòng ngoài DM chưa duyệt không được tính ở kỳ khóa
describe('Dòng món tạm ngưng không tính vào tổng hợp kỳ khóa (e2e)', () => {
  const f = arrivalsFixture('suspended');
  const {
    A,
    ADMIN,
    SUFFIX,
    as,
    build,
    customCols,
    customName,
    http,
    insertSnapshot,
    itemRow,
    plan,
    pool,
    seedLine,
    stockItem,
  } = f;
  const DEPT = `Phòng susp ${SUFFIX}`;
  let category = '';

  beforeAll(async () => {
    category = (
      await pool().query<{ id: string }>(
        'INSERT INTO item_categories (name) VALUES ($1) RETURNING id',
        [`e2e-susp-cat-${SUFFIX}`],
      )
    ).rows[0].id;
  });
  f.onCleanup(async (p) => {
    // Món của suite bị fixture xóa sau cleanups → gỡ nhóm trước để xóa được nhóm
    await p.query(
      'UPDATE items SET category_id = NULL WHERE category_id = $1',
      [category],
    );
    await p.query('DELETE FROM item_categories WHERE id = $1', [category]);
  });

  beforeEach(async () => {
    await f.resetPeriod(YM);
    f.freeze(LOCKED_AT);
  });

  const setActive = (ids: string[], active: boolean) =>
    pool().query('UPDATE items SET active = $2 WHERE id = ANY($1::uuid[])', [
      ids,
      active,
    ]);
  const person = async () => {
    const res = await as(
      http().get(
        `/api/admin/periods/${YM}/requests?by=person&q=${encodeURIComponent(DEPT)}`,
      ),
      ADMIN,
      'admin',
    ).expect(200);
    return (res.body as { items: PersonRow[] }).items.find(
      (p) => p.user_sub === A,
    );
  };
  const pendingDelivery = async () =>
    (
      (
        await as(
          http().get(`/api/admin/periods/${YM}/summary`),
          ADMIN,
          'admin',
        ).expect(200)
      ).body as { lines_pending_delivery: number }
    ).lines_pending_delivery;
  const deliveryLines = async () =>
    (
      (
        await as(
          http().get(`/api/admin/periods/${YM}/delivery-people`),
          ADMIN,
          'admin',
        ).expect(200)
      ).body as { people: DeliveryPerson[] }
    ).people.find((p) => p.user_sub === A)?.lines ?? [];

  // Phiếu A kỳ khóa: 3 dòng món sẽ ngừng, 2 dòng món thường, 1 dòng ngoài DM đang chờ duyệt
  const scenario = async () => {
    const before = await pendingDelivery();
    const stopped = await Promise.all([0, 0, 0].map(() => stockItem(0)));
    const normal = await Promise.all([0, 0].map(() => stockItem(0)));
    for (const item of [...stopped, ...normal])
      await seedLine(YM, A, { item_id: item, qty: 1 }, DEPT);
    await seedLine(
      YM,
      A,
      customCols(customName('day rut'), 1, 'pending'),
      DEPT,
    );
    await setActive(stopped, false);
    return { before, stopped, normal };
  };

  it('Số món/Tổng chỉ đếm dòng hiệu lực: 3 món ngừng + 1 ngoài DM chờ duyệt → 2 / 2, custom_pending 1', async () => {
    await scenario();
    expect(await person()).toMatchObject({
      line_count: 2,
      total_qty: 2,
      custom_pending: 1,
    });
  });

  it('báo cáo: byItem không có món ngừng, byDepartment của A chỉ 2 dòng; lines_pending_delivery tăng 2', async () => {
    const { before, stopped, normal } = await scenario();
    const r = await build(YM);
    for (const item of stopped) expect(itemRow(r, item)).toBeUndefined();
    for (const item of normal)
      expect(itemRow(r, item)).toMatchObject({ requested: 1 });
    const dept = r.byDepartment.find((d) => d.department === DEPT);
    const mine = dept?.people.find((p) => p.user_sub === A);
    expect(mine?.lines).toHaveLength(2);
    expect((await pendingDelivery()) - before).toBe(2);
  });

  it('bật lại một món → tính lại ngay ở Số món/Tổng và báo cáo', async () => {
    const { stopped } = await scenario();
    await setActive([stopped[0]], true);
    expect(await person()).toMatchObject({ line_count: 3, total_qty: 3 });
    expect(itemRow(await build(YM), stopped[0])).toMatchObject({
      requested: 1,
    });
  });

  it('ngừng nhóm của một món thường → món đó không còn được tính; bật nhóm lại thì tính', async () => {
    const { normal } = await scenario();
    await pool().query('UPDATE items SET category_id = $2 WHERE id = $1', [
      normal[0],
      category,
    ]);
    await pool().query(
      'UPDATE item_categories SET active = false WHERE id = $1',
      [category],
    );
    expect(await person()).toMatchObject({ line_count: 1, total_qty: 1 });
    expect(itemRow(await build(YM), normal[0])).toBeUndefined();
    await pool().query(
      'UPDATE item_categories SET active = true WHERE id = $1',
      [category],
    );
    expect(await person()).toMatchObject({ line_count: 2, total_qty: 2 });
  });

  it('dòng món ngừng đã giao một phần (giao 1/2) vẫn được tính', async () => {
    const { stopped } = await scenario();
    const partial = await stockItem(0);
    await seedLine(YM, A, { item_id: partial, qty: 2, delivered_qty: 1 }, DEPT);
    await setActive([partial], false);
    expect(await person()).toMatchObject({ line_count: 3, total_qty: 4 });
    expect(itemRow(await build(YM), stopped[0])).toBeUndefined();
  });

  it('Giao theo người: không có dòng món ngừng', async () => {
    const { stopped, normal } = await scenario();
    const items = (await deliveryLines()).map((l) => l.item_id);
    for (const item of stopped) expect(items).not.toContain(item);
    for (const item of normal) expect(items).toContain(item);
  });

  it('Nhận hàng: món ngừng không có trong bản in → không có hàng; có trong bản in → vẫn có hàng, usable false, ordered theo bản in', async () => {
    const { stopped } = await scenario();
    const [inPrint, notInPrint] = stopped;
    await insertSnapshot(
      YM,
      {
        ym: YM,
        byItem: [
          {
            key: inPrint,
            item_id: inPrint,
            name: 'x',
            unit: 'cay',
            requested: 1,
            backlog_prev: 0,
            stock: 0,
            need: 1,
          },
        ],
        custom: [],
        order_qty: { [inPrint]: 1 },
      },
      '2026-11-11T05:00:00Z',
    );
    const p = await plan(YM);
    expect(p.rows.find((r) => r.item_id === notInPrint)).toBeUndefined();
    expect(p.rows.find((r) => r.item_id === inPrint)).toMatchObject({
      usable: false,
      ordered: 1,
    });
  });
});
