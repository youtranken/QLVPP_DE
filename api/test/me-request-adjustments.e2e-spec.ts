import { adjustFixture } from './adjust.fixture';
import { BEFORE_DEADLINE } from './me-request.fixture';

interface Adjustment {
  before: number;
  after: number;
  reason_code: string;
  reason_note: string | null;
  at: string;
}
interface MemberView {
  is_open: boolean;
  lines: { id: string; qty: number; adjustments: Adjustment[] }[];
  removed_lines: (Omit<Adjustment, 'after'> & {
    name: string;
    name_en: string | null;
    unit: string;
  })[];
  removed_all: boolean;
}

describe('GET me/request: nhân viên thấy điều chỉnh của Hành chính ở kỳ đã khóa', () => {
  const f = adjustFixture('me-adjust');
  const { as, http, freeze, at, seed, cut, view, newOwner } = f;
  const over = { reason_code: 'over_quota' };
  const SCRIPT = '<script>alert(1)</script>';

  const mine = async (sub: string, ym = '2026-11') =>
    (await as(http().get(`/api/me/request?ym=${ym}`), sub).expect(200))
      .body as MemberView;

  it('giảm 5 → 4 → 3 (2 lần, theo thời gian) + bỏ 1 dòng → adjustments của dòng, removed_lines từ bản ghi, removed_all false', async () => {
    const sub = await newOwner();
    const r = await seed([5, 3], sub);
    freeze('2026-11-13T02:00:00.000Z');
    const first = view(await cut(r, { 0: { qty: 4, ...over } }).expect(200));
    freeze('2026-11-13T02:10:00.000Z');
    await cut(first, {
      0: { qty: 3, ...over },
      1: { qty: 0, reason_code: 'other', reason_note: SCRIPT },
    }).expect(200);

    const v = await mine(sub);
    expect(v.is_open).toBe(false);
    expect(v.lines).toHaveLength(1);
    expect(v.lines[0].adjustments).toEqual([
      {
        before: 5,
        after: 4,
        reason_code: 'over_quota',
        reason_note: null,
        at: '2026-11-13T02:00:00.000Z',
      },
      {
        before: 4,
        after: 3,
        reason_code: 'over_quota',
        reason_note: null,
        at: '2026-11-13T02:10:00.000Z',
      },
    ]);
    expect(v.removed_lines).toEqual([
      {
        name: expect.stringContaining('e2e-req-item-') as unknown,
        name_en: null,
        unit: 'cay',
        before: 3,
        reason_code: 'other',
        reason_note: SCRIPT,
        at: '2026-11-13T02:10:00.000Z',
      },
    ]);
    expect(v.removed_all).toBe(false);
  });

  it('Hành chính bỏ hết dòng → phiếu 0 dòng, removed_all true, removed_lines đủ 2 dòng', async () => {
    const sub = await newOwner();
    const r = await seed([2, 1], sub);
    freeze('2026-11-13T02:00:00.000Z');
    await cut(r, {
      0: { qty: 0, reason_code: 'duplicate' },
      1: { qty: 0, ...over },
    }).expect(200);
    const v = await mine(sub);
    expect(v.lines).toEqual([]);
    expect(v.removed_all).toBe(true);
    expect(v.removed_lines.map((l) => [l.before, l.reason_code])).toEqual(
      expect.arrayContaining([
        [2, 'duplicate'],
        [1, 'over_quota'],
      ]),
    );
  });

  it('Lịch sử (danh sách): phiếu bị Hành chính bỏ hết → removed_all true; phiếu còn dòng hoặc chưa ai sửa → false', async () => {
    const sub = await newOwner();
    const r = await seed([2], sub);
    const history = async () =>
      (
        (await as(http().get('/api/me/requests'), sub).expect(200)).body as {
          items: {
            period_ym: string;
            line_count: number;
            removed_all: boolean;
          }[];
        }
      ).items.find((i) => i.period_ym === '2026-11');
    expect(await history()).toMatchObject({
      line_count: 1,
      removed_all: false,
    });
    freeze('2026-11-13T02:00:00.000Z');
    const once = await cut(r, { 0: { qty: 1, ...over } }).expect(200);
    expect(await history()).toMatchObject({
      line_count: 1,
      removed_all: false,
    });
    await cut(once.body.request, { 0: { qty: 0, ...over } }).expect(200);
    expect(await history()).toMatchObject({ line_count: 0, removed_all: true });
  });

  it('kỳ đang mở: nhân viên không thấy gì của Hành chính (adjustments rỗng, removed_all false)', async () => {
    const sub = await newOwner();
    await seed([2], sub);
    at(BEFORE_DEADLINE);
    const v = await mine(sub);
    expect(v.is_open).toBe(true);
    expect(v.lines[0].adjustments).toEqual([]);
    expect(v.removed_lines).toEqual([]);
    expect(v.removed_all).toBe(false);
  });
});
