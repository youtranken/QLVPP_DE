import type { SnapshotListItem } from './report-snapshots.fixture';
import { snapshotsFixture } from './report-snapshots.fixture';

const YM = '2026-11';

describe('V2D-4 bản chốt có hàng: GET …/sent, danh sách, bản cũ, dùng lại', () => {
  const f = snapshotsFixture('sent');
  const { ADMIN, B, create, insertSnapshot, list, sent, seedLine } = f;
  let item: string;

  beforeEach(async () => {
    await f.resetPeriod(YM);
    ({ item } = await f.lockedLine(0, 5));
  });

  // Bản chốt kiểu trước v2-D: không order_basis/replaces, hàng không có adm_owed…, order_qty net
  const oldStyle = async (orderQty: Record<string, number>, at: string) => {
    const live = await f.build(YM);
    const strip = <T extends object>(r: T) => {
      const { adm_owed, left_excluded, usable, ...rest } = r as T & {
        adm_owed?: number;
        left_excluded?: number;
        usable?: boolean;
      };
      void adm_owed;
      void left_excluded;
      void usable;
      return rest;
    };
    return insertSnapshot(
      YM,
      {
        ...live,
        byItem: live.byItem.map(strip),
        custom: live.custom.map(strip),
        order_qty: orderQty,
        signers: { preparer: 'A', head: 'B', approver: 'C' },
        created_by: { sub: ADMIN, name: 'Hành chính' },
        created_at: at,
      },
      at,
    );
  };

  it('bản rỗng 09:23 mới hơn bản có hàng 22:12 → sent.id = 22:12; danh sách có has_items/items_count/units_total', async () => {
    const full = await oldStyle({ [item]: 7 }, '2026-11-11T15:12:00.000Z');
    const empty = await oldStyle({ [item]: 0 }, '2026-11-12T02:23:00.000Z');
    const res = await sent(YM).expect(200);
    expect(res.body).toMatchObject({
      id: full,
      kind: 'print',
      created_at: '2026-11-11T15:12:00.000Z',
      items_count: 1,
      units_total: 7,
      replaces: null,
    });
    expect(res.body.data.order_qty[item]).toBe(7);
    const rows = await list(YM);
    expect(
      rows.map((r: SnapshotListItem & Record<string, unknown>) => [
        r.id,
        r.has_items,
        r.items_count,
        r.units_total,
      ]),
    ).toEqual([
      [empty, false, 0, 0],
      [full, true, 1, 7],
    ]);
    expect((await f.sendState(YM)).sent?.id).toBe(full);
  });

  it('kỳ chỉ có bản rỗng → 404 NO_SENT_SNAPSHOT; send-state Chưa gửi', async () => {
    await oldStyle({ [item]: 0 }, '2026-11-12T02:23:00.000Z');
    expect((await sent(YM).expect(404)).body.code).toBe('NO_SENT_SNAPSHOT');
    expect(await f.sendState(YM)).toMatchObject({
      state: 'unsent',
      sent: null,
    });
  });

  it('JSON bản cũ (thiếu order_basis/replaces, order_qty net 7) → sent 200, xuất lại vẫn 7; bản mới số khác → replaces bản cũ', async () => {
    const old = await oldStyle({ [item]: 7 }, '2026-11-11T15:12:00.000Z');
    expect((await sent(YM).expect(200)).body).toMatchObject({
      id: old,
      replaces: null,
      units_total: 7,
    });
    const wb = await f.workbook(await f.exportXlsx(old).expect(200));
    const name = await f.itemName(item);
    const formRow = (wb.worksheets[0].getSheetValues() as unknown[][]).find(
      (r) => Array.isArray(r) && r.includes(name),
    );
    expect(formRow?.at(-1)).toBe(7);
    const fresh = await create(YM, { kind: 'print' }).expect(201);
    expect(fresh.body.data.order_qty[item]).toBe(5);
    expect(fresh.body.data.replaces).toEqual({
      id: old,
      created_at: '2026-11-11T15:12:00.000Z',
    });
  });

  it('bản cũ không có order_qty cho một hàng → xuất lại dùng số gộp đăng ký + nợ (không trừ tủ)', async () => {
    await f
      .pool()
      .query('UPDATE items SET stock_qty = 4 WHERE id = $1', [item]);
    const old = await oldStyle({}, '2026-11-11T15:12:00.000Z');
    const wb = await f.workbook(await f.exportXlsx(old).expect(200));
    const name = await f.itemName(item);
    const formRow = (wb.worksheets[0].getSheetValues() as unknown[][]).find(
      (r) => Array.isArray(r) && r.includes(name),
    );
    expect(formRow?.at(-1)).toBe(5);
  });

  it('dùng lại: giảm 1 dòng giữa hai lần In → 201 id mới; đổi order_qty một hàng → 201', async () => {
    const body = { kind: 'print', reuse_if_unchanged: true };
    const first = (await create(YM, body).expect(201)).body;
    await f
      .pool()
      .query('UPDATE request_lines SET qty = 4 WHERE item_id = $1', [item]);
    f.freeze('2026-11-12T03:01:00Z');
    const second = (await create(YM, body).expect(201)).body;
    expect(second.id).not.toBe(first.id);
    expect(second.data.order_qty[item]).toBe(4);
    f.freeze('2026-11-12T03:02:00Z');
    const third = (
      await create(YM, { ...body, order_qty: { [item]: 9 } }).expect(201)
    ).body;
    expect(third.id).not.toBe(second.id);
    expect(third.data.replaces.id).toBe(second.id);
  });

  it('dùng lại chỉ cùng kind: bản mới nhất là xlsx, In print lần đầu → 201; Excel 2 lần không cờ → 2 bản xlsx', async () => {
    await create(YM, { kind: 'xlsx' }).expect(201);
    await create(YM, { kind: 'xlsx' }).expect(201);
    const print = await create(YM, {
      kind: 'print',
      reuse_if_unchanged: true,
    }).expect(201);
    expect(print.body.reused).toBe(false);
    expect((await list(YM)).map((s) => s.kind).sort()).toEqual([
      'print',
      'xlsx',
      'xlsx',
    ]);
  });

  it('biên ORDER_EMPTY: một ô = 1, ô khác 0 → 201 và hàng 0 vẫn trong bản; tất cả 0 → 409', async () => {
    const other = await f.stockItem(0);
    await seedLine(YM, B, { item_id: other, qty: 3 });
    const live = await f.build(YM);
    const zero = Object.fromEntries(
      [...live.byItem, ...live.custom].map((r) => [r.key, 0]),
    );
    const one = await create(YM, {
      kind: 'xlsx',
      order_qty: { ...zero, [item]: 1 },
    }).expect(201);
    expect(one.body.data.order_qty).toMatchObject({ [item]: 1, [other]: 0 });
    const none = await create(YM, { kind: 'xlsx', order_qty: zero }).expect(
      409,
    );
    expect(none.body).toMatchObject({
      code: 'ORDER_EMPTY',
      message: 'Chưa có món nào để đề nghị.',
    });
  });

  it('kỳ đang mở → GET …/sent 409 PERIOD_NOT_LOCKED; kỳ sau → 400 INVALID_PERIOD; member → 403', async () => {
    expect((await sent('2026-12').expect(409)).body.code).toBe(
      'PERIOD_NOT_LOCKED',
    );
    expect((await sent('2027-01').expect(400)).body.code).toBe(
      'INVALID_PERIOD',
    );
    await f
      .as(f.http().get(`/api/admin/reports/${YM}/sent`), B, 'member')
      .expect(403);
  });
});
