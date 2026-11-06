import {
  AFTER_DEADLINE,
  BEFORE_DEADLINE,
  meRequestFixture,
} from './me-request.fixture';
import type { Line, RequestView } from './me-request.fixture';

export interface ReviewRow {
  line_id: string;
  request_id: string;
  period_ym: string;
  user_sub: string;
  full_name: string | null;
  custom_name: string | null;
  review_status: string;
  previously_accepted: boolean;
}

// Fixture chung cho các suite review: người Hành chính, nhóm món thử, dọn phiếu/món/kỳ 10
export function reviewFixture(tag: string) {
  const f = meRequestFixture(tag);
  const { A, B, ADMIN, SUFFIX, http, as, upload, save, view, pool, at } = f;
  const NEW_PREFIX = `e2e-req-item-${SUFFIX}-new`;
  let category: string;
  // Hình `item` trong response review: giống nhau cho món có sẵn và món mới
  const itemShape = {
    id: 0,
    name: 0,
    name_en: 0,
    unit: 0,
    pack_note: 0,
    image_file_id: 0,
    active: 0,
    admin_only: 0,
    max_qty: 0,
  };

  const review = (lineId: string, body: object, role = 'admin') =>
    as(http().post(`/api/admin/lines/${lineId}/review`), ADMIN, role).send(
      body,
    );
  const list = async (query: string) =>
    (
      (
        await as(
          http().get(`/api/admin/review?${query}`),
          ADMIN,
          'admin',
        ).expect(200)
      ).body as { items: ReviewRow[] }
    ).items;
  const seed = async (lines: Line[], sub = A) =>
    view(await save(lines, {}, sub).expect(200));
  // Nhân viên lưu trong kỳ mở rồi qua giờ khóa sổ: Hành chính chỉ xem/duyệt dòng kỳ đã khóa
  const customLine = async (sub = A, name = 'Bìa còng đặc biệt') => {
    at(BEFORE_DEADLINE);
    const img = await upload(sub);
    const r = await seed(
      [{ custom_name: name, custom_unit: 'cai', image_file_id: img, qty: 2 }],
      sub,
    );
    at(AFTER_DEADLINE);
    return { request: r, line: r.lines[0], img };
  };
  const newItemBody = (over: object = {}) => ({
    name: `${NEW_PREFIX}-${Math.random().toString(36).slice(2, 8)}`,
    unit: 'hop',
    category_id: category,
    ...over,
  });
  const getMine = async () =>
    (await as(http().get('/api/me/request?ym=2026-11'), A).expect(200))
      .body as RequestView;
  const lineRow = async (id: string) =>
    (
      await pool().query<Record<string, unknown>>(
        'SELECT * FROM request_lines WHERE id = $1',
        [id],
      )
    ).rows[0];

  beforeAll(async () => {
    await pool().query(
      `INSERT INTO users (sub, full_name, department, status)
       VALUES ($1, 'Hành chính', 'Phòng HC', 'active')`,
      [ADMIN],
    );
    category = (
      await pool().query<{ id: string }>(
        'INSERT INTO item_categories (name) VALUES ($1) RETURNING id',
        [`e2e-review-cat-${SUFFIX}`],
      )
    ).rows[0].id;
  });

  f.onCleanup(async (p) => {
    await p.query('DELETE FROM requests WHERE user_sub = ANY($1)', [[A, B]]);
    await p.query('DELETE FROM items WHERE name LIKE $1', [`${NEW_PREFIX}-%`]);
    await p.query('DELETE FROM item_categories WHERE id = $1', [category]);
    await p.query(
      "DELETE FROM periods WHERE ym = '2026-10-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '2026-10-01')",
    );
  });

  return {
    ...f,
    NEW_PREFIX,
    itemShape,
    review,
    list,
    seed,
    customLine,
    newItemBody,
    getMine,
    lineRow,
  };
}
