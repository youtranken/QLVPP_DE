import { reviewFixture } from './review.fixture';

describe('admin/review: thêm vào danh mục (convert)', () => {
  const f = reviewFixture('reviewc');
  const {
    A,
    ADMIN,
    B,
    as,
    customLine,
    getMine,
    http,
    itemShape,
    lineRow,
    newItem,
    newItemBody,
    pool,
    review,
    save,
    seed,
    upload,
    view,
  } = f;

  it('convert món có sẵn: gắn item_id, xóa custom_*, giữ ảnh, review_note "Từ: …"; cùng món n/a trong phiếu không lỗi unique', async () => {
    const item = await newItem({ max_qty: 10 });
    const img = await upload(A);
    const r = await seed([
      { item_id: item, qty: 1 },
      { custom_name: 'Bút lạ', custom_unit: 'cai', image_file_id: img, qty: 3 },
    ]);
    const custom = r.lines.find((l) => !l.item_id)!;
    const res = await review(custom.id, {
      action: 'convert',
      item: { existing_id: item },
    }).expect(200);
    expect(res.body).toMatchObject({
      line: { review_status: 'converted', item_id: item },
      item: { id: item },
      unit_mismatch: true,
    });
    expect(Object.keys(res.body.item as object).sort()).toEqual(
      Object.keys(itemShape).sort(),
    );
    expect(await lineRow(custom.id)).toMatchObject({
      item_id: item,
      custom_name: null,
      custom_unit: null,
      custom_note: null,
      image_file_id: img,
      review_status: 'converted',
      review_note: 'Từ: Bút lạ',
      reviewed_by_sub: ADMIN,
    });
    const mine = await getMine();
    expect(mine.lines.filter((l) => l.item_id === item)).toHaveLength(2);
  });

  it('convert món có sẵn đã ngừng → 400 ITEM_INACTIVE, dòng vẫn pending', async () => {
    const { line } = await customLine();
    const res = await review(line.id, {
      action: 'convert',
      item: { existing_id: await newItem({ active: false }) },
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ITEM_INACTIVE');
    expect((await lineRow(line.id)).review_status).toBe('pending');
  });

  it('convert món mới dùng ảnh dòng: món tồn 0, member khác thấy món và đọc được ảnh', async () => {
    const { line, img } = await customLine();
    const body = newItemBody({ unit: 'cai' });
    const res = await review(line.id, { action: 'convert', item: body }).expect(
      200,
    );
    const created = res.body.item as {
      id: string;
      image_file_id: string;
    };
    expect(created).toMatchObject({ image_file_id: img, active: true });
    expect(Object.keys(created).sort()).toEqual(Object.keys(itemShape).sort());
    const stock = await pool().query<{ stock_qty: number }>(
      'SELECT stock_qty FROM items WHERE id = $1',
      [created.id],
    );
    expect(stock.rows[0].stock_qty).toBe(0);
    expect(res.body.unit_mismatch).toBe(false);
    expect(res.body.line).toMatchObject({
      item_id: created.id,
      review_status: 'converted',
    });
    const moves = await pool().query(
      'SELECT 1 FROM stock_movements WHERE item_id = $1',
      [created.id],
    );
    expect(moves.rows).toHaveLength(0);
    const items = (await as(http().get('/api/items'), B).expect(200)).body as {
      id: string;
    }[];
    expect(items.map((i) => i.id)).toContain(created.id);
    await as(http().get(`/api/files/${img}`), B).expect(200);
  });

  it('convert món mới với ảnh admin tải (item_image) → dùng ảnh đó; ảnh của người khác → FILE_FORBIDDEN', async () => {
    const { line } = await customLine();
    const other = await upload(B, 'item_image');
    const bad = await review(line.id, {
      action: 'convert',
      item: newItemBody({ image_file_id: other }),
    });
    expect(bad.status).toBe(403);
    expect(bad.body.code).toBe('FILE_FORBIDDEN');
    const mine = await upload(ADMIN, 'item_image', 'admin');
    const res = await review(line.id, {
      action: 'convert',
      item: newItemBody({ image_file_id: mine }),
    }).expect(200);
    expect(res.body.item.image_file_id).toBe(mine);
    expect(res.body.unit_mismatch).toBe(true);
  });

  it('convert món mới thiếu unit → 400 UNIT_REQUIRED, không tạo món', async () => {
    const { line } = await customLine();
    const body = newItemBody({ unit: undefined });
    const res = await review(line.id, { action: 'convert', item: body });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNIT_REQUIRED');
    const n = await pool().query('SELECT 1 FROM items WHERE name = $1', [
      body.name,
    ]);
    expect(n.rows).toHaveLength(0);
  });

  it('convert thiếu item → 400 VALIDATION', async () => {
    const { line } = await customLine();
    const res = await review(line.id, { action: 'convert' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
  });

  it('hai convert món mới song song → một 200, một 409 LINE_ALREADY_REVIEWED; chỉ một món được tạo', async () => {
    const { line } = await customLine();
    const bodies = [newItemBody(), newItemBody()];
    const results = await Promise.all(
      bodies.map((item) => review(line.id, { action: 'convert', item })),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)!.body.code).toBe(
      'LINE_ALREADY_REVIEWED',
    );
    const made = await pool().query(
      'SELECT 1 FROM items WHERE name = ANY($1)',
      [bodies.map((b) => b.name)],
    );
    expect(made.rows).toHaveLength(1);
  });

  it('member lưu lại phiếu có dòng converted y như nhận về → 200, không đổi', async () => {
    const { line } = await customLine();
    await review(line.id, {
      action: 'convert',
      item: { existing_id: await newItem({ max_qty: 10 }) },
    }).expect(200);
    const got = await getMine();
    const echo = got.lines.map((l) => {
      const full = l as unknown as Record<string, unknown>;
      return {
        id: l.id,
        item_id: l.item_id,
        custom_name: l.custom_name,
        custom_unit: full.custom_unit,
        custom_note: full.custom_note,
        image_file_id: full.image_file_id,
        qty: l.qty,
      };
    });
    const res = await save(echo, {
      expected_updated_at: got.updated_at,
    }).expect(200);
    const after = view(res);
    expect(after.lines).toEqual(got.lines);
  });

  it('convert có cả existing_id lẫn trường món mới → 400 VALIDATION {fields: [item.name, item.unit]}, dòng vẫn pending', async () => {
    const { line } = await customLine();
    const res = await review(line.id, {
      action: 'convert',
      item: { existing_id: await newItem(), name: 'Món mới', unit: 'cai' },
    });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION' });
    expect(res.body.fields).toEqual(
      expect.arrayContaining(['item.name', 'item.unit']),
    );
    expect((await lineRow(line.id)).review_status).toBe('pending');
  });
});
