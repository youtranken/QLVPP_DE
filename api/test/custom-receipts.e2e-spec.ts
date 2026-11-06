import { randomUUID } from 'node:crypto';
import { arrivalsFixture } from './arrivals.fixture';

const YM = '2026-11';
const LOCKED_AT = '2026-11-12T03:00:00Z';

interface PersonLine {
  line_id: string;
  adm_out: boolean;
  custom_tracked: boolean;
  deliver_cap: number | null;
  remaining_qty: number;
}

describe('V2D-5 hàng ngoài danh mục đã về: custom-receipts, trần giao (e2e)', () => {
  const f = arrivalsFixture('custrec');
  const { A, B, ADMIN, customReceive, plan } = f;

  beforeEach(async () => {
    await f.resetPeriod(YM);
    f.freeze(LOCKED_AT);
  });

  const people = async () =>
    (
      (
        await f
          .as(
            f.http().get(`/api/admin/periods/${YM}/delivery-people`),
            ADMIN,
            'admin',
          )
          .expect(200)
      ).body as { people: { lines: PersonLine[] }[] }
    ).people.flatMap((p) => p.lines);
  const lineView = async (id: string) =>
    (await people()).find((l) => l.line_id === id);

  // "Kéo cắt giấy" trong bản in 2: A đăng ký trước 1, B sau 1
  const seedPrinted = async () => {
    const name = f.customName('Kéo cắt giấy');
    const first = await f.seedLine(YM, A, f.customCols(name, 1));
    const second = await f.seedLine(YM, B, f.customCols(name, 1));
    const key = await f.customKey(first);
    await f.insertSnapshot(
      YM,
      {
        ym: YM,
        byItem: [],
        custom: [
          { key, name, unit: 'cai', requested: 2, backlog_prev: 0, people: 2 },
        ],
        order_qty: { [key]: 2 },
      },
      '2026-11-11T03:00:00Z',
    );
    return { name, key, first, second };
  };

  it('"Đã về" 1 → trần giao: người đăng ký trước 1, người sau 0; về thêm 1 → cả hai 1; kế hoạch custom có ordered/received/remaining', async () => {
    const { key, first, second } = await seedPrinted();
    expect(await lineView(first)).toMatchObject({
      custom_tracked: true,
      deliver_cap: 0,
    });
    const res = await customReceive(YM, { line_key: key, qty: 1 }).expect(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      line_key: key,
      qty: 1,
      received: 1,
    });
    expect(await lineView(first)).toMatchObject({ deliver_cap: 1 });
    expect(await lineView(second)).toMatchObject({ deliver_cap: 0 });
    expect(
      (await f.auditRows('arrival.custom_received', YM)).find(
        (r) => r.detail.id === res.body.id,
      )?.detail,
    ).toMatchObject({
      line_key: key,
      qty: 1,
      before: { received: 0 },
      after: { received: 1 },
    });
    await customReceive(YM, { line_key: key, qty: 1, note: 'đợt 2' }).expect(
      201,
    );
    expect((await lineView(second))?.deliver_cap).toBe(1);
    expect((await plan(YM)).custom).toEqual([
      expect.objectContaining({
        key,
        unit: 'cai',
        ordered: 2,
        received: 2,
        remaining: 0,
        adm_out: false,
      }),
    ]);
  });

  it('khóa ngoài DM không có trong bản in → trần = còn lại, custom_tracked false; POST custom-receipts → 404 ITEM_NOT_FOUND', async () => {
    await seedPrinted();
    const own = await f.seedLine(
      YM,
      A,
      f.customCols(f.customName('Tự mua riêng'), 2),
    );
    expect(await lineView(own)).toMatchObject({
      custom_tracked: false,
      deliver_cap: 2,
      remaining_qty: 2,
    });
    await customReceive(YM, {
      line_key: await f.customKey(own),
      qty: 1,
    }).expect(404, /ITEM_NOT_FOUND/);
  });

  it('qty 0 / khóa món danh mục / khóa hỏng → 400 VALIDATION; qty 1 → 201', async () => {
    const { key } = await seedPrinted();
    await customReceive(YM, { line_key: key, qty: 0 }).expect(
      400,
      /VALIDATION/,
    );
    await customReceive(YM, { line_key: randomUUID(), qty: 1 }).expect(
      400,
      /VALIDATION/,
    );
    await customReceive(YM, { line_key: 'custom:["a"]', qty: 1 }).expect(
      400,
      /VALIDATION/,
    );
    await customReceive(YM, { line_key: key, qty: 1 }).expect(201);
  });

  it('ADM hết hàng theo khóa custom: kế hoạch + delivery-people adm_out true; "Đã về" → 409 ITEM_ADM_OUT; hủy khi giao dùng được', async () => {
    const { key, first } = await seedPrinted();
    await f.markOut(YM, key).expect(200);
    expect((await plan(YM)).custom[0]).toMatchObject({ adm_out: true });
    expect((await lineView(first))?.adm_out).toBe(true);
    await customReceive(YM, { line_key: key, qty: 1 }).expect(
      409,
      /ITEM_ADM_OUT/,
    );
    await f
      .cancel(first, {
        reason_code: 'adm_out_of_stock',
        expected_delivered_qty: 0,
        expected_qty: 1,
      })
      .expect(200);
    expect(await f.line(first)).toMatchObject({
      cancelled_qty: 1,
      cancel_note: 'ADM hết hàng',
    });
  });
});
