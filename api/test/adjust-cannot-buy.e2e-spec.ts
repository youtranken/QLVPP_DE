import { adjustFixture } from './adjust.fixture';
import { AFTER_DEADLINE } from './me-request.fixture';

describe('PUT admin/requests/:id/lines: lý do "Không mua được" (cannot_buy)', () => {
  const f = adjustFixture('adjcb');
  const { ADMIN, at, pool, seed, cut, recordsOf } = f;

  beforeAll(async () => {
    await pool().query(
      `INSERT INTO users (sub, full_name, department, status) VALUES ($1, 'Hành chính', 'Phòng HC', 'active')`,
      [ADMIN],
    );
  });

  it('dòng ngoài DM đã chấp nhận giảm 5 → 3 lý do cannot_buy → 200, bản ghi reason_code cannot_buy', async () => {
    const r = await seed([5]);
    await pool().query(
      "UPDATE request_lines SET review_status = 'accepted', item_id = NULL, custom_name = 'Kệ mica', custom_unit = 'cai' WHERE id = $1",
      [r.lines[0].id],
    );
    at(AFTER_DEADLINE);
    await cut(r, { 0: { qty: 3, reason_code: 'cannot_buy' } }).expect(200);
    expect(await recordsOf(r.id)).toMatchObject([
      {
        line_id: r.lines[0].id,
        qty_before: 5,
        qty_after: 3,
        reason_code: 'cannot_buy',
      },
    ]);
  });
});
