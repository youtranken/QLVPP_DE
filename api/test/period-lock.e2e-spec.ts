import { AFTER_DEADLINE, BEFORE_DEADLINE } from './me-request.fixture';
import { remindersFixture } from './reminders.fixture';
import { reviewFixture } from './review.fixture';

describe('chuông period_locked: số đăng ký từ S, custom_pending, kỳ 0 phiếu vẫn gửi', () => {
  const f = remindersFixture('plock');
  const [U1, U2, U3, ADMIN] = ['u1', 'u2', 'u3', 'admin'].map(f.sub);
  let img = '';

  beforeAll(async () => {
    for (const u of [U1, U2, U3]) await f.addUser(u);
    await f.addUser(ADMIN, 'admin');
    img = (
      await f.q<{ id: string }>(
        `INSERT INTO files (original_name, mime, size_bytes, purpose, uploaded_by_sub)
         VALUES ('a.png', 'image/png', 1, 'line_image', $1) RETURNING id`,
        [U1],
      )
    ).rows[0].id;
    f.onCleanup(async () => {
      await f.q('DELETE FROM requests WHERE user_sub = $1', [U1]);
      await f.q('DELETE FROM files WHERE id = $1', [img]);
    });
  });

  it('kỳ 2026-12 không có phiếu nào → vẫn 1 chuông 0/3, custom_pending 0, link Tổng hợp', async () => {
    await f.run('2026-12-10T17:00:00.000Z');
    const notes = await f.notes('period_locked:2026-12');
    expect(notes.map((n) => n.user_sub)).toEqual([ADMIN]);
    expect(notes[0]).toMatchObject({
      params: {
        ym: '2026-12',
        registered: 0,
        headcount: 3,
        custom_pending: 0,
      },
      link: '/admin/month?ym=2026-12',
    });
  });

  it('kỳ 2027-01 có 2 dòng ngoài DM chờ xem → custom_pending 2, link Món ngoài DM của kỳ', async () => {
    const { rows } = await f.q<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('2027-01-01', $1, $1) RETURNING id`,
      [U1],
    );
    for (const name of ['Kẹp A', 'Kẹp B']) {
      await f.q(
        `INSERT INTO request_lines (request_id, custom_name, custom_unit, image_file_id, qty, review_status)
         VALUES ($1, $2, 'cai', $3, 1, 'pending')`,
        [rows[0].id, name, img],
      );
    }
    await f.run('2027-01-10T16:59:59.999Z');
    expect(await f.notes('period_locked:2027-01')).toEqual([]);
    await f.run('2027-01-10T17:00:00.000Z');
    expect((await f.notes('period_locked:2027-01'))[0]).toMatchObject({
      params: {
        ym: '2027-01',
        registered: 1,
        headcount: 3,
        custom_pending: 2,
      },
      link: '/admin/review?ym=2027-01',
    });
  });
});

describe('khóa sổ ở API: kỳ mở chỉ tiến độ, nhân viên chỉ đọc sau khóa, qua năm', () => {
  const f = reviewFixture('plock-api');
  const { A, ADMIN, as, at, freeze, http, newItem, pool, seed, upload } = f;
  const adminGet = (path: string) =>
    as(http().get(`/api/admin${path}`), ADMIN, 'admin');

  it('kỳ mở: summary trả số đếm, trường dòng null; unregistered mỗi người đúng 4 trường', async () => {
    await seed([{ item_id: await newItem(), qty: 1 }]);
    const s = (await adminGet('/periods/2026-11/summary').expect(200))
      .body as Record<string, unknown>;
    expect(s).toMatchObject({
      is_open: true,
      lines_pending_delivery: null,
      custom_pending: null,
    });
    for (const k of ['registered', 'headcount', 'unregistered'])
      expect(typeof s[k]).toBe('number');
    expect(s.registered).toBeGreaterThanOrEqual(1);
    const people = (await adminGet('/periods/2026-11/unregistered').expect(200))
      .body as { items: object[] };
    for (const p of people.items)
      expect(Object.keys(p).sort()).toEqual([
        'department',
        'email',
        'full_name',
        'sub',
      ]);
    at(AFTER_DEADLINE);
    const locked = (await adminGet('/periods/2026-11/summary').expect(200))
      .body as Record<string, unknown>;
    expect(typeof locked.lines_pending_delivery).toBe('number');
  });

  it('nhân viên lưu dòng ngoài DM kỳ mở → 0 chuông custom_line_new cho Hành chính', async () => {
    const img = await upload(A);
    const r = await seed([
      { custom_name: 'Kẹp lạ', custom_unit: 'cai', image_file_id: img, qty: 1 },
    ]);
    const { rows } = await pool().query(
      'SELECT 1 FROM in_app_notifications WHERE event_id = $1',
      [`custom_line_new:${r.lines[0].id}`],
    );
    expect(rows).toHaveLength(0);
  });

  it('sau khóa: nhân viên PUT → 409 PERIOD_LOCKED; Hành chính PUT có lý do → 200', async () => {
    const item = await newItem();
    const r = await seed([{ item_id: item, qty: 2 }]);
    at(AFTER_DEADLINE);
    await as(http().put('/api/me/request/lines'), A)
      .send({
        ym: '2026-11',
        lines: [{ item_id: item, qty: 1 }],
        expected_updated_at: r.updated_at,
      })
      .expect(409, /PERIOD_LOCKED/);
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

  it('qua năm với hạn ngày 5: 2026-12 mở tới 16:59:59.999Z 05/12, khóa 17:00:00.000Z; 2027-01 cùng luật', async () => {
    const saved = (
      await pool().query<{ deadline: Date }>(
        "SELECT deadline FROM periods WHERE ym = '2027-01-01'",
      )
    ).rows[0]?.deadline;
    await pool().query(
      "UPDATE periods SET deadline = '2026-12-05T17:00:00Z' WHERE ym = '2026-12-01'",
    );
    await pool().query(
      `INSERT INTO periods (ym, deadline) VALUES ('2027-01-01', '2027-01-05T17:00:00Z')
       ON CONFLICT (ym) DO UPDATE SET deadline = EXCLUDED.deadline`,
    );
    try {
      for (const ym of ['2026-12', '2027-01']) {
        const [y, m] = ym.split('-');
        freeze(`${y}-${m}-05T16:59:59.999Z`);
        await adminGet(`/periods/${ym}/requests`).expect(
          409,
          /PERIOD_NOT_LOCKED/,
        );
        freeze(`${y}-${m}-05T17:00:00.000Z`);
        await adminGet(`/periods/${ym}/requests`).expect(200);
      }
    } finally {
      await pool().query(
        "UPDATE periods SET deadline = '2026-12-10T17:00:00Z' WHERE ym = '2026-12-01'",
      );
      if (saved)
        await pool().query(
          "UPDATE periods SET deadline = $1 WHERE ym = '2027-01-01'",
          [saved],
        );
      await pool().query(
        "DELETE FROM periods p WHERE p.ym > '2026-12-01' AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.period_ym = p.ym)",
      );
    }
  });

  it('Nhật ký vai admin: phân trang limit=1 không trả request.created kỳ mở, hai trang không lặp', async () => {
    const r = await seed([{ item_id: await newItem(), qty: 1 }]);
    at(BEFORE_DEADLINE);
    const p1 = (
      await adminGet('/audit?action=request.created&limit=1').expect(200)
    ).body as {
      items: { id: string; objectId: string }[];
      next_cursor: string | null;
    };
    const ids = p1.items.map((i) => i.objectId);
    if (p1.next_cursor) {
      const p2 = (
        await adminGet(
          `/audit?action=request.created&limit=1&cursor=${encodeURIComponent(p1.next_cursor)}`,
        ).expect(200)
      ).body as typeof p1;
      expect(p2.items[0]?.id).not.toBe(p1.items[0]?.id);
      ids.push(...p2.items.map((i) => i.objectId));
    }
    expect(ids).not.toContain(r.id);
  });
});
