import { adjustFixture } from './adjust.fixture';
import { AFTER_DEADLINE } from './me-request.fixture';

describe('GET admin/periods/:ym/registrations/:id: kèm điều chỉnh của Adm D&E (popup Lịch sử đặt hàng)', () => {
  const f = adjustFixture('regadj');
  const { ADMIN, as, at, http, pool, seed, cut } = f;

  beforeAll(async () => {
    await pool().query(
      `INSERT INTO users (sub, full_name, department, status) VALUES ($1, 'Hành chính', 'Phòng HC', 'active')`,
      [ADMIN],
    );
  });

  it('giảm dòng 1 từ 5 còn 3, bỏ dòng 2 (2 → 0) → dòng 1 có adjustments 5→3, removed_lines có dòng bỏ', async () => {
    const r = await seed([5, 2]);
    at(AFTER_DEADLINE);
    await cut(r, {
      0: { qty: 3, reason_code: 'over_quota' },
      1: { qty: 0, reason_code: 'removed' },
    }).expect(200);
    const res = await as(
      http().get(`/api/admin/periods/${r.period_ym}/registrations/${r.id}`),
      ADMIN,
      'admin',
    ).expect(200);
    expect(res.body.lines).toHaveLength(1);
    expect(res.body.lines[0].adjustments).toMatchObject([
      { before: 5, after: 3, reason_code: 'over_quota' },
    ]);
    expect(res.body.removed_lines).toMatchObject([
      { before: 2, reason_code: 'removed' },
    ]);
  });

  it('phiếu chưa điều chỉnh → adjustments [] từng dòng, removed_lines []', async () => {
    const r = await seed([4]);
    at(AFTER_DEADLINE);
    const res = await as(
      http().get(`/api/admin/periods/${r.period_ym}/registrations/${r.id}`),
      ADMIN,
      'admin',
    ).expect(200);
    expect(res.body.lines[0].adjustments).toEqual([]);
    expect(res.body.removed_lines).toEqual([]);
  });
});
