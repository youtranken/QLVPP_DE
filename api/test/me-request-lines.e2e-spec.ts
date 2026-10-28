import { meRequestFixture } from './me-request.fixture';
import type { Line } from './me-request.fixture';

describe('me/request: lỗi theo dòng, dòng chỉ đọc', () => {
  const {
    A,
    B,
    ADMIN,
    http,
    as,
    upload,
    newItem,
    save,
    view,
    custom,
    requestsOf,
    pool,
    defaultMax,
  } = meRequestFixture('lines');

  describe('lỗi theo dòng mới → {code, line_index}, không tạo phiếu', () => {
    const cases: [string, number, () => Promise<Line>][] = [
      ['QTY_INVALID', 400, async () => ({ item_id: await newItem(), qty: 0 })],
      [
        'QTY_INVALID',
        400,
        async () => ({ item_id: await newItem(), qty: 1.5 }),
      ],
      [
        'QTY_EXCEEDS_MAX',
        400,
        async () => ({ item_id: await newItem({ max_qty: 5 }), qty: 6 }),
      ],
      [
        'QTY_EXCEEDS_MAX',
        400,
        () => Promise.resolve(custom({ qty: defaultMax() + 1 })),
      ],
      [
        'ITEM_INACTIVE',
        400,
        async () => ({ item_id: await newItem({ active: false }), qty: 1 }),
      ],
      [
        'ADMIN_ONLY_ITEM',
        400,
        async () => ({ item_id: await newItem({ admin_only: true }), qty: 1 }),
      ],
      [
        'IMAGE_REQUIRED',
        400,
        () => Promise.resolve(custom({ image_file_id: undefined })),
      ],
      [
        'UNIT_REQUIRED',
        400,
        () => Promise.resolve(custom({ custom_unit: undefined })),
      ],
      [
        'FILE_FORBIDDEN',
        403,
        async () => custom({ image_file_id: await upload(B) }),
      ],
      [
        'FILE_FORBIDDEN',
        403,
        async () => custom({ image_file_id: await upload(A, 'item_image') }),
      ],
    ];
    it.each(cases)('%s (HTTP %d)', async (code, status, build) => {
      const ok = { item_id: await newItem(), qty: 1 };
      const res = await save([ok, await build()]).expect(status);
      expect(res.body).toMatchObject({ code, line_index: 1 });
      expect(await requestsOf(A)).toHaveLength(0);
    });

    it('cùng món 2 lần → 400 DUPLICATE_ITEM {line_index: 1}', async () => {
      const x = await newItem();
      const res = await save([
        { item_id: x, qty: 1 },
        { item_id: x, qty: 2 },
      ]).expect(400);
      expect(res.body).toMatchObject({ code: 'DUPLICATE_ITEM', line_index: 1 });
    });

    it('id không thuộc phiếu → 400 LINE_NOT_FOUND {line_index}', async () => {
      const x = await newItem();
      const v1 = view(await save([{ item_id: x, qty: 1 }]).expect(200));
      const res = await save(
        [
          { id: v1.lines[0].id, item_id: x, qty: 1 },
          { id: '00000000-0000-4000-8000-000000000000', item_id: x, qty: 1 },
        ],
        { expected_updated_at: v1.updated_at },
      ).expect(400);
      expect(res.body).toMatchObject({ code: 'LINE_NOT_FOUND', line_index: 1 });
    });
  });

  it('món bị Hành chính ngừng sau khi lưu: lưu lại không đụng → 200 giữ dòng (item.active=false); đổi qty → ITEM_INACTIVE {line_id}', async () => {
    const [x, y] = [await newItem(), await newItem()];
    const v1 = view(
      await save([
        { item_id: x, qty: 1 },
        { item_id: y, qty: 1 },
      ]).expect(200),
    );
    await as(http().patch(`/api/admin/items/${x}`), ADMIN, 'admin')
      .send({ active: false })
      .expect(200);
    const lineX = v1.lines.find((l) => l.item_id === x)!;
    const lineY = v1.lines.find((l) => l.item_id === y)!;
    const v2 = view(
      await save(
        [
          { id: lineX.id, item_id: x, qty: 1 },
          { id: lineY.id, item_id: y, qty: 2 },
        ],
        { expected_updated_at: v1.updated_at },
      ).expect(200),
    );
    expect(v2.lines.find((l) => l.id === lineX.id)?.item).toMatchObject({
      active: false,
    });
    const res = await save([{ id: lineX.id, item_id: x, qty: 3 }], {
      expected_updated_at: v2.updated_at,
    }).expect(400);
    expect(res.body).toMatchObject({
      code: 'ITEM_INACTIVE',
      line_id: lineX.id,
    });
  });

  it('dòng Hành chính thêm: member không gửi → vẫn còn (chỉ đọc); gửi y nguyên → 200; đổi qty → LINE_READONLY {line_id}', async () => {
    const [x, z] = [await newItem(), await newItem()];
    const v1 = view(await save([{ item_id: x, qty: 1 }]).expect(200));
    const adminLine = (
      await pool().query<{ id: string }>(
        `INSERT INTO request_lines (request_id, item_id, qty, added_by_admin) VALUES ($1, $2, 2, true) RETURNING id`,
        [v1.id, z],
      )
    ).rows[0].id;
    const v2 = view(
      await save([{ id: v1.lines[0].id, item_id: x, qty: 3 }], {
        expected_updated_at: v1.updated_at,
      }).expect(200),
    );
    expect(v2.lines.find((l) => l.id === adminLine)).toMatchObject({
      added_by_admin: true,
      readonly_for_member: true,
      qty: 2,
    });
    const v3 = view(
      await save(
        [
          { id: v1.lines[0].id, item_id: x, qty: 3 },
          { id: adminLine, item_id: z, qty: 2 },
        ],
        { expected_updated_at: v2.updated_at },
      ).expect(200),
    );
    const res = await save([{ id: adminLine, item_id: z, qty: 5 }], {
      expected_updated_at: v3.updated_at,
    }).expect(400);
    expect(res.body).toMatchObject({
      code: 'LINE_READONLY',
      line_id: adminLine,
    });
    const kept = view(
      await save([], { expected_updated_at: v3.updated_at }).expect(200),
    );
    expect(kept.lines.map((l) => l.id)).toEqual([adminLine]);
  });
});
