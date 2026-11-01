import { stockFixture } from './stock.fixture';

describe('kho: mốc sắp hết và tồn đầu kỳ (Postgres thật)', () => {
  const f = stockFixture();
  const { stock, newItem, itemRow: row, lowIds: low, issueTo } = f;

  it('sắp hết = đã dùng 80 % tồn sau lần nhập gần nhất; adjust không đổi mốc', async () => {
    const id = await newItem();
    expect(await row(id)).toMatchObject({
      restock_level: null,
      stock_state: 'out',
    });
    expect(await low()).not.toContain(id);

    await stock(id, { delta: 30, reason: 'purchase' }).expect(201);
    expect(await row(id)).toMatchObject({
      restock_level: 30,
      stock_state: 'ok',
    });
    await issueTo(id, 7);
    expect(await low()).not.toContain(id);
    await issueTo(id, 6);
    expect(await low()).toContain(id);
    expect((await row(id)).stock_state).toBe('low');

    await stock(id, { delta: 20, reason: 'purchase' }).expect(201);
    expect(await row(id)).toMatchObject({
      stock_qty: 26,
      restock_level: 26,
      stock_state: 'ok',
    });
    expect(await low()).not.toContain(id);
    await issueTo(id, 6);
    expect(await low()).not.toContain(id);
    await issueTo(id, 5);
    expect(await low()).toContain(id);

    await stock(id, { delta: 10, reason: 'adjust', note: 'kiểm kê' }).expect(
      201,
    );
    expect((await row(id)).restock_level).toBe(26);
    await stock(id, { delta: -5, reason: 'adjust', note: 'kiểm kê' }).expect(
      201,
    );
    expect((await row(id)).restock_level).toBe(26);

    await issueTo(id, 0);
    expect(await row(id)).toMatchObject({ stock_qty: 0, stock_state: 'out' });
    expect(await low()).not.toContain(id);

    await stock(id, { delta: 30, reason: 'purchase' }).expect(201);
    await issueTo(id, 6);
    expect(await low()).toContain(id);
    await f.pool().query('UPDATE items SET active = false WHERE id = $1', [id]);
    expect(await low()).not.toContain(id);
  });

  it('chưa có mốc nhập (restock_level null): tồn 0 → out (Hết hàng), tồn 1 → untracked', async () => {
    const empty = await newItem(0);
    expect(await row(empty)).toMatchObject({
      stock_qty: 0,
      restock_level: null,
      stock_state: 'out',
    });
    const one = await newItem(1);
    expect(await row(one)).toMatchObject({
      stock_qty: 1,
      restock_level: null,
      stock_state: 'untracked',
    });
    expect(await low()).not.toContain(empty);
    expect(await low()).not.toContain(one);
  });

  it('restock_level 4 → mốc floor(0,8) = 0: tồn 1 vẫn ok, không bao giờ sắp hết; tồn 0 = out', async () => {
    const id = await newItem();
    await stock(id, { delta: 4, reason: 'purchase' }).expect(201);
    await issueTo(id, 1);
    expect(await row(id)).toMatchObject({
      stock_qty: 1,
      restock_level: 4,
      stock_state: 'ok',
    });
    expect(await low()).not.toContain(id);
    await issueTo(id, 0);
    expect((await row(id)).stock_state).toBe('out');
    expect(await low()).not.toContain(id);
  });

  it('restock_level 5 → mốc 1: tồn 2 ok, tồn 1 sắp hết', async () => {
    const id = await newItem();
    await stock(id, { delta: 5, reason: 'purchase' }).expect(201);
    await issueTo(id, 2);
    expect(await low()).not.toContain(id);
    await issueTo(id, 1);
    expect(await low()).toContain(id);
    expect((await row(id)).stock_state).toBe('low');
  });

  it('tồn đầu kỳ qua adjust: đặt mốc khi chưa có; giữ mốc đã có; adjust âm không đặt mốc', async () => {
    const level = async (id: string) =>
      (
        await f
          .pool()
          .query<{ restock_level: number | null }>(
            'SELECT restock_level FROM items WHERE id = $1',
            [id],
          )
      ).rows[0].restock_level;
    const id = await newItem();
    await stock(id, { delta: 10, reason: 'adjust', note: 'tồn đầu' }).expect(
      201,
    );
    expect(await level(id)).toBe(10);
    await stock(id, { delta: -3, reason: 'adjust', note: 'kiểm kê' }).expect(
      201,
    );
    expect(await level(id)).toBe(10);
    await stock(id, { delta: 5, reason: 'purchase' }).expect(201);
    expect(await level(id)).toBe(12);

    const stocked = await newItem(50);
    await stock(stocked, {
      delta: -20,
      reason: 'adjust',
      note: 'hao hụt',
    }).expect(201);
    expect(await level(stocked)).toBeNull();
  });
});
