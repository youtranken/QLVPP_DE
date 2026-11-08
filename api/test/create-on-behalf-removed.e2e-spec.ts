import { AFTER_DEADLINE } from './me-request.fixture';
import { reviewFixture } from './review.fixture';

const ROLES = ['admin', 'member', 'sa', 'anonymous'] as const;
const CSRF = [true, false] as const;

describe('gỡ hẳn "Tạo phiếu hộ": POST /api/admin/requests không còn (e2e)', () => {
  const f = reviewFixture('nobehalf');
  const { A, B, ADMIN, at, http, as, newItem, pool, seed } = f;
  const HC = `e2e-req-hc-${f.SUFFIX}`;
  const NAME = `Nobehalf${f.SUFFIX}`;
  let item: string;

  beforeAll(async () => {
    item = await newItem();
    await pool().query(
      `INSERT INTO users (sub, full_name, status, role) VALUES ($1, $2, 'active', 'admin')`,
      [HC, NAME],
    );
  });

  const count = async () =>
    Number(
      (
        await pool().query(
          'SELECT count(*) FROM requests WHERE user_sub = ANY($1)',
          [[A, B]],
        )
      ).rows[0].count,
    );

  it.each(ROLES.flatMap((role) => CSRF.map((csrf) => [role, csrf] as const)))(
    'vai %s, có CSRF = %s → 404 NOT_FOUND, không tạo phiếu',
    async (role, csrf) => {
      let req = http().post('/api/admin/requests');
      if (role !== 'anonymous') req = as(req, ADMIN, role);
      if (csrf) req = req.set('x-csrf-token', 'tok');
      const res = await req.send({
        user_sub: B,
        lines: [{ item_id: item, qty: 1 }],
      });
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
      expect(await count()).toBe(0);
    },
  );

  it('GET /admin/requests/:id và PUT …/lines (kỳ khóa, admin) vẫn 2xx; member → 403', async () => {
    const r = await seed([{ item_id: item, qty: 2 }]);
    at(AFTER_DEADLINE);
    await as(http().get(`/api/admin/requests/${r.id}`), A).expect(403);
    await as(http().put(`/api/admin/requests/${r.id}/lines`), A)
      .send({})
      .expect(403);
    await as(http().get(`/api/admin/requests/${r.id}`), ADMIN, 'admin').expect(
      200,
    );
    await as(http().put(`/api/admin/requests/${r.id}/lines`), ADMIN, 'admin')
      .send({
        lines: [
          {
            id: r.lines[0].id,
            qty: 1,
            expected_qty: 2,
            reason_code: 'over_quota',
          },
        ],
        expected_updated_at: r.updated_at,
      })
      .expect(200);
  });

  it('phiếu cũ do Hành chính tạo (created_by_sub ≠ user_sub) vẫn hiện ở Tổng hợp kỳ khóa và Lịch sử chủ phiếu', async () => {
    const { rows } = await pool().query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('2026-11-01', $1, $2) RETURNING id`,
      [B, ADMIN],
    );
    await pool().query(
      'INSERT INTO request_lines (request_id, item_id, qty) VALUES ($1, $2, 1)',
      [rows[0].id, item],
    );
    at(AFTER_DEADLINE);
    const people = (
      await as(
        http().get('/api/admin/periods/2026-11/requests'),
        ADMIN,
        'admin',
      ).expect(200)
    ).body as {
      items: { request_id: string }[];
    };
    expect(people.items.map((p) => p.request_id)).toContain(rows[0].id);
    const history = (await as(http().get('/api/me/requests'), B).expect(200))
      .body as { items: { period_ym: string; line_count: number }[] };
    expect(history.items).toEqual([
      expect.objectContaining({ period_ym: '2026-11', line_count: 1 }),
    ]);
  });

  it('client cũ gửi ?exclude_admin=true → bị lột, 200 có cả Hành chính (role admin)', async () => {
    const res = await as(http().get('/api/admin/users'), ADMIN, 'admin')
      .query({ search: NAME, exclude_admin: 'true' })
      .expect(200);
    expect(
      (res.body as { items: { sub: string }[] }).items.map((u) => u.sub),
    ).toEqual([HC]);
  });
});
