import { meRequestFixture } from './me-request.fixture';

describe('GET /items: thứ tự theo nhóm rồi theo món', () => {
  const f = meRequestFixture('order');
  const { SUFFIX, A, ADMIN, http, as, newItem, pool } = f;
  const categories: string[] = [];

  const newCategory = async (sortOrder: number, tag: string, label = '') => {
    const id = (
      await pool().query<{ id: string }>(
        'INSERT INTO item_categories (name, sort_order) VALUES ($1, $2) RETURNING id',
        [`e2e-order-${SUFFIX}-${tag}-${sortOrder}${label}`, sortOrder],
      )
    ).rows[0].id;
    categories.push(id);
    return id;
  };
  const placeItem = async (categoryId: string | null, sortOrder: number) => {
    const id = await newItem();
    await pool().query(
      'UPDATE items SET category_id = $2, sort_order = $3 WHERE id = $1',
      [id, categoryId, sortOrder],
    );
    return id;
  };
  const positionsOf = async (ids: string[], sub: string, role: string) => {
    const path = role === 'member' ? '/api/items' : '/api/admin/items';
    const all = (
      (await as(http().get(path), sub, role).expect(200)).body as {
        id: string;
      }[]
    ).map((i) => i.id);
    return ids.map((id) => all.indexOf(id));
  };

  beforeAll(() => {
    f.onCleanup(async (p) => {
      await p.query('DELETE FROM items WHERE category_id = ANY($1)', [
        categories,
      ]);
      await p.query('DELETE FROM item_categories WHERE id = ANY($1)', [
        categories,
      ]);
    });
  });

  it.each([
    ['member', A],
    ['admin', ADMIN],
  ])(
    '%s: món sort 11 nhóm sort 10 đứng trước món sort 0 nhóm sort 20; món không nhóm (sort -5) đứng cuối',
    async (role, sub) => {
      const early = await newCategory(10, role);
      const late = await newCategory(20, role);
      const lateLow = await placeItem(late, 0);
      const earlyHigh = await placeItem(early, 11);
      const earlyLow = await placeItem(early, 5);
      const loose = await placeItem(null, -5);

      const [pEarlyLow, pEarlyHigh, pLateLow, pLoose] = await positionsOf(
        [earlyLow, earlyHigh, lateLow, loose],
        sub,
        role,
      );

      expect(pEarlyLow).toBeGreaterThanOrEqual(0);
      expect(pEarlyLow).toBeLessThan(pEarlyHigh);
      expect(pEarlyHigh).toBeLessThan(pLateLow);
      expect(pLateLow).toBeLessThan(pLoose);
    },
  );

  it('hai nhóm cùng sort_order 15 → xếp theo tên nhóm theo mã điểm (c.name): món sort 9 nhóm "…B" trước món sort 0 nhóm "…a"', async () => {
    const groupA = await newCategory(15, 'tie', '-ax');
    const groupB = await newCategory(15, 'tie', '-Bx');
    const inA = await placeItem(groupA, 0);
    const inB = await placeItem(groupB, 9);

    const [pB, pA] = await positionsOf([inB, inA], A, 'member');

    expect(pB).toBeGreaterThanOrEqual(0);
    expect(pB).toBeLessThan(pA);
  });
});
