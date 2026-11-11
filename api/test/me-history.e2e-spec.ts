import { meRequestFixture } from './me-request.fixture';

interface HistoryItem {
  period_ym: string;
  line_count: number;
  total_qty: number;
  delivered_qty: number;
  remaining_qty: number;
  cancelled_qty: number;
  owed_line_count: number;
  removed_all: boolean;
  custom: Record<string, number>;
  catalog: Record<string, number>;
}
interface HistoryPage {
  items: HistoryItem[];
  next_cursor: string | null;
}
interface SeedLine {
  item_id?: string;
  custom_name?: string;
  image_file_id?: string;
  qty: number;
  delivered_qty?: number;
  cancelled_qty?: number;
  review_status?: string;
  added_by_admin?: boolean;
}

describe('me/request/copy-previous và me/requests (lịch sử)', () => {
  const {
    A,
    B,
    ADMIN,
    http,
    as,
    upload,
    newItem,
    save,
    view,
    requestsOf,
    pool,
    imgA,
  } = meRequestFixture('history');

  beforeAll(async () => {
    // Kỳ quá khứ đã khóa; ghi đè hạn chuẩn để kỳ đang mở vẫn là 2026-11
    await pool().query(
      `INSERT INTO periods (ym, deadline) VALUES
         ('2026-09-01', '2026-09-10T17:00:00Z'), ('2026-10-01', '2026-10-10T17:00:00Z')
       ON CONFLICT (ym) DO UPDATE SET deadline = EXCLUDED.deadline`,
    );
  });

  // Phiếu kỳ cũ dựng bằng SQL: API chỉ ghi được kỳ đang mở, trạng thái review/giao do Plan sau
  const seed = async (sub: string, ym: string, lines: SeedLine[]) => {
    const { rows } = await pool().query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub)
       VALUES ($1::date, $2, $2) RETURNING id`,
      [`${ym}-01`, sub],
    );
    for (const l of lines) {
      await pool().query(
        `INSERT INTO request_lines (request_id, item_id, custom_name, custom_unit, image_file_id,
                                    qty, delivered_qty, cancelled_qty, review_status, added_by_admin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          rows[0].id,
          l.item_id ?? null,
          l.custom_name ?? null,
          l.custom_name ? 'cai' : null,
          l.image_file_id ?? null,
          l.qty,
          l.delivered_qty ?? 0,
          l.cancelled_qty ?? 0,
          l.review_status ?? (l.item_id ? 'n/a' : 'pending'),
          l.added_by_admin ?? false,
        ],
      );
    }
    return rows[0].id;
  };
  const copy = (sub = A) =>
    as(http().post('/api/me/request/copy-previous'), sub).send({});
  const history = (query = '', sub = A) =>
    as(http().get(`/api/me/requests${query}`), sub);

  describe('copy-previous', () => {
    it('chưa có phiếu kỳ trước (chỉ có kỳ đang mở) → 404 REQUEST_NOT_FOUND', async () => {
      await save([{ item_id: await newItem(), qty: 1 }]).expect(200);
      const res = await copy().expect(404);
      expect(res.body).toMatchObject({ code: 'REQUEST_NOT_FOUND' });
    });

    it('có phiếu kỳ 09 và 10, không kỳ 11 → từ 2026-10, không tạo phiếu, lưu lại được', async () => {
      const [x, off, capped] = [
        await newItem(),
        await newItem(),
        await newItem({ max_qty: 10 }),
      ];
      await seed(A, '2026-09', [{ item_id: x, qty: 1 }]);
      await seed(A, '2026-10', [
        { item_id: x, qty: 3, delivered_qty: 3 },
        { item_id: off, qty: 1 },
        { item_id: capped, qty: 10 },
        {
          custom_name: 'Bìa còng xanh',
          image_file_id: imgA(),
          qty: 2,
          review_status: 'accepted',
        },
        {
          custom_name: 'Ghim lạ',
          image_file_id: imgA(),
          qty: 1,
          review_status: 'rejected',
        },
        { item_id: await newItem(), qty: 1, added_by_admin: true },
      ]);
      // Hành chính đổi danh mục sau kỳ 10
      await pool().query('UPDATE items SET active = false WHERE id = $1', [
        off,
      ]);
      await pool().query('UPDATE items SET max_qty = 5 WHERE id = $1', [
        capped,
      ]);
      const footprint = async () =>
        (
          await pool().query<{ r: number; l: number; a: number }>(
            `SELECT (SELECT count(*)::int FROM requests WHERE user_sub = $1) AS r,
                    (SELECT count(*)::int FROM request_lines l JOIN requests q ON q.id = l.request_id
                      WHERE q.user_sub = $1) AS l,
                    (SELECT count(*)::int FROM audit_log WHERE actor = $1) AS a`,
            [A],
          )
        ).rows[0];
      const before = await footprint();

      const res = await copy().expect(200);
      const body = res.body as {
        from_ym: string;
        lines: Record<string, unknown>[];
        skipped: { reason: string }[];
        capped: { from: number; to: number }[];
        previously_accepted: string[];
      };
      expect(body.from_ym).toBe('2026-10');
      expect(body.lines).toEqual([
        { item_id: x, qty: 3 },
        { item_id: capped, qty: 5 },
        {
          custom_name: 'Bìa còng xanh',
          custom_unit: 'cai',
          custom_note: null,
          image_file_id: imgA(),
          qty: 2,
        },
      ]);
      expect(body.skipped.map((s) => s.reason)).toEqual([
        'INACTIVE',
        'REJECTED',
        'ADDED_BY_ADMIN',
      ]);
      expect(body.capped).toMatchObject([{ from: 10, to: 5 }]);
      expect(body.previously_accepted).toEqual(['Bìa còng xanh']);
      expect(await footprint()).toEqual(before);

      // Giỏ đề xuất phải lưu được nguyên trạng (ảnh cũ cùng chủ, qty đã hạ)
      const saved = view(await save(body.lines).expect(200));
      expect(saved.lines.map((l) => l.review_status)).toEqual([
        'n/a',
        'n/a',
        'pending',
      ]);
    });

    it('ảnh dòng do Hành chính thay (admin tải) → A chép rồi lưu nguyên giỏ 200; B dùng ảnh đó → FILE_FORBIDDEN', async () => {
      const adminImg = await upload(ADMIN, 'line_image', 'admin');
      await seed(A, '2026-10', [
        { custom_name: 'Bìa admin sửa', image_file_id: adminImg, qty: 1 },
      ]);
      const body = (await copy().expect(200)).body as {
        lines: Record<string, unknown>[];
      };
      expect(body.lines).toMatchObject([{ image_file_id: adminImg }]);
      await save(body.lines).expect(200);

      const res = await save(
        [
          {
            custom_name: 'Lấy ảnh',
            custom_unit: 'cai',
            image_file_id: adminImg,
            qty: 1,
          },
        ],
        {},
        B,
      ).expect(403);
      expect(res.body).toMatchObject({ code: 'FILE_FORBIDDEN', line_index: 0 });
      expect(await requestsOf(B)).toHaveLength(0);
    });

    it('người khác có phiếu kỳ trước không ảnh hưởng: B vẫn 404', async () => {
      await seed(A, '2026-10', [{ item_id: await newItem(), qty: 1 }]);
      await copy(A).expect(200);
      await copy(B).expect(404);
    });
  });

  describe('lịch sử', () => {
    it('mới nhất trước, tổng đúng, đếm dòng ngoài DM theo trạng thái; B không thấy của A', async () => {
      const [x, y] = [
        await newItem({ max_qty: 20 }),
        await newItem({ max_qty: 20 }),
      ];
      await seed(A, '2026-09', [{ item_id: x, qty: 2, delivered_qty: 2 }]);
      await seed(A, '2026-10', [
        { item_id: x, qty: 10, delivered_qty: 4, cancelled_qty: 1 },
        { item_id: y, qty: 3, review_status: 'converted' },
        {
          custom_name: 'Bìa',
          image_file_id: imgA(),
          qty: 2,
          review_status: 'accepted',
          delivered_qty: 2,
        },
        {
          custom_name: 'Kẹp',
          image_file_id: imgA(),
          qty: 5,
          review_status: 'pending',
        },
        {
          custom_name: 'Ghim',
          image_file_id: imgA(),
          qty: 7,
          review_status: 'rejected',
        },
      ]);

      const page = (await history().expect(200)).body as HistoryPage;
      expect(page.next_cursor).toBeNull();
      expect(page.items).toEqual([
        {
          period_ym: '2026-10',
          line_count: 5,
          // chỉ dòng hiệu lực (n/a, accepted, converted): 10 + 3 + 2; pending/rejected nằm ở custom
          total_qty: 15,
          delivered_qty: 6,
          cancelled_qty: 1,
          remaining_qty: 8,
          // dòng hiệu lực còn chờ: x (10−4−1) và y (3); Bìa đã giao đủ, Kẹp/Ghim không tính
          owed_line_count: 2,
          removed_all: false,
          custom: { pending: 1, accepted: 1, converted: 1, rejected: 1 },
          // chỉ món trong DM từ đầu (x): y đã "converted" và Bìa "accepted" vẫn là món ngoài DM
          catalog: {
            line_count: 1,
            qty: 10,
            delivered_qty: 4,
            remaining_qty: 5,
            owed_line_count: 1,
          },
        },
        {
          period_ym: '2026-09',
          line_count: 1,
          total_qty: 2,
          delivered_qty: 2,
          cancelled_qty: 0,
          remaining_qty: 0,
          owed_line_count: 0,
          removed_all: false,
          custom: { pending: 0, accepted: 0, converted: 0, rejected: 0 },
          catalog: {
            line_count: 1,
            qty: 2,
            delivered_qty: 2,
            remaining_qty: 0,
            owed_line_count: 0,
          },
        },
      ]);

      for (const i of page.items) {
        expect(i.total_qty).toBe(
          i.delivered_qty + i.cancelled_qty + i.remaining_qty,
        );
      }

      const other = (await history('', B).expect(200)).body as HistoryPage;
      expect(other).toEqual({ items: [], next_cursor: null });
    });

    it('phân trang keyset: limit=1 → 2 trang; cursor hỏng → 400 VALIDATION; limit 0 và 201 → 400, 200 → 200', async () => {
      const x = await newItem();
      await seed(A, '2026-09', [{ item_id: x, qty: 1 }]);
      await seed(A, '2026-10', [{ item_id: x, qty: 1 }]);
      const p1 = (await history('?limit=1').expect(200)).body as HistoryPage;
      expect(p1.items.map((i) => i.period_ym)).toEqual(['2026-10']);
      expect(p1.next_cursor).toEqual(expect.any(String));
      const p2 = (
        await history(`?limit=1&cursor=${p1.next_cursor}`).expect(200)
      ).body as HistoryPage;
      expect(p2.items.map((i) => i.period_ym)).toEqual(['2026-09']);
      expect(p2.next_cursor).toBeNull();

      const bad = await history('?cursor=abc').expect(400);
      expect(bad.body).toMatchObject({ code: 'VALIDATION' });
      for (const limit of [0, 201]) {
        const res = await history(`?limit=${limit}`).expect(400);
        expect(res.body).toMatchObject({
          code: 'VALIDATION',
          fields: ['limit'],
        });
      }
      const all = (await history('?limit=200').expect(200)).body as HistoryPage;
      expect(all.items).toHaveLength(2);
      expect(all.next_cursor).toBeNull();
    });
  });

  it('A gửi id dòng thật của B trong PUT me/request/lines → 400 LINE_NOT_FOUND, dòng của B không đổi', async () => {
    const x = await newItem();
    const vb = view(await save([{ item_id: x, qty: 2 }], {}, B).expect(200));
    const res = await save([{ id: vb.lines[0].id, item_id: x, qty: 4 }]).expect(
      400,
    );
    expect(res.body).toMatchObject({ code: 'LINE_NOT_FOUND', line_index: 0 });
    const { rows } = await pool().query<{ qty: number; request_id: string }>(
      'SELECT qty, request_id FROM request_lines WHERE id = $1',
      [vb.lines[0].id],
    );
    expect(rows).toEqual([{ qty: 2, request_id: vb.id }]);
  });

  it('Hành chính GET me/requests → 403 FORBIDDEN_ROLE; member → 200', async () => {
    const res = await history('', ADMIN).set('x-dev-role', 'admin').expect(403);
    expect(res.body).toMatchObject({ code: 'FORBIDDEN_ROLE' });
    await history().expect(200);
  });
});
