import { snapshotsFixture } from './report-snapshots.fixture';

describe('Bản chốt cho phiếu đề xuất D&E: mã, tên ĐVT, ô ký, thứ tự nhóm (E9-S4)', () => {
  const f = snapshotsFixture('snapform');
  const { createOk, freeze, itemRow, lockedLine, snapshot, SUFFIX } = f;
  const categories: string[] = [];

  f.onCleanup(async (p) => {
    await p.query(
      'UPDATE items SET category_id = NULL WHERE category_id = ANY($1)',
      [categories],
    );
    await p.query('DELETE FROM item_categories WHERE id = ANY($1)', [
      categories,
    ]);
  });

  beforeEach(() => freeze('2026-11-12T03:00:00Z'));

  const newCategory = async (sortOrder: number) => {
    const { rows } = await f
      .pool()
      .query<{ id: string }>(
        'INSERT INTO item_categories (name, sort_order) VALUES ($1, $2) RETURNING id',
        [`e2e-cat-${SUFFIX}-${sortOrder}`, sortOrder],
      );
    categories.push(rows[0].id);
    return rows[0].id;
  };

  it('bản chốt mới lưu code, unit_name/unit_name_en mỗi hàng và signature_boxes; đổi tên/mã món sau chốt → GET bản chốt không đổi', async () => {
    const { item } = await lockedLine(4, 5);
    const code = `E${SUFFIX.slice(-6)}`;
    await f
      .pool()
      .query("UPDATE items SET code = $2, name_en = 'Pen' WHERE id = $1", [
        item,
        code,
      ]);
    const { id } = await createOk('2026-11', { kind: 'print' });
    const before = await snapshot(id);
    const row = itemRow(before, item);
    expect(row).toMatchObject({
      code,
      name_en: 'Pen',
      unit: 'cay',
      unit_name: 'cây',
      unit_name_en: 'stick',
    });
    expect(Array.isArray(before.signature_boxes)).toBe(true);
    expect(before.signature_boxes!.length).toBeGreaterThanOrEqual(1);

    await f
      .pool()
      .query(
        "UPDATE items SET name = name || '-moi', name_en = 'New pen', code = $2 WHERE id = $1",
        [item, `${code}X`],
      );
    expect(await snapshot(id)).toEqual(before);
    expect(itemRow(await f.build('2026-11'), item)).toMatchObject({
      code: `${code}X`,
      name_en: 'New pen',
    });
  });

  it('món không có mã → code null trong bản chốt', async () => {
    const { item } = await lockedLine(4, 5);
    const { id } = await createOk('2026-11');
    expect(itemRow(await snapshot(id), item)?.code).toBeNull();
  });

  it('hàng món sắp theo sort_order nhóm → sort_order món: món nhóm 1 (sort món 9) đứng trước món nhóm 2 (sort món 0)', async () => {
    const [first, second] = [await newCategory(1), await newCategory(2)];
    const a = await lockedLine(4, 5);
    const b = await lockedLine(4, 5, f.B);
    await f
      .pool()
      .query(
        'UPDATE items SET category_id = $2, sort_order = $3 WHERE id = $1',
        [a.item, second, 0],
      );
    await f
      .pool()
      .query(
        'UPDATE items SET category_id = $2, sort_order = $3 WHERE id = $1',
        [b.item, first, 9],
      );
    const { id } = await createOk('2026-11');
    const keys = (await snapshot(id)).byItem.map((r) => r.key);
    expect(keys.indexOf(b.item)).toBeLessThan(keys.indexOf(a.item));
  });
});
