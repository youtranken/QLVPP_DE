import { adjustFixture } from './adjust.fixture';
import { AFTER_DEADLINE, BEFORE_DEADLINE } from './me-request.fixture';

interface PersonRow {
  request_id: string;
  saved_at: string;
  updated_at: string;
}

// "Lưu lúc" ở Tổng hợp là giờ nhân viên lưu phiếu, không phải giờ Hành chính giảm/giao (requests.updated_at)
describe('admin/periods/:ym/requests?by=person — saved_at là giờ nhân viên lưu', () => {
  const f = adjustFixture('savedat');
  const { ADMIN, SUFFIX, as, freeze, http, pool, save, view, cut, newItem } = f;
  const OWNER = `e2e-req-saved-${SUFFIX}`;
  const NAME = `Lưu lúc ${SUFFIX}`;
  const SECOND_SAVE = '2026-11-06T04:30:00.000Z';
  const ADMIN_CUT = '2026-11-12T05:00:00.000Z';

  beforeAll(async () => {
    await pool().query(
      `INSERT INTO users (sub, full_name, department, status) VALUES ($1, 'Hành chính', 'Phòng HC', 'active'), ($2, $3, 'Phòng CT', 'active')`,
      [ADMIN, OWNER, NAME],
    );
  });

  const rowOf = async (requestId: string) => {
    const res = await as(
      http().get(`/api/admin/periods/2026-11/requests?by=person&q=${encodeURIComponent(NAME)}`),
      ADMIN,
      'admin',
    ).expect(200);
    return (res.body as { items: PersonRow[] }).items.find((i) => i.request_id === requestId)!;
  };

  it('nhân viên lưu 2 lần → saved_at = lần lưu sau; Hành chính giảm sau khóa → updated_at đổi, saved_at giữ giờ nhân viên', async () => {
    freeze(BEFORE_DEADLINE);
    const item = await newItem({ max_qty: 10 });
    const first = view(await save([{ item_id: item, qty: 5 }], {}, OWNER).expect(200));
    freeze(SECOND_SAVE);
    const r = view(
      await save([{ id: first.lines[0].id, qty: 4 }], { expected_updated_at: first.updated_at }, OWNER).expect(200),
    );
    freeze(ADMIN_CUT);
    await cut(r, { 0: { qty: 3, reason_code: 'over_quota' } }).expect(200);

    const row = await rowOf(r.id);
    expect(row.saved_at).toBe(SECOND_SAVE);
    expect(row.updated_at).toBe(ADMIN_CUT);
  });

  it('chỉ một lần lưu → saved_at = giờ lưu đó (cả khi chưa ai đụng tới)', async () => {
    await pool().query('DELETE FROM requests WHERE user_sub = $1', [OWNER]);
    freeze(BEFORE_DEADLINE);
    const item = await newItem({ max_qty: 10 });
    const r = view(await save([{ item_id: item, qty: 2 }], {}, OWNER).expect(200));
    freeze(AFTER_DEADLINE);
    expect((await rowOf(r.id)).saved_at).toBe(new Date(BEFORE_DEADLINE).toISOString());
  });
});
