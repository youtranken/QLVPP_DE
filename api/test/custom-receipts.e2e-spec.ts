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
    const res = await customReceive(YM, {
      line_key: key,
      qty: 1,
      expected_received: 0,
    }).expect(201);
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
    await customReceive(YM, {
      line_key: key,
      qty: 1,
      note: 'đợt 2',
      expected_received: 1,
    }).expect(201);
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
      expected_received: 0,
    }).expect(404, /ITEM_NOT_FOUND/);
  });

  it('qty 0 / khóa món danh mục / khóa hỏng / thiếu expected_received → 400 VALIDATION; qty 1 → 201', async () => {
    const { key } = await seedPrinted();
    const ok = { line_key: key, qty: 1, expected_received: 0 };
    await customReceive(YM, { ...ok, qty: 0 }).expect(400, /VALIDATION/);
    await customReceive(YM, { ...ok, line_key: randomUUID() }).expect(
      400,
      /VALIDATION/,
    );
    await customReceive(YM, { ...ok, line_key: 'custom:["a"]' }).expect(
      400,
      /VALIDATION/,
    );
    await customReceive(YM, { line_key: key, qty: 1 }).expect(
      400,
      /expected_received/,
    );
    await customReceive(YM, { ...ok, expected_received: -1 }).expect(
      400,
      /VALIDATION/,
    );
    await customReceive(YM, ok).expect(201);
  });

  it('gửi lại cùng body → 201 rồi 409 STALE_UPDATE {line_key, received}; chỉ tính một lần', async () => {
    const { key } = await seedPrinted();
    const body = { line_key: key, qty: 1, expected_received: 0 };
    // Khóa ngoài DM dùng tên chung của suite: audit các ca trước cùng khóa vẫn còn (chỉ thêm)
    const audits = async () =>
      (await f.auditRows('arrival.custom_received', YM)).filter(
        (r) => r.detail.line_key === key,
      ).length;
    const audited = await audits();
    await customReceive(YM, body).expect(201);
    const res = await customReceive(YM, body).expect(409);
    expect(res.body).toMatchObject({
      code: 'STALE_UPDATE',
      line_key: key,
      received: 1,
    });
    expect((await plan(YM)).custom[0]).toMatchObject({ received: 1 });
    expect(await audits()).toBe(audited + 1);
  });

  it('hai lần "Đã về" song song cùng expected_received → đúng một 201, một 409', async () => {
    const { key } = await seedPrinted();
    const body = { line_key: key, qty: 1, expected_received: 0 };
    const codes = (
      await Promise.all([customReceive(YM, body), customReceive(YM, body)])
    )
      .map((r) => r.status)
      .sort();
    expect(codes).toEqual([201, 409]);
    expect((await plan(YM)).custom[0]).toMatchObject({ received: 1 });
  });

  it('ADM hết hàng theo khóa custom: kế hoạch + delivery-people adm_out true; "Đã về" → 409 ITEM_ADM_OUT; hủy khi giao dùng được', async () => {
    const { key, first } = await seedPrinted();
    await f.markOut(YM, key).expect(200);
    expect((await plan(YM)).custom[0]).toMatchObject({ adm_out: true });
    expect((await lineView(first))?.adm_out).toBe(true);
    await customReceive(YM, {
      line_key: key,
      qty: 1,
      expected_received: 0,
    }).expect(409, /ITEM_ADM_OUT/);
    await f
      .cancel(first, {
        reason_code: 'adm_out_of_stock',
        expected_delivered_qty: 0,
        expected_qty: 1,
      })
      .expect(200);
    expect(await f.line(first)).toMatchObject({
      cancelled_qty: 1,
      cancel_note: 'NCC hết hàng',
    });
  });

  describe('trần giao ngoài DM ở server (R-D11.21)', () => {
    const receive = (key: string, qty: number, expected: number) =>
      customReceive(YM, { line_key: key, qty, expected_received: expected });

    // A đăng ký 2, B 1 cùng khóa; bản in đặt 3
    const seedTracked = async () => {
      const name = f.customName('Bút dạ quang');
      const x = await f.seedLine(YM, A, f.customCols(name, 2));
      const y = await f.seedLine(YM, B, f.customCols(name, 1));
      const key = await f.customKey(x);
      await f.insertSnapshot(
        YM,
        {
          ym: YM,
          byItem: [],
          custom: [
            {
              key,
              name,
              unit: 'cai',
              requested: 3,
              backlog_prev: 0,
              people: 2,
            },
          ],
          order_qty: { [key]: 3 },
        },
        '2026-11-11T03:00:00Z',
      );
      return { key, x, y };
    };

    it('chưa về → giao 409 CUSTOM_NOT_RECEIVED {available: 0}; về 1 → giao 2 → 409 {available: 1}, giao 1 → 200; người sau → 409 {available: 0}', async () => {
      const { key, x, y } = await seedTracked();
      const none = await f
        .deliver(x, { qty: 1, expected_delivered_qty: 0 })
        .expect(409);
      expect(none.body).toMatchObject({
        code: 'CUSTOM_NOT_RECEIVED',
        available: 0,
      });
      await receive(key, 1, 0).expect(201);
      const two = await f
        .deliver(x, { qty: 2, expected_delivered_qty: 0 })
        .expect(409);
      expect(two.body).toMatchObject({
        code: 'CUSTOM_NOT_RECEIVED',
        available: 1,
      });
      await f.deliver(x, { qty: 1, expected_delivered_qty: 0 }).expect(200);
      const after = await f
        .deliver(y, { qty: 1, expected_delivered_qty: 0 })
        .expect(409);
      expect(after.body).toMatchObject({
        code: 'CUSTOM_NOT_RECEIVED',
        available: 0,
      });
      expect(await f.line(y)).toMatchObject({ delivered_qty: 0 });
    });

    it('giao nhiều phiếu cùng trần: chưa về → phiếu lỗi CUSTOM_NOT_RECEIVED, không giao; về 2 → giao 2 cho A trong một lần gọi', async () => {
      const { key, x } = await seedTracked();
      const requestOf = async (id: string) =>
        (
          await f
            .pool()
            .query<{ request_id: string }>(
              'SELECT request_id FROM request_lines WHERE id = $1',
              [id],
            )
        ).rows[0].request_id;
      const rid = await requestOf(x);
      const bulk = (qty: number) =>
        f
          .as(f.http().post('/api/admin/deliveries/bulk'), ADMIN, 'admin')
          .send({
            requests: [
              {
                request_id: rid,
                lines: [{ line_id: x, qty, expected_delivered_qty: 0 }],
              },
            ],
          })
          .expect(200);
      const none = (await bulk(1)).body as { results: object[] };
      expect(none.results[0]).toMatchObject({
        ok: false,
        code: 'CUSTOM_NOT_RECEIVED',
        available: 0,
      });
      expect(await f.line(x)).toMatchObject({ delivered_qty: 0 });
      await receive(key, 2, 0).expect(201);
      expect((await bulk(2)).body.results[0]).toMatchObject({
        ok: true,
        delivered_units: 2,
      });
      expect((await lineView(x))?.deliver_cap).toBe(0);
    });

    it('khóa ngoài DM không có trong bản in → không giới hạn theo hàng đã về', async () => {
      await seedTracked();
      const own = await f.seedLine(
        YM,
        A,
        f.customCols(f.customName('Tự mua riêng'), 2),
      );
      await f.deliver(own, { qty: 2, expected_delivered_qty: 0 }).expect(200);
    });
  });
});
