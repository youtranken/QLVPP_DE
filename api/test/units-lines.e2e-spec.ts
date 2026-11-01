import { meRequestFixture } from './me-request.fixture';

describe('me/request: "Món khác" với ĐVT ngừng', () => {
  const { SUFFIX, A, ADMIN, http, as, save, view, pool, onCleanup } =
    meRequestFixture('units');
  const ON = `on-${SUFFIX}`.slice(0, 32);
  const OFF = `off-${SUFFIX}`.slice(0, 32);
  const LATER = `later-${SUFFIX}`.slice(0, 32);
  const setActive = (code: string, active: boolean) =>
    pool().query('UPDATE units SET active = $2 WHERE code = $1', [
      code,
      active,
    ]);
  const customLine = (unit: string, qty = 1) => ({
    custom_name: 'Kẹp tài liệu loại lạ',
    custom_unit: unit,
    qty,
  });

  beforeAll(async () => {
    await pool().query(
      `INSERT INTO units (code, name, active) VALUES
         ($1, $1, true), ($2, $2, false), ($3, $3, true)`,
      [ON, OFF, LATER],
    );
    onCleanup(async (p) => {
      await p.query('DELETE FROM requests WHERE user_sub = $1', [A]);
      await p.query('DELETE FROM units WHERE code = ANY($1)', [
        [ON, OFF, LATER],
      ]);
    });
  });

  beforeEach(async () => {
    await setActive(LATER, true);
  });

  it('dòng mới chọn ĐVT ngừng → 400 UNIT_INACTIVE kèm line_index; ĐVT đang dùng → 200', async () => {
    const res = await save([customLine(OFF)]).expect(400);
    expect(res.body).toMatchObject({ code: 'UNIT_INACTIVE', line_index: 0 });
    await save([customLine(ON)]).expect(200);
  });

  it('dòng mới chọn mã không có → 400 VALIDATION {fields:[custom_unit]} kèm line_index', async () => {
    const res = await save([customLine('khong-co-dvt')]).expect(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION',
      fields: ['custom_unit'],
      line_index: 0,
    });
  });

  it('dòng cũ có ĐVT vừa ngừng: lưu lại không đổi ĐVT (gửi lại hoặc bỏ trống trường) → 200; đổi sang ĐVT ngừng khác → UNIT_INACTIVE kèm line_id', async () => {
    const first = view(await save([customLine(LATER)]).expect(200));
    const line = first.lines[0];
    await setActive(LATER, false);
    const resent = await save([{ id: line.id, ...customLine(LATER, 2) }], {
      expected_updated_at: first.updated_at,
    }).expect(200);
    const again = view(resent);
    expect(again.lines[0]).toMatchObject({ qty: 2 });
    const omitted = view(
      await save([{ id: line.id, qty: 3 }], {
        expected_updated_at: again.updated_at,
      }).expect(200),
    );
    const swap = await save([{ id: line.id, ...customLine(OFF, 3) }], {
      expected_updated_at: omitted.updated_at,
    }).expect(400);
    expect(swap.body).toMatchObject({
      code: 'UNIT_INACTIVE',
      line_id: line.id,
    });
  });

  it('ĐVT chỉ có dòng phiếu dùng (không món) → ?all=1 in_use true, item_count 0', async () => {
    await save([customLine(ON)]).expect(200);
    const res = await as(http().get('/api/units?all=1'), ADMIN, 'admin').expect(
      200,
    );
    const unit = (res.body as { code: string }[]).find((u) => u.code === ON);
    expect(unit).toMatchObject({ in_use: true, item_count: 0 });
  });

  it('chép kỳ trước: dòng ngoài DM có ĐVT nay đã ngừng → bỏ vào skipped lý do UNIT_INACTIVE; giỏ còn lại lưu được 200', async () => {
    await pool().query(
      `INSERT INTO periods (ym, deadline) VALUES ('2026-10-01', '2026-10-10T17:00:00Z')
       ON CONFLICT (ym) DO UPDATE SET deadline = EXCLUDED.deadline`,
    );
    const { rows } = await pool().query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub)
       VALUES ('2026-10-01', $1, $1) RETURNING id`,
      [A],
    );
    await pool().query(
      `INSERT INTO request_lines (request_id, custom_name, custom_unit, qty, review_status)
       VALUES ($1, 'Kẹp ĐVT ngừng', $2, 1, 'pending'), ($1, 'Kẹp ĐVT dùng', $3, 2, 'pending')`,
      [rows[0].id, LATER, ON],
    );
    await setActive(LATER, false);
    const res = await as(
      http().post('/api/me/request/copy-previous'),
      A,
    ).expect(200);
    const body = res.body as {
      lines: Record<string, unknown>[];
      skipped: { name: string; reason: string }[];
    };
    expect(body.skipped).toEqual([
      { name: 'Kẹp ĐVT ngừng', reason: 'UNIT_INACTIVE' },
    ]);
    expect(body.lines).toMatchObject([
      { custom_name: 'Kẹp ĐVT dùng', custom_unit: ON, qty: 2 },
    ]);
    await save(body.lines).expect(200);
  });
});
