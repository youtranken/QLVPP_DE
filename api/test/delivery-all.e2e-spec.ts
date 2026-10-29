import { AFTER_DEADLINE, BEFORE_DEADLINE } from './me-request.fixture';
import { deliveryFixture } from './delivery.fixture';

interface DeliverAllResult {
  delivered: { line_id: string; qty: number }[];
  failed: { line_id: string; code: string; available?: number }[];
}

const byLine = <T extends { line_id: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.line_id.localeCompare(b.line_id));

describe('POST admin/requests/:id/deliver-all: giao tất cả theo phiếu', () => {
  const f = deliveryFixture('deliver-all');
  const {
    A,
    at,
    auditOf,
    custom,
    deliver,
    deliverAll,
    deliveriesOf,
    freeze,
    lineRow,
    movementsOf,
    notificationsOf,
    pool,
    review,
    seed,
    stockItem,
    stockOf,
  } = f;

  const updatedAt = async (requestId: string) =>
    (
      await pool().query<{ updated_at: Date }>(
        'SELECT updated_at FROM requests WHERE id = $1',
        [requestId],
      )
    ).rows[0].updated_at.toISOString();

  it('A4 qty 2 tồn 5, bút qty 3 tồn 1, accepted qty 1, pending → delivered [A4 2, accepted 1], failed [bút STOCK_INSUFFICIENT {available: 1}, pending LINE_NOT_REVIEWED]; bấm lại → delivered [], failed như cũ, không movement mới', async () => {
    const a4 = await stockItem(5);
    const pen = await stockItem(1);
    at(BEFORE_DEADLINE);
    const request = await seed([
      { item_id: a4, qty: 2 },
      { item_id: pen, qty: 3 },
      custom({ custom_name: 'Bìa đã duyệt', qty: 1 }),
      custom({ custom_name: 'Bìa chờ duyệt', qty: 1 }),
    ]);
    const lineOf = (pick: (l: (typeof request.lines)[number]) => boolean) =>
      request.lines.find(pick)!.id;
    const a4Line = lineOf((l) => l.item_id === a4);
    const penLine = lineOf((l) => l.item_id === pen);
    const accepted = lineOf((l) => l.custom_name === 'Bìa đã duyệt');
    const pending = lineOf((l) => l.custom_name === 'Bìa chờ duyệt');
    await review(accepted, { action: 'accept' }).expect(200);
    freeze(AFTER_DEADLINE);

    const first = (await deliverAll(request.id).expect(200))
      .body as DeliverAllResult;
    expect(byLine(first.delivered)).toEqual(
      byLine([
        { line_id: a4Line, qty: 2 },
        { line_id: accepted, qty: 1 },
      ]),
    );
    const expectedFailed = byLine([
      { line_id: penLine, code: 'STOCK_INSUFFICIENT', available: 1 },
      { line_id: pending, code: 'LINE_NOT_REVIEWED' },
    ]);
    expect(byLine(first.failed)).toEqual(expectedFailed);
    expect(await stockOf(a4)).toBe(3);
    expect(await stockOf(pen)).toBe(1);
    expect(await movementsOf(penLine)).toEqual([]);
    expect(await lineRow(penLine)).toMatchObject({ delivered_qty: 0 });
    expect(await deliveriesOf(accepted)).toEqual([
      { qty: 1, movement_id: null },
    ]);
    expect(await auditOf('line.delivered', a4Line)).toHaveLength(1);

    const again = (await deliverAll(request.id).expect(200))
      .body as DeliverAllResult;
    expect(again.delivered).toEqual([]);
    expect(byLine(again.failed)).toEqual(expectedFailed);
    expect(await movementsOf(a4Line)).toHaveLength(1);
    expect(await stockOf(a4)).toBe(3);
  });

  it('dòng tồn vừa đủ (3/3) → giao, tồn 0; dòng kế cần tồn+1 (4, tồn 3) → failed STOCK_INSUFFICIENT {available: 3}, tồn giữ 3', async () => {
    const exact = await stockItem(3);
    const short = await stockItem(3);
    at(BEFORE_DEADLINE);
    const request = await seed([
      { item_id: exact, qty: 3 },
      { item_id: short, qty: 4 },
    ]);
    freeze(AFTER_DEADLINE);
    const lineOf = (item: string) =>
      request.lines.find((l) => l.item_id === item)!.id;
    const res = (await deliverAll(request.id).expect(200))
      .body as DeliverAllResult;
    expect(res).toEqual({
      delivered: [{ line_id: lineOf(exact), qty: 3 }],
      failed: [
        { line_id: lineOf(short), code: 'STOCK_INSUFFICIENT', available: 3 },
      ],
    });
    expect(await stockOf(exact)).toBe(0);
    expect(await stockOf(short)).toBe(3);
  });

  it('dòng đã giao 1/2 → giao 1 (phần còn lại); dòng rejected → failed LINE_REJECTED; phiếu đã đủ → {delivered: [], failed: []}, không đổi updated_at', async () => {
    const item = await stockItem(10);
    at(BEFORE_DEADLINE);
    const request = await seed([{ item_id: item, qty: 2 }, custom()]);
    const line = request.lines.find((l) => l.item_id === item)!.id;
    const rejected = request.lines.find((l) => l.item_id === null)!.id;
    await review(rejected, { action: 'reject', note: 'Không mua' }).expect(200);
    freeze(AFTER_DEADLINE);
    await deliver(line, { qty: 1, expected_delivered_qty: 0 }).expect(200);

    const res = (await deliverAll(request.id).expect(200))
      .body as DeliverAllResult;
    expect(res).toEqual({
      delivered: [{ line_id: line, qty: 1 }],
      failed: [{ line_id: rejected, code: 'LINE_REJECTED' }],
    });
    expect(await stockOf(item)).toBe(8);
    expect((await deliveriesOf(line)).map((d) => d.qty)).toEqual([1, 1]);

    const doneOnly = await seedDelivered();
    const before = await updatedAt(doneOnly);
    freeze('2026-11-13T03:00:00Z');
    expect((await deliverAll(doneOnly).expect(200)).body).toEqual({
      delivered: [],
      failed: [],
    });
    expect(await updatedAt(doneOnly)).toBe(before);
  });

  async function seedDelivered(): Promise<string> {
    const item = await stockItem(10);
    at(BEFORE_DEADLINE);
    const request = await seed([{ item_id: item, qty: 2 }], f.B);
    freeze(AFTER_DEADLINE);
    await deliverAll(request.id).expect(200);
    return request.id;
  }

  it('phiếu mọi dòng đủ kho → đúng một chuông request_delivered:<id>:2 dù bấm giao tất cả hai lần liền', async () => {
    const p = await stockItem(5);
    const q = await stockItem(5);
    at(BEFORE_DEADLINE);
    const request = await seed([
      { item_id: p, qty: 2 },
      { item_id: q, qty: 1 },
    ]);
    freeze(AFTER_DEADLINE);
    await deliverAll(request.id).expect(200);
    await deliverAll(request.id).expect(200);
    expect(await notificationsOf(A)).toEqual([
      {
        event_id: `request_delivered:${request.id}:2`,
        topic: 'request_delivered',
        params: { ym: '2026-11' },
        link: '/history/2026-11',
      },
    ]);
  });

  it('PERIOD_NOT_LOCKED khi giao tất cả lúc 2026-11-10T16:59:59.999Z (23:59:59.999 ngày 10 VN), tồn không đổi; lúc 2026-11-10T17:00:00.000Z (00:00 ngày 11 VN) → giao', async () => {
    const item = await stockItem(10);
    at(BEFORE_DEADLINE);
    const request = await seed([{ item_id: item, qty: 2 }]);
    freeze('2026-11-10T16:59:59.999Z');
    const early = await deliverAll(request.id).expect(409);
    expect(early.body.code).toBe('PERIOD_NOT_LOCKED');
    expect(await stockOf(item)).toBe(10);
    freeze('2026-11-10T17:00:00.000Z');
    const ok = await deliverAll(request.id).expect(200);
    expect(ok.body.delivered).toEqual([
      { line_id: request.lines[0].id, qty: 2 },
    ]);
  });

  it('id lạ → 404 REQUEST_NOT_FOUND; id không phải uuid → 400; member → 403', async () => {
    const missing = await deliverAll(
      '00000000-0000-4000-8000-000000000000',
    ).expect(404);
    expect(missing.body.code).toBe('REQUEST_NOT_FOUND');
    await deliverAll('x').expect(400);
    const item = await stockItem(10);
    at(BEFORE_DEADLINE);
    const request = await seed([{ item_id: item, qty: 2 }]);
    freeze(AFTER_DEADLINE);
    await deliverAll(request.id, A, 'member').expect(403);
    expect(await stockOf(item)).toBe(10);
  });
});
