import { adminSummaryFixture } from './admin-summary.fixture';

// Đồng hồ cố định 2026-11-05 → kỳ đang mở 2026-11; 6 kỳ đã khóa gần nhất = 2026-05 … 2026-10
const YM = '2023-07';

type Summary = {
  months: number;
  avg_units: number;
  top_item: { name: string; name_en: string | null } | null;
};

describe('GET admin/users/:sub/requests — tóm tắt 6 kỳ đã khóa gần nhất (Trung bình / Hay đặt nhất)', () => {
  const made: string[] = [];
  afterAll(async () => {
    await fx()
      .pool()
      .query('DELETE FROM requests WHERE id = ANY($1::uuid[])', [made]);
    await fx()
      .pool()
      .query('DELETE FROM items WHERE name LIKE $1', [
        `e2e-hs-%-${fx().SUFFIX}`,
      ]);
  });
  const f = adminSummaryFixture(YM);
  const fx = () => f;
  const { U3, SUFFIX, asAdmin } = f;

  const item = async (tag: string) =>
    (
      await f
        .pool()
        .query<{ id: string }>(
          `INSERT INTO items (name, unit, max_qty) VALUES ($1, 'cay', 200) RETURNING id`,
          [`e2e-hs-${tag}-${SUFFIX}`],
        )
    ).rows[0].id;
  const request = async (ym: string) => {
    await f
      .pool()
      .query(
        `INSERT INTO periods (ym, deadline) VALUES ($1::date, ($1::date + interval '9 days 17 hours') AT TIME ZONE 'UTC') ON CONFLICT (ym) DO NOTHING`,
        [`${ym}-01`],
      );
    const id = (
      await f
        .pool()
        .query<{ id: string }>(
          `INSERT INTO requests (period_ym, user_sub, department, created_by_sub) VALUES ($1::date, $2, 'Phòng B', $2) RETURNING id`,
          [`${ym}-01`, U3],
        )
    ).rows[0].id;
    made.push(id);
    return id;
  };
  const summaryOf = async (sub: string) =>
    (
      (await asAdmin(`/users/${sub}/requests?year=2026`).expect(200)).body as {
        summary: Summary;
      }
    ).summary;

  it('chưa có phiếu trong 6 kỳ → trung bình 0, không có món hay đặt', async () => {
    expect(await summaryOf(U3)).toEqual({
      months: 6,
      avg_units: 0,
      top_item: null,
    });
  });

  it('biên cửa sổ: 2026-04 (ngoài) và kỳ đang mở 2026-11 không tính, 2026-05 và 2026-10 tính; dòng bị từ chối không tính; hay đặt nhất theo số tháng có đặt', async () => {
    const a = await item('a');
    const b = await item('b');
    const add = (rid: string, cols: Record<string, unknown>) =>
      f.addLine(rid, cols);
    await add(await request('2026-04'), { item_id: a, qty: 100 });
    await add(await request('2026-05'), { item_id: a, qty: 3 });
    const jul = await request('2026-07');
    await add(jul, { item_id: a, qty: 2 });
    await add(jul, { item_id: b, qty: 6 });
    await add(await request('2026-08'), {
      custom_name: 'Rác',
      custom_unit: 'cai',
      review_status: 'rejected',
      qty: 9,
    });
    await add(await request('2026-10'), { item_id: b, qty: 1 });
    await add(await request('2026-11'), { item_id: b, qty: 50 });
    // 3 + 2 + 6 + 1 = 12 đơn vị / 6 tháng = 2; a có ở 2 tháng, b ở 2 tháng → hòa, b nhiều đơn vị hơn (7 > 5)
    expect(await summaryOf(U3)).toEqual({
      months: 6,
      avg_units: 2,
      top_item: { name: `e2e-hs-b-${SUFFIX}`, name_en: null },
    });
  });
});
