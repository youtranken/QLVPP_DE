import { AFTER_DEADLINE } from './me-request.fixture';
import { reviewFixture } from './review.fixture';

describe('admin/review: hàng chờ, nhận, từ chối', () => {
  const f = reviewFixture('review');
  const {
    A,
    ADMIN,
    B,
    as,
    customLine,
    getMine,
    http,
    lineRow,
    list,
    newItem,
    pool,
    review,
    seed,
    upload,
  } = f;

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
    f.at(AFTER_DEADLINE);
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

  it('reject note "  abc  " (đúng 3 ký tự sau trim) → 200 rejected, lưu note đã trim', async () => {
    const { line } = await customLine();
    const res = await review(line.id, { action: 'reject', note: '  abc  ' });
    expect(res.status).toBe(200);
    expect(res.body.line).toMatchObject({
      review_status: 'rejected',
      review_note: 'abc',
    });
  });

  it('note 501 ký tự → 400 VALIDATION {fields: [note]}, dòng vẫn pending; 500 ký tự → 200 rejected, lưu đủ 500', async () => {
    const { line } = await customLine();
    const long = await review(line.id, {
      action: 'reject',
      note: 'n'.repeat(501),
    }).expect(400);
    expect(long.body).toMatchObject({ code: 'VALIDATION', fields: ['note'] });
    expect((await lineRow(line.id)).review_status).toBe('pending');
    const res = await review(line.id, {
      action: 'reject',
      note: 'n'.repeat(500),
    }).expect(200);
    expect(res.body.line).toMatchObject({
      review_status: 'rejected',
      review_note: 'n'.repeat(500),
    });
  });

  it('review đổi updated_at phiếu: ngăn Điều chỉnh giữ mốc cũ lưu → 409 STALE_UPDATE; request_updated_at khớp DB', async () => {
    const { line } = await customLine();
    const got = await getMine();
    const res = await review(line.id, { action: 'accept' }).expect(200);
    const stamp = res.body.request_updated_at as string;
    expect(Date.parse(stamp)).toBeGreaterThan(Date.parse(got.updated_at));
    const db = await pool().query<{ at: string }>(
      `SELECT to_char(date_trunc('milliseconds', updated_at) AT TIME ZONE 'UTC',
                      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at
       FROM requests WHERE id = $1`,
      [got.id],
    );
    expect(stamp).toBe(db.rows[0].at);
    const adjust = (expected: string) =>
      as(
        http().put(`/api/admin/requests/${got.id}/lines`),
        ADMIN,
        'admin',
      ).send({
        lines: got.lines.map((l) => ({
          id: l.id,
          qty: l.qty,
          expected_qty: l.qty,
        })),
        expected_updated_at: expected,
      });
    const stale = await adjust(got.updated_at);
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('STALE_UPDATE');
    await adjust(stamp).expect(200);
  });

  it('expected_updated_at (ngăn Điều chỉnh): mốc cũ → 409 STALE_UPDATE, dòng vẫn pending, không audit; mốc đúng → 200', async () => {
    const { line } = await customLine();
    const got = await getMine();
    const stale = await review(line.id, {
      action: 'accept',
      expected_updated_at: '2001-01-01T00:00:00.000Z',
    });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('STALE_UPDATE');
    expect((await lineRow(line.id)).review_status).toBe('pending');
    const audit = await pool().query(
      "SELECT 1 FROM audit_log WHERE action = 'line.review' AND object_id = $1",
      [line.id],
    );
    expect(audit.rows).toHaveLength(0);
    await review(line.id, {
      action: 'accept',
      expected_updated_at: got.updated_at,
    }).expect(200);
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

  it.each(['2026-13', '2026-1', 'abc'])(
    'GET admin/review?ym=%s → 400 INVALID_PERIOD',
    async (ym) => {
      const res = await as(
        http().get(`/api/admin/review?ym=${ym}`),
        ADMIN,
        'admin',
      ).expect(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PERIOD' });
    },
  );
});
