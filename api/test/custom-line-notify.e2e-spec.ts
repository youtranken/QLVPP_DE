import { AFTER_DEADLINE } from './me-request.fixture';
import { lineNotifyFixture } from './line-notify.fixture';

describe('chuông custom_line_new không còn nguồn: nhân viên lưu kỳ mở, Hành chính không thêm được ở kỳ khóa', () => {
  const f = lineNotifyFixture('custom-notify');
  const {
    A,
    ADMIN,
    ADMIN2,
    LOCKED_ADMIN,
    B,
    as,
    at,
    bells,
    breakNotifications,
    custom,
    http,
    newItem,
    repairNotifications,
    save,
    seed,
    upload,
  } = f;

  const SA = 'local:sa';
  let seededSa = false;
  beforeAll(async () => {
    seededSa =
      (
        await f.pool().query(
          `INSERT INTO users (sub, full_name, status, role)
           VALUES ($1, 'SA', 'active', 'admin') ON CONFLICT (sub) DO NOTHING`,
          [SA],
        )
      ).rowCount === 1;
  });
  f.onCleanup(async (p) => {
    await p.query('DELETE FROM in_app_notifications WHERE user_sub = $1', [SA]);
    if (seededSa) await p.query('DELETE FROM users WHERE sub = $1', [SA]);
  });

  type Seeded = Awaited<ReturnType<typeof seed>>;
  const adminAdd = (
    r: Seeded,
    name: string,
    img: string,
    expected = r.updated_at,
  ) =>
    as(http().put(`/api/admin/requests/${r.id}/lines`), ADMIN, 'admin').send({
      lines: [
        ...r.lines.map((l) => ({ id: l.id, qty: l.qty, expected_qty: l.qty })),
        { custom_name: name, custom_unit: 'cai', image_file_id: img, qty: 1 },
      ],
      expected_updated_at: expected,
    });

  it('member lưu dòng ngoài DM trong kỳ mở (lần đầu, đổi qty, thêm dòng thứ hai) → không admin nào nhận chuông', async () => {
    const item = await newItem();
    const img1 = await upload(B);
    const first = await seed(
      [
        { item_id: item, qty: 1 },
        custom({ custom_name: 'Món lạ B1', image_file_id: img1 }),
      ],
      B,
    );
    const mine = first.lines.find((l) => l.item_id === null)!;
    await save(
      [
        { item_id: item, qty: 1 },
        {
          id: mine.id,
          custom_name: 'Món lạ B1',
          custom_unit: 'cai',
          image_file_id: img1,
          qty: 3,
        },
        {
          custom_name: 'Món lạ B2',
          custom_unit: 'cai',
          image_file_id: await upload(B),
          qty: 1,
        },
      ],
      { expected_updated_at: first.updated_at },
      B,
    ).expect(200);
    for (const sub of [ADMIN, ADMIN2, LOCKED_ADMIN, SA, B]) {
      expect(await bells('custom_line_new', sub)).toEqual([]);
    }
  });

  it('Hành chính thêm dòng ngoài DM ở kỳ đã khóa → 400 LINE_ADD_FORBIDDEN, không admin nào nhận custom_line_new', async () => {
    const r = await seed([{ item_id: await newItem(), qty: 1 }]);
    at(AFTER_DEADLINE);
    const img = await upload(ADMIN, 'line_image', 'admin');
    const res = await adminAdd(r, 'Món Hành chính thêm', img).expect(400);
    expect(res.body).toMatchObject({
      code: 'LINE_ADD_FORBIDDEN',
      line_index: 1,
    });
    for (const sub of [ADMIN, ADMIN2, LOCKED_ADMIN, SA, A]) {
      expect(await bells('custom_line_new', sub)).toEqual([]);
    }
  });

  it('ghi chuông line_adjusted lỗi (trigger RAISE) → điều chỉnh vẫn 200, bản ghi còn, không chuông', async () => {
    const r = await seed([{ item_id: await newItem(), qty: 3 }], B);
    at(AFTER_DEADLINE);
    await breakNotifications();
    try {
      await as(http().put(`/api/admin/requests/${r.id}/lines`), ADMIN, 'admin')
        .send({
          expected_updated_at: r.updated_at,
          lines: [
            {
              id: r.lines[0].id,
              qty: 1,
              expected_qty: 3,
              reason_code: 'over_quota',
            },
          ],
        })
        .expect(200);
    } finally {
      await repairNotifications();
    }
    const kept = await f
      .pool()
      .query('SELECT 1 FROM request_line_adjustments WHERE request_id = $1', [
        r.id,
      ]);
    expect(kept.rowCount).toBe(1);
    expect(await bells('line_adjusted', B)).toEqual([]);
  });
});
