import { meRequestFixture } from './me-request.fixture';

type AdminRow = { id: string; active: boolean; inactive_reason: unknown };

describe('ngừng nhóm/ngừng riêng: inactive_reason, bật lại nhóm chỉ trả món ngừng do nhóm', () => {
  const f = meRequestFixture('inrsn');
  const { SUFFIX, A, ADMIN, http, as, newItem, pool } = f;
  let category: string;

  const inCategory = async (over: { active?: boolean } = {}) => {
    const id = await newItem(over);
    await pool().query('UPDATE items SET category_id = $2 WHERE id = $1', [
      id,
      category,
    ]);
    return id;
  };
  const patchGroup = (active: boolean) =>
    as(
      http().patch(`/api/admin/item-categories/${category}`),
      ADMIN,
      'admin',
    ).send({ active });
  const memberIds = async () =>
    (
      (await as(http().get('/api/items'), A).expect(200)).body as {
        id: string;
      }[]
    ).map((i) => i.id);
  const adminRows = async () =>
    new Map(
      (
        (await as(http().get('/api/admin/items'), ADMIN, 'admin').expect(200))
          .body as AdminRow[]
      ).map((r) => [r.id, r]),
    );
  const activeFlags = async (ids: string[]) =>
    (
      await pool().query<{ active: boolean }>(
        'SELECT active FROM items WHERE id = ANY($1) ORDER BY id',
        [ids],
      )
    ).rows.map((r) => r.active);
  // id là uuid ngẫu nhiên, đồng hồ có thể đứng yên: chọn audit theo loại đếm thay vì "mới nhất"
  const auditWith = async (count: 'deactivated' | 'reactivated') =>
    (
      await pool().query<{ detail: Record<string, unknown> }>(
        `SELECT detail FROM audit_log WHERE action = 'category.updated' AND object_id = $1
           AND detail->'affected_items' ? $2
         LIMIT 1`,
        [category, count],
      )
    ).rows[0]?.detail;

  beforeEach(async () => {
    category = (
      await pool().query<{ id: string }>(
        'INSERT INTO item_categories (name) VALUES ($1) RETURNING id',
        [`e2e-inrsn-${SUFFIX}-${Math.random().toString(36).slice(2, 8)}`],
      )
    ).rows[0].id;
  });

  f.onCleanup(async (p) => {
    await p.query('DELETE FROM items WHERE name LIKE $1', [
      `e2e-req-item-${SUFFIX}-%`,
    ]);
    await p.query('DELETE FROM item_categories WHERE name LIKE $1', [
      `e2e-inrsn-${SUFFIX}-%`,
    ]);
  });

  it("GET /admin/items inactive_reason: ngừng riêng trong nhóm ngừng → 'item'; dùng trong nhóm ngừng → 'group'; dùng → null", async () => {
    const own = await inCategory({ active: false });
    const viaGroup = await inCategory();
    const loose = await newItem();
    const looseOff = await newItem({ active: false });
    await patchGroup(false).expect(200);
    const rows = await adminRows();
    expect(rows.get(own)?.inactive_reason).toBe('item');
    expect(rows.get(viaGroup)?.inactive_reason).toBe('group');
    expect(rows.get(loose)?.inactive_reason).toBeNull();
    expect(rows.get(looseOff)?.inactive_reason).toBe('item');
    await patchGroup(true).expect(200);
    expect((await adminRows()).get(viaGroup)?.inactive_reason).toBeNull();
  });

  it('A ngừng riêng + 4 món; ngừng nhóm → nhân viên không thấy 5; bật lại → thấy 4 không có A, trả {reactivated 4, still_inactive 1}; items.active không đổi', async () => {
    const a = await inCategory({ active: false });
    const four = [
      await inCategory(),
      await inCategory(),
      await inCategory(),
      await inCategory(),
    ];
    const all = [a, ...four];
    const before = await activeFlags(all);

    const off = await patchGroup(false).expect(200);
    expect(off.body).toMatchObject({ id: category, active: false });
    expect(off.body).not.toHaveProperty('affected_items');
    const hidden = await memberIds();
    for (const id of all) expect(hidden).not.toContain(id);
    expect(await activeFlags(all)).toEqual(before);
    expect(await auditWith('deactivated')).toMatchObject({
      affected_items: { deactivated: 4, still_inactive: 1 },
    });

    const on = await patchGroup(true).expect(200);
    expect(on.body).toMatchObject({
      active: true,
      affected_items: { reactivated: 4, still_inactive: 1 },
    });
    const back = await memberIds();
    for (const id of four) expect(back).toContain(id);
    expect(back).not.toContain(a);
    expect(await activeFlags(all)).toEqual(before);
    expect(await auditWith('reactivated')).toMatchObject({
      affected_items: { reactivated: 4, still_inactive: 1 },
    });
  });

  it('PATCH active=true khi nhóm đang dùng, hoặc chỉ đổi tên → không có affected_items', async () => {
    await inCategory();
    const same = await patchGroup(true).expect(200);
    expect(same.body).not.toHaveProperty('affected_items');
    const renamed = await as(
      http().patch(`/api/admin/item-categories/${category}`),
      ADMIN,
      'admin',
    )
      .send({ name: `e2e-inrsn-${SUFFIX}-ren` })
      .expect(200);
    expect(renamed.body).not.toHaveProperty('affected_items');
  });

  it('nhóm rỗng: ngừng rồi bật lại → {reactivated 0, still_inactive 0}', async () => {
    await patchGroup(false).expect(200);
    const on = await patchGroup(true).expect(200);
    expect(on.body.affected_items).toEqual({
      reactivated: 0,
      still_inactive: 0,
    });
  });
});
