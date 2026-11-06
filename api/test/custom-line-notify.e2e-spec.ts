import { AFTER_DEADLINE } from './me-request.fixture';
import { lineNotifyFixture } from './line-notify.fixture';

describe('chuông custom_line_new: chỉ cho dòng ngoài DM Hành chính thấy được (kỳ đã khóa)', () => {
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
          `INSERT INTO users (sub, full_name, status, groups)
           VALUES ($1, 'SA', 'active', '["vpp_admin"]'::jsonb) ON CONFLICT (sub) DO NOTHING`,
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
        ...r.lines.map((l) => ({ id: l.id, qty: l.qty })),
        { custom_name: name, custom_unit: 'cai', image_file_id: img, qty: 1 },
      ],
      expected_updated_at: expected,
      reason: 'Bổ sung theo email',
    });
  const addedId = (body: unknown, name: string) =>
    (body as { request: Seeded }).request.lines.find(
      (l) => l.custom_name === name,
    )!.id;

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

  it('Hành chính thêm dòng ngoài DM khi điều chỉnh phiếu kỳ đã khóa → admin khác nhận (params/link); người thêm, admin khóa, SA, chủ phiếu không', async () => {
    const r = await seed([{ item_id: await newItem(), qty: 1 }]);
    at(AFTER_DEADLINE);
    const img = await upload(ADMIN, 'line_image', 'admin');
    const id = addedId(
      (await adminAdd(r, 'Món Hành chính thêm', img).expect(200)).body,
      'Món Hành chính thêm',
    );
    expect(
      (await bells('custom_line_new', ADMIN2)).find(
        (b) => b.event_id === `custom_line_new:${id}`,
      ),
    ).toEqual({
      event_id: `custom_line_new:${id}`,
      params: {
        ym: '2026-11',
        name: 'Món Hành chính thêm',
        person: 'Nhân viên A',
      },
      link: '/admin/review?ym=2026-11',
    });
    for (const sub of [ADMIN, LOCKED_ADMIN, SA, A]) {
      expect(await bells('custom_line_new', sub)).toEqual([]);
    }
  });

  it('điều chỉnh lỗi (STALE_UPDATE) → không chuông', async () => {
    const r = await seed([{ item_id: await newItem(), qty: 1 }], B);
    at(AFTER_DEADLINE);
    const before = (await bells('custom_line_new', ADMIN2)).length;
    const img = await upload(ADMIN, 'line_image', 'admin');
    await adminAdd(r, 'Món lạ B3', img, '2020-01-01T00:00:00.000Z').expect(409);
    expect(await bells('custom_line_new', ADMIN2)).toHaveLength(before);
  });

  it('ghi chuông lỗi (trigger RAISE) → điều chỉnh vẫn 200, dòng còn, không chuông', async () => {
    const r = await seed([{ item_id: await newItem(), qty: 1 }], B);
    at(AFTER_DEADLINE);
    const img = await upload(ADMIN, 'line_image', 'admin');
    await breakNotifications();
    let id: string;
    try {
      id = addedId(
        (await adminAdd(r, 'Món lạ D1', img).expect(200)).body,
        'Món lạ D1',
      );
    } finally {
      await repairNotifications();
    }
    const kept = await f
      .pool()
      .query('SELECT 1 FROM request_lines WHERE id = $1', [id]);
    expect(kept.rowCount).toBe(1);
    expect(
      (await bells('custom_line_new', ADMIN2)).find(
        (b) => b.event_id === `custom_line_new:${id}`,
      ),
    ).toBeUndefined();
  });
});
