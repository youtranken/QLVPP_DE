import type { PoolClient } from 'pg';
import { meRequestFixture } from './me-request.fixture';

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('ĐVT bị ngừng giữa chừng: tạo món / lưu dòng ngoài DM không lọt ĐVT đã ngừng', () => {
  const { SUFFIX, A, ADMIN, http, as, save, upload, pool, onCleanup } =
    meRequestFixture('urace');
  const UNIT = `race-${SUFFIX}`.slice(0, 32);
  const ITEM = `e2e-req-item-${SUFFIX}-race`;
  let image: string;

  const createItem = (name: string) =>
    as(http().post('/api/admin/items'), ADMIN, 'admin').send({
      name,
      unit: UNIT,
      image_file_id: image,
    });
  const deactivate = () =>
    as(http().patch(`/api/admin/units/${UNIT}`), ADMIN, 'admin').send({
      active: false,
    });
  const itemsOnUnit = async () =>
    (
      await pool().query<{ n: number }>(
        'SELECT count(*)::int AS n FROM items WHERE unit = $1',
        [UNIT],
      )
    ).rows[0].n;

  // Tx ngừng ĐVT đang mở (chưa commit) trong lúc request chạy, commit sau
  const whileDeactivating = async <T>(run: () => PromiseLike<T>) => {
    const client: PoolClient = await pool().connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE units SET active = false WHERE code = $1', [
        UNIT,
      ]);
      const pending = Promise.resolve(run());
      await pause(300);
      await client.query('COMMIT');
      return await pending;
    } finally {
      client.release();
    }
  };

  beforeAll(async () => {
    image = await upload(ADMIN, 'item_image', 'admin');
    await pool().query(
      'INSERT INTO units (code, name, active) VALUES ($1, $1, true)',
      [UNIT],
    );
    onCleanup(async (p) => {
      await p.query('DELETE FROM requests WHERE user_sub = $1', [A]);
      await p.query('DELETE FROM items WHERE unit = $1', [UNIT]);
      await p.query('DELETE FROM units WHERE code = $1', [UNIT]);
    });
  });

  beforeEach(async () => {
    await pool().query('DELETE FROM items WHERE unit = $1', [UNIT]);
    await pool().query('UPDATE units SET active = true WHERE code = $1', [
      UNIT,
    ]);
  });

  it('tạo món khi tx ngừng ĐVT chưa commit → chờ rồi 400 UNIT_INACTIVE, không có món trên ĐVT', async () => {
    const res = await whileDeactivating(() => createItem(`${ITEM}-held`));
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'UNIT_INACTIVE' });
    expect(await itemsOnUnit()).toBe(0);
  });

  it('lưu dòng ngoài DM chọn ĐVT khi tx ngừng ĐVT chưa commit → chờ rồi 400 UNIT_INACTIVE', async () => {
    const res = await whileDeactivating(() =>
      save([{ custom_name: 'Kẹp đua', custom_unit: UNIT, qty: 1 }]),
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'UNIT_INACTIVE', line_index: 0 });
  });

  it('ngừng ĐVT và tạo món cùng lúc (Promise.all) → món tạo trước khi ngừng (201) hoặc UNIT_INACTIVE; không 500', async () => {
    const [made, off] = await Promise.all([
      createItem(`${ITEM}-all`),
      deactivate(),
    ]);
    expect(off.status).toBe(200);
    expect([201, 400]).toContain(made.status);
    if (made.status === 400) {
      expect(made.body).toMatchObject({ code: 'UNIT_INACTIVE' });
    }
    expect(await itemsOnUnit()).toBe(made.status === 201 ? 1 : 0);
  });
});
