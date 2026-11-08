import { adminSummaryFixture } from './admin-summary.fixture';

// Kỳ quá khứ riêng của suite này (không suite nào khác ghi phiếu vào 2025-08)
const YM = '2025-08';

interface Person {
  request_id: string;
  user_sub: string;
  full_name: string | null;
  email: string | null;
  team: string | null;
  qty: number;
  before: number | null;
  reason_code: string | null;
  reason_note: string | null;
}
interface ItemPeople {
  key: string;
  name: string;
  unit: string;
  requested: number;
  after: number;
  people: Person[];
}

describe('GET admin/periods/:ym/items/:key/people', () => {
  // Hook dọn đăng ký trước hook của fixture (nó đóng pool)
  let cleanup = async () => {};
  afterAll(() => cleanup());
  const f = adminSummaryFixture(YM);
  const { SUFFIX, asAdmin, addLine, newRequest, addUser } = f;
  const A = f.sub('pa');
  const B = f.sub('pb');
  const C = f.sub('pc');
  const D = f.sub('pd');
  let own = '';
  let own2 = '';
  const people = (key: string, role = 'admin', ym = YM) =>
    asAdmin(`/periods/${ym}/items/${encodeURIComponent(key)}/people`, role);

  const adjust = (
    sub: string,
    requestId: string,
    lineId: string,
    cols: { before: number; after: number; reason: string; at: string },
    item: string | null,
    name: string,
  ) =>
    f.pool().query(
      `INSERT INTO request_line_adjustments
         (batch_id, period_ym, user_sub, request_id, line_id, item_id, name, unit,
          qty_before, qty_after, reason_code, actor_sub, created_at)
       VALUES (gen_random_uuid(), $1::date, $2, $3, $4, $5, $6, 'cay', $7, $8, $9, $2, $10::timestamptz)`,
      [
        `${YM}-01`,
        sub,
        requestId,
        lineId,
        item,
        name,
        cols.before,
        cols.after,
        cols.reason,
        cols.at,
      ],
    );

  beforeAll(async () => {
    const pool = f.pool();
    cleanup = async () => {
      await pool.query('DELETE FROM request_lines WHERE item_id = $1', [own]);
      await pool.query('DELETE FROM items WHERE id = ANY($1::uuid[])', [
        [own, own2].filter(Boolean),
      ]);
    };
    own = (
      await pool.query<{ id: string }>(
        `INSERT INTO items (name, unit, max_qty) VALUES ($1, 'cay', 50) RETURNING id`,
        [`e2e-people-${SUFFIX}`],
      )
    ).rows[0].id;
    await addUser(A, `An ${SUFFIX}`, `pa.${SUFFIX}@pmh.test`, 'Phòng A');
    await addUser(B, `Bình ${SUFFIX}`, `pb.${SUFFIX}@pmh.test`, 'Phòng A');
    await addUser(C, `Chi ${SUFFIX}`, `pc.${SUFFIX}@pmh.test`, 'Phòng A');
    const ra = await newRequest(A, 'Phòng A');
    await addLine(ra, { item_id: own, qty: 19 });
    const rb = await newRequest(B, 'Phòng A');
    // B từng đặt 1 rồi Hành chính bỏ dòng (qty 0, dòng không còn)
    await adjust(
      B,
      rb,
      '00000000-0000-4000-8000-000000000001',
      {
        before: 1,
        after: 0,
        reason: 'adm_out_of_stock',
        at: '2025-08-12T01:00:00Z',
      },
      own,
      'x',
    );
    const rc = await newRequest(C, 'Phòng A');
    await addLine(rc, {
      custom_name: 'Bút dạ',
      custom_unit: 'cai',
      review_status: 'accepted',
      qty: 2,
    });
    await addUser(D, `Dũng ${SUFFIX}`, null, null);
    const rd = await newRequest(D, null);
    await addLine(rd, {
      custom_name: ' bút dạ ',
      custom_unit: 'cai',
      review_status: 'accepted',
      qty: 3,
    });
  });

  it('A đặt 19, B đặt 1 rồi bị bỏ (0, Không có hàng) → people [A 19, B 0 trước 1], requested 20, after 19', async () => {
    const body = (await people(own).expect(200)).body as ItemPeople;
    expect(body).toMatchObject({
      key: own,
      requested: 20,
      after: 19,
      unit: 'cay',
    });
    expect(body.people).toEqual([
      expect.objectContaining({
        user_sub: A,
        qty: 19,
        before: null,
        reason_code: null,
        team: null,
      }),
      expect.objectContaining({
        user_sub: B,
        qty: 0,
        before: 1,
        reason_code: 'adm_out_of_stock',
      }),
    ]);
  });

  it('dòng giảm 5 → 3 rồi bỏ (3 → 0): trước = 5, requested tính 5, after 0', async () => {
    own2 = (
      await f
        .pool()
        .query<{ id: string }>(
          `INSERT INTO items (name, unit, max_qty) VALUES ($1, 'cay', 50) RETURNING id`,
          [`e2e-people2-${SUFFIX}`],
        )
    ).rows[0].id;
    const E = f.sub('pe');
    await addUser(E, `Em ${SUFFIX}`, `pe.${SUFFIX}@pmh.test`, 'Phòng A');
    const re = await newRequest(E, 'Phòng A');
    const line = '00000000-0000-4000-8000-000000000002';
    await adjust(
      E,
      re,
      line,
      { before: 5, after: 3, reason: 'over_quota', at: '2025-08-12T01:00:00Z' },
      own2,
      'x',
    );
    await adjust(
      E,
      re,
      line,
      {
        before: 3,
        after: 0,
        reason: 'adm_out_of_stock',
        at: '2025-08-12T02:00:00Z',
      },
      own2,
      'x',
    );
    const body = (await people(own2).expect(200)).body as ItemPeople;
    expect(body).toMatchObject({ requested: 5, after: 0 });
    expect(body.people).toEqual([
      expect.objectContaining({
        user_sub: E,
        qty: 0,
        before: 5,
        reason_code: 'adm_out_of_stock',
      }),
    ]);
  });

  it('món ngoài DM gộp hai cách viết "Bút dạ" và " bút dạ " cùng ĐVT thành một khóa', async () => {
    const key = 'custom:["bút dạ", "cai"]';
    const res = (await people(key).expect(200)).body as ItemPeople;
    expect(res.people.map((p) => p.user_sub)).toEqual([D, C]);
    expect(res.after).toBe(5);
    expect(res.name.toLowerCase()).toBe('bút dạ');
  });

  it('khóa không có → people rỗng', async () => {
    const body = (await people('custom:["không có","x"]').expect(200))
      .body as ItemPeople;
    expect(body.people).toEqual([]);
    expect(body.requested).toBe(0);
  });

  it('member → 403 FORBIDDEN_ROLE', async () => {
    const res = await people(own, 'member').expect(403);
    expect((res.body as { code: string }).code).toBe('FORBIDDEN_ROLE');
  });

  it('kỳ sau kỳ mở → 400 INVALID_PERIOD', async () => {
    const res = await people(own, 'admin', '2026-12').expect(400);
    expect((res.body as { code: string }).code).toBe('INVALID_PERIOD');
  });

  it('biên độ dài khóa: 300 ký tự được, 301 → 400 VALIDATION', async () => {
    await people('k'.repeat(300)).expect(200);
    const res = await people('k'.repeat(301)).expect(400);
    expect((res.body as { code: string }).code).toBe('VALIDATION');
  });
});
