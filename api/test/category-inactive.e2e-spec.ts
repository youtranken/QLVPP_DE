import type { PoolClient } from 'pg';
import { reviewFixture } from './review.fixture';

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('nhóm món ngừng ẩn món trong nhóm (không sửa items.active)', () => {
  const f = reviewFixture('catoff');
  const { SUFFIX, A, ADMIN, http, as, newItem, save, view, pool } = f;
  const { review, customLine, lineRow } = f;
  let category: string;

  const setCategory = (active: boolean) =>
    pool().query('UPDATE item_categories SET active = $2 WHERE id = $1', [
      category,
      active,
    ]);
  const itemInCategory = async (over: { active?: boolean } = {}) => {
    const id = await newItem({ max_qty: 10, ...over });
    await pool().query('UPDATE items SET category_id = $2 WHERE id = $1', [
      id,
      category,
    ]);
    return id;
  };
  const listIds = async (sub: string, role: string, query = '') =>
    (
      (await as(http().get(`/api/items${query}`), sub, role).expect(200))
        .body as { id: string; active: boolean }[]
    ).map((i) => i.id);
  const activeOf = async (id: string) =>
    (
      await pool().query<{ active: boolean }>(
        'SELECT active FROM items WHERE id = $1',
        [id],
      )
    ).rows[0].active;

  beforeAll(async () => {
    category = (
      await pool().query<{ id: string }>(
        'INSERT INTO item_categories (name) VALUES ($1) RETURNING id',
        [`e2e-catoff-${SUFFIX}`],
      )
    ).rows[0].id;
    f.onCleanup(async (p) => {
      await p.query('DELETE FROM requests WHERE user_sub = $1', [A]);
      await p.query('DELETE FROM items WHERE category_id = $1', [category]);
      await p.query('DELETE FROM item_categories WHERE id = $1', [category]);
    });
  });

  beforeEach(() => setCategory(true));

  it('GET items: member không thấy món của nhóm ngừng, Hành chính vẫn thấy; mở lại nhóm → món tự ngừng vẫn ẩn, items.active không đổi', async () => {
    const on = await itemInCategory();
    const selfOff = await itemInCategory({ active: false });
    expect(await listIds(A, 'member')).toContain(on);
    await setCategory(false);
    expect(await listIds(A, 'member')).not.toContain(on);
    expect(await listIds(ADMIN, 'admin')).toEqual(
      expect.arrayContaining([on, selfOff]),
    );
    expect(await activeOf(on)).toBe(true);
    await setCategory(true);
    const back = await listIds(A, 'member');
    expect(back).toContain(on);
    expect(back).not.toContain(selfOff);
  });

  it('GET items?include_inactive_ids: member vẫn xem lại món nhóm ngừng có trong phiếu', async () => {
    const on = await itemInCategory();
    await setCategory(false);
    const res = await as(
      http().get(`/api/items?include_inactive_ids=${on}`),
      A,
    ).expect(200);
    const found = (res.body as { id: string; active: boolean }[]).find(
      (i) => i.id === on,
    );
    expect(found).toBeDefined();
  });

  it('thêm dòng món nhóm ngừng → 400 ITEM_INACTIVE {line_index}; món không nhóm vẫn 200', async () => {
    const off = await itemInCategory();
    const loose = await newItem();
    await setCategory(false);
    const res = await save([{ item_id: off, qty: 1 }]).expect(400);
    expect(res.body).toMatchObject({ code: 'ITEM_INACTIVE', line_index: 0 });
    await save([{ item_id: loose, qty: 1 }]).expect(200);
  });

  it('dòng cũ của món nhóm vừa ngừng: lưu lại không đổi → 200 (hiện active=false); tăng qty → ITEM_INACTIVE {line_id}', async () => {
    const item = await itemInCategory();
    const first = view(await save([{ item_id: item, qty: 2 }]).expect(200));
    await setCategory(false);
    const line = first.lines[0];
    const kept = view(
      await save([{ id: line.id, item_id: item, qty: 2 }], {
        expected_updated_at: first.updated_at,
      }).expect(200),
    );
    expect(kept.lines[0]).toMatchObject({
      id: line.id,
      qty: 2,
      item: { active: false },
    });
    const up = await save([{ id: line.id, item_id: item, qty: 3 }], {
      expected_updated_at: kept.updated_at,
    }).expect(400);
    expect(up.body).toMatchObject({ code: 'ITEM_INACTIVE', line_id: line.id });
  });

  it('Chép lại danh sách tháng trước: món nhóm ngừng vào skipped lý do INACTIVE', async () => {
    const item = await itemInCategory();
    const name = (
      await pool().query<{ name: string }>(
        'SELECT name FROM items WHERE id = $1',
        [item],
      )
    ).rows[0].name;
    await pool().query(
      `INSERT INTO periods (ym, deadline) VALUES ('2026-10-01', '2026-10-10T17:00:00Z')
       ON CONFLICT (ym) DO UPDATE SET deadline = EXCLUDED.deadline`,
    );
    const { rows } = await pool().query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub)
       VALUES ('2026-10-01', $1, $1) RETURNING id`,
      [A],
    );
    await pool().query(
      'INSERT INTO request_lines (request_id, item_id, qty) VALUES ($1, $2, 1)',
      [rows[0].id, item],
    );
    await setCategory(false);
    const res = await as(
      http().post('/api/me/request/copy-previous'),
      A,
    ).expect(200);
    expect(res.body).toMatchObject({
      lines: [],
      skipped: [{ name, reason: 'INACTIVE' }],
    });
  });

  it('convert vào món có sẵn thuộc nhóm ngừng → 400 ITEM_INACTIVE, dòng vẫn pending', async () => {
    const item = await itemInCategory();
    const { line } = await customLine();
    await setCategory(false);
    const res = await review(line.id, {
      action: 'convert',
      item: { existing_id: item },
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ITEM_INACTIVE');
    expect((await lineRow(line.id)).review_status).toBe('pending');
  });

  it('lưu dòng món trong nhóm khi tx ngừng nhóm chưa commit → chờ rồi 400 ITEM_INACTIVE, không lọt dòng', async () => {
    const item = await itemInCategory();
    const client: PoolClient = await pool().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE item_categories SET active = false WHERE id = $1',
        [category],
      );
      const pending = Promise.resolve(save([{ item_id: item, qty: 1 }]));
      await pause(300);
      await client.query('COMMIT');
      const res = await pending;
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'ITEM_INACTIVE', line_index: 0 });
    } finally {
      client.release();
    }
  });

  it('ngừng nhóm và lưu phiếu cùng lúc (Promise.all) → 200 hoặc ITEM_INACTIVE; không 500', async () => {
    const item = await itemInCategory();
    const [saved, off] = await Promise.all([
      save([{ item_id: item, qty: 1 }]),
      as(http().patch(`/api/admin/item-categories/${category}`), ADMIN, 'admin')
        .send({ active: false })
        .then((r) => r),
    ]);
    expect(off.status).toBe(200);
    expect([200, 400]).toContain(saved.status);
    if (saved.status === 400) {
      expect(saved.body).toMatchObject({ code: 'ITEM_INACTIVE' });
    }
    expect(await activeOf(item)).toBe(true);
  });
});
