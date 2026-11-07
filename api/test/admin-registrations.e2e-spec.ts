import { deliveryFixture } from './delivery.fixture';

const OPEN = '2026-11';
const LAST_OPEN_MS = '2026-11-10T16:59:59.999Z';

interface Row {
  request_id: string;
  user_sub: string;
  full_name: string | null;
  team: string | null;
  line_count: number;
  total_qty: number;
  custom_count: number;
  saved_at: string;
}

describe('admin/periods/:ym/registrations (kỳ mở, chỉ đọc)', () => {
  const f = deliveryFixture('regs');
  const { A, B, ADMIN, as, at, freeze, http, newItem, pool, seed, upload } = f;

  const get = (path: string, sub = ADMIN, role = 'admin') =>
    as(http().get(`/api/admin${path}`), sub, role);
  // Test DB dùng chung có thể còn phiếu kỳ mở của suite khác: chỉ xét người của suite này
  const list = async (ym = OPEN) => {
    const body = (await get(`/periods/${ym}/registrations`).expect(200))
      .body as { items: Row[] };
    return { items: body.items.filter((r) => r.user_sub.endsWith(f.SUFFIX)) };
  };
  const auditCount = async () =>
    Number(
      (await pool().query('SELECT count(*) FROM audit_log')).rows[0].count,
    );
  const savedRequestOf = async (owner: string) => {
    const item = await newItem();
    return seed([{ item_id: item, qty: 3 }], owner);
  };

  beforeEach(async () => {
    await pool().query(
      `INSERT INTO users (sub, full_name, department, status) VALUES ($1, 'Hành chính', 'Phòng HC', 'active')
       ON CONFLICT (sub) DO NOTHING`,
      [ADMIN],
    );
    await pool().query(
      `INSERT INTO periods (ym, deadline) VALUES ('2026-10-01', '2026-10-10T17:00:00Z')
       ON CONFLICT (ym) DO NOTHING`,
    );
    at('2026-11-05T03:00:00Z');
  });

  it('kỳ mở 2026-11 lúc 16:59:59.999Z ngày 10 → 200 danh sách theo saved_at: {full_name, team, line_count, total_qty, custom_count, saved_at}', async () => {
    const itemA = await newItem();
    const itemB = await newItem();
    const img = await upload(A);
    at('2026-11-05T03:00:00Z');
    await seed(
      [
        { item_id: itemA, qty: 2 },
        { item_id: itemB, qty: 3 },
        {
          custom_name: 'Bìa kỳ mở',
          custom_unit: 'cai',
          image_file_id: img,
          qty: 4,
        },
      ],
      A,
    );
    at('2026-11-06T03:00:00Z');
    await seed([{ item_id: itemA, qty: 1 }], B);
    freeze(LAST_OPEN_MS);
    const { items } = await list();
    expect(items.map((r) => r.user_sub)).toEqual([A, B]);
    expect(items[0]).toEqual({
      request_id: expect.any(String),
      user_sub: A,
      full_name: 'Nhân viên A',
      email: null,
      team: null,
      line_count: 3,
      total_qty: 9,
      custom_count: 1,
      saved_at: expect.stringMatching(/^2026-11-05T03:00:00/),
    });
    expect(items[1].line_count).toBe(1);
  });

  it('dòng ngoài danh mục chờ xem vẫn tính (kỳ mở chưa duyệt) và vào custom_count; dòng bị từ chối thì không', async () => {
    const img = await upload(A);
    const r = await seed(
      [
        {
          custom_name: 'Bìa chờ',
          custom_unit: 'cai',
          image_file_id: img,
          qty: 4,
        },
      ],
      A,
    );
    const counts = async () => {
      const row = (await list()).items.find((x) => x.user_sub === A)!;
      return [row.line_count, row.total_qty, row.custom_count];
    };
    expect(await counts()).toEqual([1, 4, 1]);
    await pool().query(
      `UPDATE request_lines SET review_status = 'rejected' WHERE request_id = $1`,
      [r.id],
    );
    expect(await counts()).toEqual([0, 0, 0]);
  });

  it('users.team null → team null; set team "Team Test" → trả "Team Test"', async () => {
    await savedRequestOf(A);
    expect((await list()).items[0].team).toBeNull();
    await pool().query(`UPDATE users SET team = 'Team Test' WHERE sub = $1`, [
      A,
    ]);
    expect((await list()).items[0].team).toBe('Team Test');
  });

  it('không ai đăng ký → {items: []}', async () => {
    expect(await list()).toEqual({ items: [] });
  });

  it('kỳ khóa 2026-10 cũng 200 (lớp open-progress, không 409)', async () => {
    await pool().query(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('2026-10-01', $1, $1)`,
      [A],
    );
    const { items } = await list('2026-10');
    expect(items.map((r) => r.user_sub)).toEqual([A]);
  });

  it('ym 2026-12 (sau kỳ mở) → 400 INVALID_PERIOD cho cả hai route', async () => {
    const r = await savedRequestOf(A);
    for (const path of [
      '/periods/2026-12/registrations',
      `/periods/2026-12/registrations/${r.id}`,
    ]) {
      const res = await get(path).expect(400);
      expect((res.body as { code: string }).code).toBe('INVALID_PERIOD');
    }
  });

  it('biên khóa: 16:59:59.999Z ngày 10 → 2026-12 còn 400; 17:00:00.000Z → 2026-12 thành kỳ mở (200), 2026-11 thành kỳ khóa (vẫn 200)', async () => {
    await pool().query(
      `INSERT INTO periods (ym, deadline) VALUES ('2026-11-01', '2026-11-10T17:00:00Z')
       ON CONFLICT (ym) DO UPDATE SET deadline = EXCLUDED.deadline`,
    );
    freeze(LAST_OPEN_MS);
    const before = await get('/periods/2026-12/registrations').expect(400);
    expect((before.body as { code: string }).code).toBe('INVALID_PERIOD');
    freeze('2026-11-10T17:00:00.000Z');
    await get('/periods/2026-12/registrations').expect(200);
    await get('/periods/2026-11/registrations').expect(200);
  });

  it('registrations/:id kỳ mở → RequestView chỉ đọc + team, lines đủ', async () => {
    const r = await savedRequestOf(A);
    await pool().query(`UPDATE users SET team = 'Team Test' WHERE sub = $1`, [
      A,
    ]);
    const res = await get(`/periods/${OPEN}/registrations/${r.id}`).expect(200);
    const body = res.body as {
      id: string;
      team: string | null;
      user_status: string;
      is_open: boolean;
      lines: { qty: number }[];
    };
    expect(body).toMatchObject({
      id: r.id,
      team: 'Team Test',
      user_status: 'active',
      is_open: true,
    });
    expect(body.lines.map((l) => l.qty)).toEqual([3]);
  });

  it('phiếu thuộc 2026-10 gọi qua /2026-11/ → 404 REQUEST_NOT_FOUND; id không tồn tại → 404', async () => {
    const id = (
      await pool().query<{ id: string }>(
        `INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('2026-10-01', $1, $1) RETURNING id`,
        [A],
      )
    ).rows[0].id;
    for (const path of [
      `/periods/${OPEN}/registrations/${id}`,
      `/periods/${OPEN}/registrations/00000000-0000-4000-8000-000000000000`,
    ]) {
      const res = await get(path).expect(404);
      expect((res.body as { code: string }).code).toBe('REQUEST_NOT_FOUND');
    }
    await get(`/periods/2026-10/registrations/${id}`).expect(200);
  });

  it('member gọi → 403 FORBIDDEN_ROLE ở cả hai route; id không phải uuid → 400', async () => {
    const r = await savedRequestOf(A);
    for (const path of [
      `/periods/${OPEN}/registrations`,
      `/periods/${OPEN}/registrations/${r.id}`,
    ]) {
      const res = await get(path, A, 'member').expect(403);
      expect((res.body as { code: string }).code).toBe('FORBIDDEN_ROLE');
    }
    await get(`/periods/${OPEN}/registrations/khong-phai-uuid`).expect(400);
  });

  it('GET không ghi audit_log (đếm trước/sau bằng nhau)', async () => {
    const r = await savedRequestOf(A);
    const before = await auditCount();
    await list();
    await get(`/periods/${OPEN}/registrations/${r.id}`).expect(200);
    expect(await auditCount()).toBe(before);
  });

  it('PUT admin/requests/:id/lines trên phiếu kỳ mở vẫn 409 PERIOD_NOT_LOCKED (xem được ≠ sửa được)', async () => {
    const r = await savedRequestOf(A);
    const res = await as(
      http().put(`/api/admin/requests/${r.id}/lines`),
      ADMIN,
      'admin',
    )
      .send({
        expected_updated_at: r.updated_at,
        lines: [
          {
            id: r.lines[0].id,
            qty: 1,
            expected_qty: 3,
            reason_code: 'over_quota',
          },
        ],
      })
      .expect(409);
    expect((res.body as { code: string }).code).toBe('PERIOD_NOT_LOCKED');
  });
});
