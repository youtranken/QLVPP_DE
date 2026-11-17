import { adminSummaryFixture } from './admin-summary.fixture';

// Kỳ quá khứ riêng — không suite nào khác ghi phiếu vào 2023-05
const YM = '2023-05';

type Body = {
  sub: string;
  full_name: string | null;
  year: number;
  items: { period_ym: string; request_id: string; total_qty: number }[];
};

describe('GET admin/users/:sub/requests?year= — lịch sử đặt hàng một nhân viên (G3)', () => {
  const f = adminSummaryFixture(YM);
  const { U1, U3, SUFFIX, ids, asAdmin } = f;

  it('admin: chỉ phiếu của :sub trong năm đó (U2 cùng kỳ không lọt), mới nhất trước', async () => {
    const body = (await asAdmin(`/users/${U1}/requests?year=2023`).expect(200))
      .body as Body;
    expect(body.sub).toBe(U1);
    expect(body.year).toBe(2023);
    expect(body.full_name).toBe(`Bình ${SUFFIX}`);
    expect(body.items.map((i) => [i.period_ym, i.request_id])).toEqual([
      [YM, ids.r1],
    ]);
    expect(JSON.stringify(body)).not.toContain(ids.r2);
  });

  it('người không có phiếu năm đó → 200 items []; năm khác → []', async () => {
    expect(
      (
        (await asAdmin(`/users/${U3}/requests?year=2023`).expect(200))
          .body as Body
      ).items,
    ).toEqual([]);
    expect(
      (
        (await asAdmin(`/users/${U1}/requests?year=2024`).expect(200))
          .body as Body
      ).items,
    ).toEqual([]);
  });

  it('sub không tồn tại → 404 USER_NOT_FOUND', async () => {
    const res = await asAdmin(
      `/users/khong-co-${Date.now()}/requests?year=2023`,
    ).expect(404);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  });

  it('member → 403 FORBIDDEN_ROLE; sa → 200', async () => {
    const res = await asAdmin(
      `/users/${U1}/requests?year=2023`,
      'member',
    ).expect(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
    await asAdmin(`/users/${U1}/requests?year=2023`, 'sa').expect(200);
  });

  it('biên năm: 2000 và 2100 được; 1999, 2101, "abc", thiếu year → 400 VALIDATION {fields:[year]}', async () => {
    await asAdmin(`/users/${U1}/requests?year=2000`).expect(200);
    await asAdmin(`/users/${U1}/requests?year=2100`).expect(200);
    for (const q of ['year=1999', 'year=2101', 'year=abc', '']) {
      const res = await asAdmin(`/users/${U1}/requests?${q}`).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION', fields: ['year'] });
    }
  });
});
