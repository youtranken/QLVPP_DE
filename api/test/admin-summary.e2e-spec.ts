import { adminSummaryFixture } from './admin-summary.fixture';

// Kỳ quá khứ riêng của suite này — không suite nào khác ghi phiếu vào 2025-06
const YM = '2025-06';

interface Unregistered {
  sub: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
}

describe('admin/periods/:ym/summary, unregistered, admin/requests/:id', () => {
  const f = adminSummaryFixture(YM);
  const { U1, U2, U3, LOCKED, OUTSIDER, SUFFIX, ids, asAdmin } = f;
  const unregistered = async () =>
    (
      (await asAdmin(`/periods/${YM}/unregistered`).expect(200)).body as {
        items: Unregistered[];
      }
    ).items;
  const summary = async () =>
    (await asAdmin(`/periods/${YM}/summary`).expect(200)).body as Record<
      string,
      unknown
    >;
  const setStatus = (sub: string, status: string) =>
    f
      .pool()
      .query('UPDATE users SET status = $2 WHERE sub = $1', [sub, status]);

  it('summary: registered 2/3 (live: active, cùng group không phân biệt hoa thường), KPI theo dòng hiệu lực', async () => {
    const lowStock = Number(
      (
        await f.pool().query(
          `SELECT count(*) FROM items WHERE active AND restock_level > 0 AND stock_qty > 0
               AND stock_qty <= floor(restock_level * 0.2)`,
        )
      ).rows[0].count,
    );
    expect(await summary()).toEqual({
      ym: YM,
      deadline: '2025-06-10T17:00:00.000Z',
      is_open: false,
      registered: 2,
      headcount: 3,
      headcount_source: 'live',
      unregistered: 1,
      lines_pending_delivery: 2,
      custom_pending: 1,
      low_stock: lowStock,
    });
  });

  it('summary: periods.headcount đã chụp thì dùng snapshot; unregistered vẫn theo tập sống', async () => {
    await f
      .pool()
      .query("UPDATE periods SET headcount = 7 WHERE ym = '2025-06-01'");
    try {
      expect(await summary()).toMatchObject({
        headcount: 7,
        headcount_source: 'snapshot',
        unregistered: 1,
      });
    } finally {
      await f
        .pool()
        .query("UPDATE periods SET headcount = NULL WHERE ym = '2025-06-01'");
    }
  });

  it('người có phiếu rồi bị locked: registered vẫn đếm (FR-34), headcount sống và unregistered không chứa', async () => {
    await setStatus(U2, 'locked');
    try {
      expect(await summary()).toMatchObject({
        registered: 2,
        headcount: 2,
        unregistered: 1,
      });
      expect((await unregistered()).map((u) => u.sub)).toEqual([U3]);
    } finally {
      await setStatus(U2, 'active');
    }
  });

  it('unregistered = người trong headcount chưa có phiếu (bỏ locked, ngoài group); số trong summary = độ dài danh sách', async () => {
    expect(await unregistered()).toEqual([
      {
        sub: U3,
        full_name: `Chi ${SUFFIX}`,
        email: `chi.${SUFFIX}@pmh.test`,
        department: 'Phòng A',
      },
    ]);
  });

  it('authorized_groups rỗng → gate tắt: người ngoài group vào tập sống, locked vẫn bị loại', async () => {
    await f.setGroups([]);
    try {
      const list = await unregistered();
      const subs = list.map((u) => u.sub);
      expect(subs).toEqual(expect.arrayContaining([U3, OUTSIDER]));
      expect(subs).not.toContain(LOCKED);
      expect(subs).not.toContain(U1);
      const body = await summary();
      expect(body).toMatchObject({
        headcount_source: 'live',
        unregistered: list.length,
      });
      expect(body.headcount).toBe(list.length + 2);
    } finally {
      await f.setGroups([f.groupLower]);
    }
  });

  it('summary kỳ quá khứ chưa có dòng periods → 200 rỗng, deadline null', async () => {
    const res = await asAdmin('/periods/2001-01/summary').expect(200);
    expect(res.body).toMatchObject({
      ym: '2001-01',
      deadline: null,
      is_open: false,
      registered: 0,
      lines_pending_delivery: 0,
      custom_pending: 0,
    });
  });

  it('summary kỳ đang mở → is_open true', async () => {
    const res = await asAdmin('/periods/2026-11/summary').expect(200);
    expect(res.body).toMatchObject({ ym: '2026-11', is_open: true });
  });

  it.each([
    ['2026-13', 'tháng sai dạng'],
    ['2026-12', 'kỳ sau kỳ đang mở'],
  ])('ym=%s (%s) → 400 INVALID_PERIOD', async (ym) => {
    for (const path of [
      `/periods/${ym}/summary`,
      `/periods/${ym}/requests`,
      `/periods/${ym}/unregistered`,
    ]) {
      const res = await asAdmin(path).expect(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PERIOD' });
    }
  });

  it('member gọi các endpoint tổng hợp → 403', async () => {
    for (const path of [
      `/periods/${YM}/summary`,
      `/periods/${YM}/requests`,
      `/periods/${YM}/unregistered`,
      `/requests/${ids.r1}`,
    ]) {
      await asAdmin(path, 'member').expect(403);
    }
  });

  it('admin/requests/:id → RequestView + user_status; không có → 404 REQUEST_NOT_FOUND', async () => {
    await setStatus(U2, 'locked');
    try {
      const res = await asAdmin(`/requests/${ids.r2}`).expect(200);
      expect(res.body).toMatchObject({
        id: ids.r2,
        period_ym: YM,
        user_sub: U2,
        is_open: false,
        user_status: 'locked',
      });
      expect((res.body as { lines: unknown[] }).lines).toHaveLength(3);
    } finally {
      await setStatus(U2, 'active');
    }
    const missing = await asAdmin(
      '/requests/00000000-0000-4000-8000-000000000000',
    ).expect(404);
    expect(missing.body).toMatchObject({ code: 'REQUEST_NOT_FOUND' });
    await asAdmin('/requests/not-a-uuid').expect(400);
  });
});
