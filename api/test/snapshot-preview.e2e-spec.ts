import { snapshotsFixture } from './report-snapshots.fixture';

const YM = '2026-11';

// Vòng 4 mục 10: "Xem tổng kết" dựng đúng bản sẽ in nhưng không lưu gì
describe('POST admin/reports/:ym/snapshots/preview — xem trước bản in', () => {
  const f = snapshotsFixture('preview');
  const { ADMIN, B, as, http, pool, list, noOrder, sendState } = f;
  let item: string;

  const preview = (
    ym: string,
    body: object = {},
    sub = ADMIN,
    role = 'admin',
  ) =>
    as(
      http().post(`/api/admin/reports/${ym}/snapshots/preview`),
      sub,
      role,
    ).send(body);
  const counts = async () => {
    const { rows } = await pool().query<{ snaps: number; audits: number }>(
      `SELECT (SELECT count(*) FROM report_snapshots WHERE period_ym = $1::date)::int AS snaps,
              (SELECT count(*) FROM audit_log)::int AS audits`,
      [`${YM}-01`],
    );
    return rows[0];
  };
  const zeros = async () => {
    const r = await f.build(YM);
    return Object.fromEntries(
      [...r.byItem, ...r.custom].map((row) => [row.key, 0]),
    );
  };

  beforeEach(async () => {
    f.freeze('2026-11-12T03:00:00Z');
    await f.resetPeriod(YM);
    ({ item } = await f.lockedLine(0, 5));
  });

  it('kỳ khóa có đăng ký → 200, Đề nghị mặc định + ô ký; không thêm bản chốt, không audit', async () => {
    const before = await counts();
    const res = await preview(YM).expect(200);
    expect(res.body.data.order_qty[item]).toBe(5);
    expect(Array.isArray(res.body.data.signature_boxes)).toBe(true);
    expect(res.body.data.signature_boxes.length).toBeGreaterThan(0);
    expect(res.body.data).toMatchObject({
      created_at: '2026-11-12T03:00:00.000Z',
      created_by: { sub: ADMIN },
    });
    expect(res.body.data.order_basis).toBeDefined();
    expect(await counts()).toEqual(before);
    expect(await list(YM)).toEqual([]);
    expect((await sendState(YM)).state).toBe('unsent');
  });

  it('order_qty sửa 1 ô → bản xem trước dùng số đã sửa', async () => {
    const res = await preview(YM, { order_qty: { [item]: 2 } }).expect(200);
    expect(res.body.data.order_qty[item]).toBe(2);
  });

  it('mọi Đề nghị = 0 → 409 ORDER_EMPTY', async () => {
    const res = await preview(YM, { order_qty: await zeros() }).expect(409);
    expect(res.body.code).toBe('ORDER_EMPTY');
  });

  it('kỳ đang mở → 409 PERIOD_NOT_LOCKED', async () => {
    const res = await preview('2026-12').expect(409);
    expect(res.body.code).toBe('PERIOD_NOT_LOCKED');
  });

  it('cờ "không cần đề nghị" đang bật → xem trước không xóa cờ', async () => {
    await noOrder(YM, { order_qty: await zeros() }).expect(200);
    await preview(YM).expect(200);
    expect((await sendState(YM)).state).toBe('no_order');
  });

  it('đã có bản gửi, số khác → bản xem trước có replaces; số trùng → không', async () => {
    const sent = (
      await f.create(YM, { kind: 'print', order_qty: {} }).expect(201)
    ).body as { id: string; created_at: string };
    const same = await preview(YM).expect(200);
    expect(same.body.data.replaces).toBeUndefined();
    const changed = await preview(YM, { order_qty: { [item]: 3 } }).expect(200);
    expect(changed.body.data.replaces).toEqual({
      id: sent.id,
      created_at: sent.created_at,
    });
    expect(await list(YM)).toHaveLength(1);
  });

  it('order_qty sai kiểu → 400 VALIDATION; member → 403', async () => {
    const bad = await preview(YM, { order_qty: { [item]: -1 } }).expect(400);
    expect(bad.body.code).toBe('VALIDATION');
    await preview(YM, {}, B, 'member').expect(403);
  });
});
