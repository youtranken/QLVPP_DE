import { meRequestFixture } from './me-request.fixture';
import type { Line, RequestView } from './me-request.fixture';

interface ReviewRow {
  line_id: string;
  request_id: string;
  period_ym: string;
  user_sub: string;
  full_name: string | null;
  custom_name: string | null;
  review_status: string;
  previously_accepted: boolean;
}

describe('admin/review: món ngoài danh mục', () => {
  const f = meRequestFixture('review');
  const { A, B, ADMIN, SUFFIX, http, as, upload, newItem, save, view, pool } =
    f;
  const NEW_PREFIX = `e2e-req-item-${SUFFIX}-new`;
  let category: string;

  const review = (lineId: string, body: object, role = 'admin') =>
    as(http().post(`/api/admin/lines/${lineId}/review`), ADMIN, role).send(
      body,
    );
  const list = async (query: string) =>
    (
      (
        await as(
          http().get(`/api/admin/review?${query}`),
          ADMIN,
          'admin',
        ).expect(200)
      ).body as { items: ReviewRow[] }
    ).items;
  const seed = async (lines: Line[], sub = A) =>
    view(await save(lines, {}, sub).expect(200));
  const customLine = async (sub = A, name = 'Bìa còng đặc biệt') => {
    const img = await upload(sub);
    const r = await seed(
      [{ custom_name: name, custom_unit: 'cai', image_file_id: img, qty: 2 }],
      sub,
    );
    return { request: r, line: r.lines[0], img };
  };
  const newItemBody = (over: object = {}) => ({
    name: `${NEW_PREFIX}-${Math.random().toString(36).slice(2, 8)}`,
    unit: 'hop',
    category_id: category,
    ...over,
  });
  const getMine = async () =>
    (await as(http().get('/api/me/request?ym=2026-11'), A).expect(200))
      .body as RequestView;
  const lineRow = async (id: string) =>
    (
      await pool().query<Record<string, unknown>>(
        'SELECT * FROM request_lines WHERE id = $1',
        [id],
      )
    ).rows[0];

  beforeAll(async () => {
    await pool().query(
      `INSERT INTO users (sub, full_name, department, status)
       VALUES ($1, 'Hành chính', 'Phòng HC', 'active')`,
      [ADMIN],
    );
    category = (
      await pool().query<{ id: string }>(
        'INSERT INTO item_categories (name) VALUES ($1) RETURNING id',
        [`e2e-review-cat-${SUFFIX}`],
      )
    ).rows[0].id;
  });

  f.onCleanup(async (p) => {
    await p.query('DELETE FROM requests WHERE user_sub = ANY($1)', [[A, B]]);
    await p.query('DELETE FROM items WHERE name LIKE $1', [`${NEW_PREFIX}-%`]);
    await p.query('DELETE FROM item_categories WHERE id = $1', [category]);
    await p.query(
      "DELETE FROM periods WHERE ym = '2026-10-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '2026-10-01')",
    );
  });

  it('member → 403', async () => {
    const { line } = await customLine();
    await review(line.id, { action: 'accept' }, 'member').expect(403);
    await as(http().get('/api/admin/review'), A).expect(403);
  });

  it('accept → accepted; xử lý lần 2 → 409 LINE_ALREADY_REVIEWED; audit', async () => {
    const { line } = await customLine();
    const res = await review(line.id, { action: 'accept' }).expect(200);
    expect(res.body.line).toMatchObject({
      id: line.id,
      review_status: 'accepted',
    });
    const again = await review(line.id, { action: 'reject', note: 'không' });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('LINE_ALREADY_REVIEWED');
    const audit = await pool().query<{ detail: Record<string, unknown> }>(
      "SELECT detail FROM audit_log WHERE action = 'line.review' AND object_id = $1",
      [line.id],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].detail).toMatchObject({
      action: 'accept',
      before: { review_status: 'pending' },
      after: { review_status: 'accepted' },
    });
  });

  it('dòng không có → 404 LINE_NOT_FOUND; dòng món danh mục → 409', async () => {
    const missing = await review('00000000-0000-4000-8000-000000000000', {
      action: 'accept',
    });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('LINE_NOT_FOUND');
    const r = await seed([{ item_id: await newItem(), qty: 1 }]);
    const res = await review(r.lines[0].id, { action: 'accept' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LINE_ALREADY_REVIEWED');
  });

  it('reject không note / note < 3 ký tự → 400 REASON_REQUIRED; có note → rejected, member thấy lý do', async () => {
    const { line } = await customLine();
    for (const note of [undefined, '  ab  ']) {
      const res = await review(line.id, { action: 'reject', note });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('REASON_REQUIRED');
    }
    await review(line.id, {
      action: 'reject',
      note: ' Không mua được ',
    }).expect(200);
    const mine = await getMine();
    expect(mine.lines[0]).toMatchObject({
      review_status: 'rejected',
      review_note: 'Không mua được',
      readonly_for_member: true,
    });
  });

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
      stock_qty: number;
    };
    expect(created).toMatchObject({ image_file_id: img, stock_qty: 0 });
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

  it('GET admin/review: lọc theo status/ym; previously_accepted theo người + tên chuẩn hóa ở kỳ trước', async () => {
    await pool().query(
      `INSERT INTO periods (ym, deadline) VALUES ('2026-10-01', '2026-10-10T17:00:00Z')
       ON CONFLICT (ym) DO NOTHING`,
    );
    const img = await upload(A);
    const old = await pool().query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub)
       VALUES ('2026-10-01', $1, $1) RETURNING id`,
      [A],
    );
    await pool().query(
      `INSERT INTO request_lines (request_id, custom_name, custom_unit, image_file_id, qty, review_status)
       VALUES ($1, 'Bìa còng đặc biệt', 'cai', $2, 1, 'accepted')`,
      [old.rows[0].id, img],
    );
    const a = await customLine(A, '  bìa CÒNG đặc biệt ');
    const b = await customLine(B, 'Bìa còng đặc biệt');
    const rows = await list('status=pending&ym=2026-11');
    const mineA = rows.find((r) => r.line_id === a.line.id);
    const mineB = rows.find((r) => r.line_id === b.line.id);
    expect(mineA).toMatchObject({
      request_id: a.request.id,
      period_ym: '2026-11',
      user_sub: A,
      full_name: 'Nhân viên A',
      review_status: 'pending',
      previously_accepted: true,
    });
    expect(mineB).toMatchObject({ previously_accepted: false });
    expect(rows.every((r) => r.review_status === 'pending')).toBe(true);
    expect(
      (await list('status=accepted&ym=2026-10')).map((r) => r.request_id),
    ).toContain(old.rows[0].id);
    expect(
      (await list('status=accepted&ym=2026-11')).map((r) => r.request_id),
    ).not.toContain(old.rows[0].id);
    const bad = await as(
      http().get('/api/admin/review?status=n%2Fa'),
      ADMIN,
      'admin',
    );
    expect(bad.status).toBe(400);
  });
});
