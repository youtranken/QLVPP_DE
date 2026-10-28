import { AFTER_DEADLINE, meRequestFixture } from './me-request.fixture';
import type { RequestView } from './me-request.fixture';

describe('me/request: lưu phiếu, kỳ, ảnh dòng, xóa món đã dùng', () => {
  const {
    A,
    B,
    ADMIN,
    at,
    http,
    as,
    upload,
    newItem,
    put,
    save,
    view,
    custom,
    requestsOf,
    auditOf,
    imgA,
    pool,
  } = meRequestFixture('main');

  it('GET me/request khi chưa lưu → 404 REQUEST_NOT_FOUND, không tạo phiếu', async () => {
    const res = await as(http().get('/api/me/request'), A).expect(404);
    expect(res.body).toMatchObject({ code: 'REQUEST_NOT_FOUND' });
    expect(await requestsOf(A)).toHaveLength(0);
  });

  it('lưu 2 món + 1 dòng ngoài DM có ảnh → 200 kỳ 2026-11, dòng ngoài DM pending, audit request.created', async () => {
    const [x, y] = [await newItem(), await newItem()];
    const res = await save([
      { item_id: x, qty: 1 },
      { item_id: y, qty: 3 },
      custom(),
    ]).expect(200);
    const req = view(res);
    expect(req).toMatchObject({
      period_ym: '2026-11',
      user_sub: A,
      full_name: 'Nhân viên A',
      department: 'Phòng CT',
      is_open: true,
    });
    expect(req.updated_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(req.lines).toHaveLength(3);
    expect(req.lines.find((l) => l.item_id === null)).toMatchObject({
      review_status: 'pending',
      custom_name: 'Bìa còng đặc biệt',
      readonly_for_member: false,
    });
    expect(req.lines.find((l) => l.item_id === x)).toMatchObject({
      review_status: 'n/a',
      qty: 1,
    });
    const [detail] = await auditOf('request.created', req.id);
    expect(detail).toMatchObject({ ym: '2026-11', owner_sub: A, self: false });
    expect(detail.added).toHaveLength(3);
    const got = await as(http().get('/api/me/request?ym=2026-11'), A).expect(
      200,
    );
    expect((got.body as RequestView).id).toBe(req.id);
  });

  it('expected_updated_at cũ hoặc thiếu → 409 STALE_UPDATE; mới nhất → 200, audit changed có before/after qty', async () => {
    const x = await newItem();
    const v1 = view(await save([{ item_id: x, qty: 1 }]).expect(200));
    const line = { id: v1.lines[0].id, item_id: x, qty: 4 };
    const v2 = view(
      await save([line], { expected_updated_at: v1.updated_at }).expect(200),
    );
    expect(v2.lines[0].qty).toBe(4);
    expect(v2.updated_at).not.toBe(v1.updated_at);
    const stale = await save([{ ...line, qty: 2 }], {
      expected_updated_at: v1.updated_at,
    }).expect(409);
    expect(stale.body).toMatchObject({ code: 'STALE_UPDATE' });
    expect((await save([{ ...line, qty: 2 }]).expect(409)).body).toMatchObject({
      code: 'STALE_UPDATE',
    });
    const [detail] = await auditOf('request.updated', v1.id);
    expect(detail).toMatchObject({ added: [], removed: [] });
    expect(detail.changed).toEqual([
      expect.objectContaining({
        id: line.id,
        before: expect.objectContaining({ qty: 1 }),
        after: expect.objectContaining({ qty: 4 }),
      }),
    ]);
  });

  it('body rỗng khi chưa có phiếu → 400 LINES_EMPTY', async () => {
    expect((await save([]).expect(400)).body).toMatchObject({
      code: 'LINES_EMPTY',
    });
  });

  it('body rỗng khi có phiếu (không dòng chỉ đọc) → {request: null}, phiếu bị xóa, audit request.deleted', async () => {
    const v1 = view(
      await save([{ item_id: await newItem(), qty: 1 }, custom()]).expect(200),
    );
    const res = await save([], { expected_updated_at: v1.updated_at }).expect(
      200,
    );
    expect(res.body).toEqual({ request: null });
    expect(await requestsOf(A)).toHaveLength(0);
    const [detail] = await auditOf('request.deleted', v1.id);
    expect(detail.removed).toHaveLength(2);
    await as(http().get('/api/me/request'), A).expect(404);
  });

  it('sau hạn kỳ 11: ym 2026-11 → 409 PERIOD_LOCKED {next_ym: 2026-12}, phiếu kỳ 11 không đổi; ym 2026-12 → 200 kỳ 12; thiếu ym → VALIDATION', async () => {
    const x = await newItem();
    const nov = view(await save([{ item_id: x, qty: 1 }]).expect(200));
    at(AFTER_DEADLINE);
    const locked = await save([{ id: nov.lines[0].id, item_id: x, qty: 4 }], {
      expected_updated_at: nov.updated_at,
    }).expect(409);
    expect(locked.body).toMatchObject({
      code: 'PERIOD_LOCKED',
      next_ym: '2026-12',
    });
    const after = (
      await as(http().get('/api/me/request?ym=2026-11'), A).expect(200)
    ).body as RequestView;
    expect(after).toMatchObject({ is_open: false, updated_at: nov.updated_at });
    expect(after.lines[0].qty).toBe(1);
    const dec = view(
      await put({ ym: '2026-12', lines: [{ item_id: x, qty: 2 }] }).expect(200),
    );
    expect(dec).toMatchObject({ period_ym: '2026-12', is_open: true });
    expect(dec.id).not.toBe(nov.id);
    const noYm = await put({ lines: [{ item_id: x, qty: 2 }] }).expect(400);
    expect(noYm.body).toMatchObject({ code: 'VALIDATION' });
  });

  it.each(['2027-01', '2026-13', '2026-1', 'abc'])(
    'PUT me/request/lines ym=%s (sai dạng hoặc sau kỳ đang mở) → 400 INVALID_PERIOD, không tạo phiếu',
    async (ym) => {
      const x = await newItem();
      const res = await put({ ym, lines: [{ item_id: x, qty: 1 }] }).expect(
        400,
      );
      expect(res.body).toMatchObject({ code: 'INVALID_PERIOD' });
      expect(await requestsOf(A)).toHaveLength(0);
    },
  );

  it.each(['2027-01', '2026-13', 'abc'])(
    'GET me/request?ym=%s → 400 INVALID_PERIOD',
    async (ym) => {
      const res = await as(http().get(`/api/me/request?ym=${ym}`), A).expect(
        400,
      );
      expect(res.body).toMatchObject({ code: 'INVALID_PERIOD' });
    },
  );

  it('ảnh dòng: B GET → 404; A → 200; admin → 200; ảnh Hành chính tải cho dòng của A → A đọc được nhờ tham chiếu, B 404', async () => {
    const v1 = view(await save([custom()]).expect(200));
    await as(http().get(`/api/files/${imgA()}`), B).expect(404);
    await as(http().get(`/api/files/${imgA()}`), A).expect(200);
    await as(http().get(`/api/files/${imgA()}`), ADMIN, 'admin').expect(200);
    const adminImg = await upload(ADMIN, 'line_image', 'admin');
    await as(http().get(`/api/files/${adminImg}`), A).expect(404);
    await pool().query(
      `INSERT INTO request_lines (request_id, custom_name, custom_unit, image_file_id, qty, added_by_admin, review_status)
       VALUES ($1, 'Món Hành chính thêm', 'cai', $2, 1, true, 'pending')`,
      [v1.id, adminImg],
    );
    await as(http().get(`/api/files/${adminImg}`), A).expect(200);
    await as(http().get(`/api/files/${adminImg}`), B).expect(404);
  });

  it('DELETE admin/items/:id món đã nằm trong phiếu → 409 ITEM_IN_USE; món chưa dùng → 204', async () => {
    const [used, unused] = [await newItem(), await newItem()];
    await save([{ item_id: used, qty: 1 }]).expect(200);
    const res = await as(
      http().delete(`/api/admin/items/${used}`),
      ADMIN,
      'admin',
    ).expect(409);
    expect(res.body).toMatchObject({ code: 'ITEM_IN_USE' });
    await as(
      http().delete(`/api/admin/items/${unused}`),
      ADMIN,
      'admin',
    ).expect(204);
  });
});
