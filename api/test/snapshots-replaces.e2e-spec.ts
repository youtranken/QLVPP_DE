import { snapshotsFixture } from './report-snapshots.fixture';

const YM = '2026-11';

describe('Bản gửi NCC ghi đúng loại bản bị thay (replaces.kind)', () => {
  const f = snapshotsFixture('replaces-kind');
  let item: string;

  beforeEach(async () => {
    await f.resetPeriod(YM);
    ({ item } = await f.lockedLine(0, 5));
  });

  it('xuất Excel rồi in với đề nghị khác → bản in replaces { id, created_at, kind: "xlsx" }', async () => {
    const xlsx = (await f.create(YM, { kind: 'xlsx', order_qty: {} }).expect(201)).body as { id: string; created_at: string };
    const print = await f.create(YM, { kind: 'print', order_qty: { [item]: 3 } }).expect(201);
    expect(print.body.data.replaces).toEqual({ id: xlsx.id, created_at: xlsx.created_at, kind: 'xlsx' });
  });

  it('in rồi in lại với đề nghị khác → replaces.kind "print"', async () => {
    const first = (await f.create(YM, { kind: 'print', order_qty: {} }).expect(201)).body as { id: string };
    const second = await f.create(YM, { kind: 'print', order_qty: { [item]: 3 } }).expect(201);
    expect(second.body.data.replaces).toMatchObject({ id: first.id, kind: 'print' });
  });
});
