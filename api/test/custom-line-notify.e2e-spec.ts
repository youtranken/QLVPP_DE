import { lineNotifyFixture } from './line-notify.fixture';

describe('PUT me/request/lines: chuông custom_line_new cho Hành chính', () => {
  const f = lineNotifyFixture('custom-notify');
  const {
    A,
    ADMIN,
    ADMIN2,
    LOCKED_ADMIN,
    B,
    as,
    bells,
    breakNotifications,
    custom,
    http,
    newItem,
    repairNotifications,
    save,
    seed,
    upload,
    view,
  } = f;

  const SA = 'local:sa';
  let seededSa = false;
  beforeAll(async () => {
    seededSa =
      (
        await f.pool().query(
          `INSERT INTO users (sub, full_name, status, groups)
           VALUES ($1, 'SA', 'active', '["vpp-admin"]'::jsonb) ON CONFLICT (sub) DO NOTHING`,
          [SA],
        )
      ).rowCount === 1;
  });
  f.onCleanup(async (p) => {
    await p.query('DELETE FROM in_app_notifications WHERE user_sub = $1', [SA]);
    if (seededSa) await p.query('DELETE FROM users WHERE sub = $1', [SA]);
  });

  it('member lưu phiếu có 1 dòng ngoài DM → mỗi admin active 1 chuông (đúng params/link); admin khóa, SA, chủ phiếu không', async () => {
    const r = await seed([custom({ custom_name: 'Kẹp bướm đặc biệt' })]);
    const lineId = r.lines[0].id;
    for (const admin of [ADMIN, ADMIN2]) {
      expect(await bells('custom_line_new', admin)).toEqual([
        {
          event_id: `custom_line_new:${lineId}`,
          params: {
            ym: '2026-11',
            name: 'Kẹp bướm đặc biệt',
            person: 'Nhân viên A',
          },
          link: '/admin/review?ym=2026-11',
        },
      ]);
    }
    expect(await bells('custom_line_new', LOCKED_ADMIN)).toEqual([]);
    expect(await bells('custom_line_new', A)).toEqual([]);
    expect(await bells('custom_line_new', SA)).toEqual([]);
  });

  it('dòng DM thường không chuông; lưu lại đổi qty dòng ngoài DM → không thêm; thêm dòng ngoài DM thứ hai → đúng 1 chuông mới mỗi admin', async () => {
    const item = await newItem();
    const img1 = await upload(B);
    const base = (await bells('custom_line_new', ADMIN)).length;
    const first = await seed(
      [
        { item_id: item, qty: 1 },
        custom({ custom_name: 'Món lạ B1', image_file_id: img1 }),
      ],
      B,
    );
    expect(await bells('custom_line_new', ADMIN)).toHaveLength(base + 1);
    const mine = first.lines.find((l) => l.item_id === null)!;
    const keep = { item_id: item, qty: 1 };
    const ownLine = {
      id: mine.id,
      custom_name: 'Món lạ B1',
      custom_unit: 'cai',
      image_file_id: img1,
      qty: 3,
    };
    const second = view(
      await save(
        [keep, ownLine],
        { expected_updated_at: first.updated_at },
        B,
      ).expect(200),
    );
    expect(await bells('custom_line_new', ADMIN)).toHaveLength(base + 1);
    const img = await upload(B);
    await save(
      [
        keep,
        { ...ownLine, qty: 3 },
        {
          custom_name: 'Món lạ B2',
          custom_unit: 'cai',
          image_file_id: img,
          qty: 1,
        },
      ],
      { expected_updated_at: second.updated_at },
      B,
    ).expect(200);
    const rows = await bells('custom_line_new', ADMIN);
    expect(rows).toHaveLength(base + 2);
    expect(
      rows.map((r) => r.params.name).filter((n) => /^Món lạ B/.test(String(n))),
    ).toEqual(['Món lạ B1', 'Món lạ B2']);
    expect(await bells('custom_line_new', ADMIN2)).toHaveLength(base + 2);
  });

  it('2 dòng DM + 2 dòng ngoài DM thêm xen kẽ → đúng 2 chuông, mỗi chuông đúng tên dòng ngoài DM', async () => {
    const C = `e2e-req-c-mix-${f.SUFFIX}`;
    await f.pool().query(
      `INSERT INTO users (sub, full_name, department, status)
       VALUES ($1, 'Nhân viên M', 'Phòng CT', 'active')`,
      [C],
    );
    const [i1, i2] = [await newItem(), await newItem()];
    const [g1, g2] = [await upload(C), await upload(C)];
    const res = await save(
      [
        {
          custom_name: 'Xen kẽ 1',
          custom_unit: 'cai',
          image_file_id: g1,
          qty: 1,
        },
        { item_id: i1, qty: 1 },
        {
          custom_name: 'Xen kẽ 2',
          custom_unit: 'cai',
          image_file_id: g2,
          qty: 1,
        },
        { item_id: i2, qty: 1 },
      ],
      {},
      C,
    ).expect(200);
    const lines = view(res).lines;
    const rows = (await bells('custom_line_new', ADMIN)).filter((r) =>
      /^Xen kẽ/.test(String(r.params.name)),
    );
    expect(rows.map((r) => [r.event_id, r.params.name]).sort()).toEqual(
      lines
        .filter((l) => l.item_id === null)
        .map((l) => [`custom_line_new:${l.id}`, l.custom_name])
        .sort(),
    );
    expect(rows).toHaveLength(2);
  });

  it('save lỗi (STALE_UPDATE) → không chuông', async () => {
    const before = (await bells('custom_line_new', ADMIN)).length;
    const r = await seed([{ item_id: await newItem(), qty: 1 }], B);
    const img = await upload(B);
    const res = await save(
      [
        { item_id: r.lines[0].item_id, qty: 1 },
        {
          custom_name: 'Món lạ B3',
          custom_unit: 'cai',
          image_file_id: img,
          qty: 1,
        },
      ],
      { expected_updated_at: '2020-01-01T00:00:00.000Z' },
      B,
    );
    expect(res.status).toBe(409);
    expect(await bells('custom_line_new', ADMIN)).toHaveLength(before);
  });

  it('Hành chính tạo hộ có dòng ngoài DM → admin khác nhận, chính người tạo không', async () => {
    const img = await upload(ADMIN, 'line_image', 'admin');
    const res = await as(http().post('/api/admin/requests'), ADMIN, 'admin')
      .send({
        user_sub: B,
        lines: [
          {
            custom_name: 'Món hộ C1',
            custom_unit: 'cai',
            image_file_id: img,
            qty: 1,
          },
        ],
      })
      .expect(201);
    const id = (res.body as { request: { lines: { id: string }[] } }).request
      .lines[0].id;
    const toAdmin2 = await bells('custom_line_new', ADMIN2);
    expect(
      toAdmin2.find((r) => r.event_id === `custom_line_new:${id}`)?.params,
    ).toEqual({
      ym: '2026-11',
      name: 'Món hộ C1',
      person: 'Nhân viên B',
    });
    const toActor = await bells('custom_line_new', ADMIN);
    expect(
      toActor.find((r) => r.event_id === `custom_line_new:${id}`),
    ).toBeUndefined();
  });

  it('ghi chuông lỗi (trigger RAISE) → member vẫn lưu được phiếu (200), phiếu còn, không chuông', async () => {
    const C = `e2e-req-c-${f.SUFFIX}`;
    await f.pool().query(
      `INSERT INTO users (sub, full_name, department, status)
       VALUES ($1, 'Nhân viên C', 'Phòng CT', 'active')`,
      [C],
    );
    const img = await upload(C);
    await breakNotifications();
    let id: string;
    try {
      const res = await save(
        [
          {
            custom_name: 'Món lạ D1',
            custom_unit: 'cai',
            image_file_id: img,
            qty: 1,
          },
        ],
        {},
        C,
      ).expect(200);
      id = view(res).lines[0].id;
    } finally {
      await repairNotifications();
    }
    const kept = await f
      .pool()
      .query('SELECT 1 FROM request_lines WHERE id = $1', [id]);
    expect(kept.rowCount).toBe(1);
    expect(
      (await bells('custom_line_new', ADMIN)).find(
        (r) => r.event_id === `custom_line_new:${id}`,
      ),
    ).toBeUndefined();
  });
});
