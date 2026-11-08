import { randomUUID } from 'node:crypto';
import { SessionService } from '../src/modules/auth/session.service';
import { SystemConfigService } from '../src/modules/config/system-config.service';
import { UsersService } from '../src/modules/users/users.service';
import { deliveryFixture } from './delivery.fixture';
import { AFTER_DEADLINE, BEFORE_DEADLINE } from './me-request.fixture';

interface Result {
  request_id: string;
  ok: boolean;
  delivered_units?: number;
  request_complete?: boolean;
  code?: string;
  line_id?: string;
  available?: number;
  remaining?: number;
}

describe('POST admin/deliveries/bulk: giao nhiều phiếu, mỗi phiếu một transaction', () => {
  const f = deliveryFixture('bulk');
  const {
    A,
    B,
    ADMIN,
    as,
    at,
    auditOf,
    bellsOf,
    custom,
    customLine,
    deliveriesOf,
    freeze,
    http,
    movementsOf,
    review,
    save,
    seed,
    stockItem,
    stockOf,
    view,
  } = f;

  const bulk = (body: object, sub = ADMIN, role = 'admin') =>
    as(http().post('/api/admin/deliveries/bulk'), sub, role).send(body);
  const results = async (body: object) =>
    ((await bulk(body).expect(200)).body as { results: Result[] }).results;
  const entry = (
    request: { id: string; lines: { id: string }[] },
    qty: number,
    expected = 0,
    index = 0,
  ) => ({
    request_id: request.id,
    lines: [
      {
        line_id: request.lines[index].id,
        qty,
        expected_delivered_qty: expected,
      },
    ],
  });
  // A (đăng ký trước) cần qa, B cần qb, cùng một món
  const pair = async (stock: number, qa: number, qb: number) => {
    const item = await stockItem(stock);
    at(BEFORE_DEADLINE);
    const ra = await seed([{ item_id: item, qty: qa }], A);
    const rb = await seed([{ item_id: item, qty: qb }], B);
    freeze(AFTER_DEADLINE);
    return { item, ra, rb };
  };

  it('giao 2 phiếu đủ tủ → cả hai ok, tồn giảm đúng tổng, mỗi phiếu đủ một chuông request_delivered', async () => {
    const { item, ra, rb } = await pair(10, 2, 3);
    const res = await results({ requests: [entry(ra, 2), entry(rb, 3)] });
    expect(res).toEqual([
      {
        request_id: ra.id,
        ok: true,
        delivered_units: 2,
        request_complete: true,
      },
      {
        request_id: rb.id,
        ok: true,
        delivered_units: 3,
        request_complete: true,
      },
    ]);
    expect(await stockOf(item)).toBe(5);
    expect(await bellsOf('request_delivered', A)).toHaveLength(1);
    expect(await bellsOf('request_delivered', B)).toHaveLength(1);
  });

  it('tủ còn 3, A cần 2, C cần 4: gửi A 2, C 1 → C ok 1 đơn vị, phần còn 3 của C vẫn chờ, không hủy', async () => {
    const { item, ra, rb } = await pair(3, 2, 4);
    const res = await results({ requests: [entry(ra, 2), entry(rb, 1)] });
    expect(res.map((r) => [r.ok, r.delivered_units])).toEqual([
      [true, 2],
      [true, 1],
    ]);
    expect(res[1].request_complete).toBe(false);
    expect(await stockOf(item)).toBe(0);
    const row = await f
      .pool()
      .query(
        'SELECT delivered_qty, cancelled_qty FROM request_lines WHERE id = $1',
        [rb.lines[0].id],
      );
    expect(row.rows[0]).toEqual({ delivered_qty: 1, cancelled_qty: 0 });
    expect(await bellsOf('request_delivered', B)).toEqual([]);
  });

  it('expected_delivered_qty lệch ở phiếu B → B STALE_UPDATE kèm line_id, A vẫn ok và đã ghi', async () => {
    const { item, ra, rb } = await pair(10, 2, 3);
    const res = await results({ requests: [entry(ra, 2), entry(rb, 1, 1)] });
    expect(res[0]).toMatchObject({ ok: true, delivered_units: 2 });
    expect(res[1]).toEqual({
      request_id: rb.id,
      ok: false,
      code: 'STALE_UPDATE',
      line_id: rb.lines[0].id,
    });
    expect(await deliveriesOf(ra.lines[0].id)).toHaveLength(1);
    expect(await deliveriesOf(rb.lines[0].id)).toHaveLength(0);
    expect(await stockOf(item)).toBe(8);
  });

  it('gửi lại y nguyên body vừa thành công → mọi phiếu STALE_UPDATE, tồn và line_deliveries không đổi', async () => {
    const { item, ra, rb } = await pair(10, 2, 3);
    const body = { requests: [entry(ra, 2), entry(rb, 3)] };
    await results(body);
    const again = await results(body);
    expect(again.map((r) => [r.ok, r.code])).toEqual([
      [false, 'STALE_UPDATE'],
      [false, 'STALE_UPDATE'],
    ]);
    expect(await stockOf(item)).toBe(5);
    expect(await deliveriesOf(ra.lines[0].id)).toHaveLength(1);
    expect(await deliveriesOf(rb.lines[0].id)).toHaveLength(1);
  });

  it('qty vượt tồn lúc chạy → STOCK_INSUFFICIENT {available}, cả phiếu rollback (dòng trước không ghi)', async () => {
    const small = await stockItem(1);
    const big = await stockItem(10);
    at(BEFORE_DEADLINE);
    const r = await seed(
      [
        { item_id: big, qty: 2 },
        { item_id: small, qty: 2 },
      ],
      A,
    );
    freeze(AFTER_DEADLINE);
    const byItem = (id: string) => r.lines.find((l) => l.item_id === id)!;
    const res = await results({
      requests: [
        {
          request_id: r.id,
          lines: [
            { line_id: byItem(big).id, qty: 2, expected_delivered_qty: 0 },
            { line_id: byItem(small).id, qty: 2, expected_delivered_qty: 0 },
          ],
        },
      ],
    });
    expect(res[0]).toMatchObject({
      ok: false,
      code: 'STOCK_INSUFFICIENT',
      available: 1,
      line_id: byItem(small).id,
    });
    expect(await stockOf(big)).toBe(10);
    expect(await stockOf(small)).toBe(1);
    expect(await deliveriesOf(byItem(big).id)).toHaveLength(0);
    expect(await movementsOf(byItem(big).id)).toHaveLength(0);
  });

  it('kỳ chưa khóa → PERIOD_NOT_LOCKED; dòng phiếu khác → LINE_NOT_FOUND; dòng pending → LINE_NOT_REVIEWED', async () => {
    const item = await stockItem(10);
    at(BEFORE_DEADLINE);
    const ra = await seed([{ item_id: item, qty: 2 }], A);
    const rb = await seed([{ item_id: item, qty: 2 }], B);
    const open = await results({ requests: [entry(ra, 1)] });
    expect(open[0]).toMatchObject({ ok: false, code: 'PERIOD_NOT_LOCKED' });
    freeze(AFTER_DEADLINE);
    const cross = await results({
      requests: [
        {
          request_id: ra.id,
          lines: [
            {
              line_id: rb.lines[0].id,
              qty: 1,
              expected_delivered_qty: 0,
            },
          ],
        },
      ],
    });
    expect(cross[0]).toEqual({
      request_id: ra.id,
      ok: false,
      code: 'LINE_NOT_FOUND',
      line_id: rb.lines[0].id,
    });
    expect(await stockOf(item)).toBe(10);
  });

  it('dòng ngoài DM còn chờ duyệt → LINE_NOT_REVIEWED, không giao', async () => {
    const pending = await customLine(A, 'Hàng chờ duyệt');
    const res = await results({ requests: [entry(pending.request, 1)] });
    expect(res[0]).toMatchObject({ ok: false, code: 'LINE_NOT_REVIEWED' });
  });

  it('phiếu không tồn tại → LINE_NOT_FOUND, các phiếu khác vẫn chạy', async () => {
    const { ra } = await pair(10, 2, 2);
    const ghost = { id: randomUUID(), lines: [{ id: randomUUID() }] };
    const res = await results({ requests: [entry(ghost, 1), entry(ra, 1)] });
    expect(res.map((r) => r.code ?? 'ok')).toEqual(['LINE_NOT_FOUND', 'ok']);
  });

  it('member → 403; Hành chính vào route thường', async () => {
    const { ra } = await pair(10, 2, 2);
    await bulk({ requests: [entry(ra, 1)] }, A, 'member').expect(403);
    await bulk({ requests: [entry(ra, 1)] }, ADMIN, 'sa').expect(200);
  });

  it('phiên thật thiếu X-CSRF-Token → 403 CSRF_TOKEN_INVALID, không giao; có token → 200', async () => {
    const { item, ra } = await pair(10, 2, 2);
    const sub = `e2e-req-csrf-${f.SUFFIX}`;
    const groups = [await f.app().get(SystemConfigService).getAdminGroup()];
    const claims = { sub, full_name: 'E2E Hành chính', groups };
    await f.app().get(UsersService).upsertFromClaims(claims);
    const session = await f
      .app()
      .get(SessionService)
      .create({
        userSub: sub,
        refreshToken: null,
        accessTokenExp: new Date(Date.now() + 10 * 60_000),
        claims,
        idToken: null,
      });
    const post = () =>
      http()
        .post('/api/admin/deliveries/bulk')
        .set('Cookie', `vpp_sid=${session.id}`);
    const body = { requests: [entry(ra, 1)] };
    const res = await post().send(body).expect(403);
    expect(res.body.code).toBe('CSRF_TOKEN_INVALID');
    expect(await stockOf(item)).toBe(10);
    await post().set('X-CSRF-Token', session.csrfToken).send(body).expect(200);
    expect(await stockOf(item)).toBe(9);
  });

  describe('biên đầu vào', () => {
    const ghostEntry = (lines = 1) => ({
      request_id: randomUUID(),
      lines: Array.from({ length: lines }, () => ({
        line_id: randomUUID(),
        qty: 1,
        expected_delivered_qty: 0,
      })),
    });
    const invalid = async (body: object, fields: string[]) => {
      const res = await bulk(body).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION', fields });
    };

    it('100 phiếu được, 101 → 400 VALIDATION', async () => {
      const ok = Array.from({ length: 100 }, () => ghostEntry());
      const res = await results({ requests: ok });
      expect(res).toHaveLength(100);
      await invalid({ requests: [...ok, ghostEntry()] }, ['requests']);
    });

    it('200 dòng/phiếu được, 201 → 400', async () => {
      const res = await results({ requests: [ghostEntry(200)] });
      expect(res[0].code).toBe('LINE_NOT_FOUND');
      await invalid({ requests: [ghostEntry(201)] }, ['requests.0.lines']);
    });

    it('qty 0 → 400, 9999 qua DTO, 10000 → 400; requests rỗng → 400', async () => {
      const withQty = (qty: number) => {
        const e = ghostEntry();
        e.lines[0].qty = qty;
        return { requests: [e] };
      };
      await invalid(withQty(0), ['requests.0.lines.0.qty']);
      await invalid(withQty(10000), ['requests.0.lines.0.qty']);
      expect((await results(withQty(9999)))[0].code).toBe('LINE_NOT_FOUND');
      await invalid({ requests: [] }, ['requests']);
    });

    it('request_id trùng hoặc line_id trùng trong phiếu → 400 VALIDATION {requests}', async () => {
      const e = ghostEntry();
      await invalid({ requests: [e, e] }, ['requests']);
      const dupLine = ghostEntry();
      dupLine.lines.push({ ...dupLine.lines[0] });
      await invalid({ requests: [dupLine] }, ['requests']);
    });
  });

  it('audit: mỗi dòng một line.delivered như giao đơn (before/after delivered_qty)', async () => {
    const { ra, rb } = await pair(10, 2, 3);
    await results({ requests: [entry(ra, 2), entry(rb, 1)] });
    const a = await auditOf('line.delivered', ra.lines[0].id);
    const b = await auditOf('line.delivered', rb.lines[0].id);
    expect(a).toEqual([
      expect.objectContaining({
        before: { delivered_qty: 0 },
        after: { delivered_qty: 2 },
        qty: 2,
      }),
    ]);
    expect(b).toEqual([
      expect.objectContaining({
        before: { delivered_qty: 0 },
        after: { delivered_qty: 1 },
        qty: 1,
      }),
    ]);
  });

  it('phiếu có dòng đã duyệt ngoài DM (accepted) giao được cùng dòng món', async () => {
    const item = await stockItem(10);
    const img = await f.upload(A);
    at(BEFORE_DEADLINE);
    const r = view(
      await save([
        { item_id: item, qty: 2 },
        custom({ image_file_id: img }),
      ]).expect(200),
    );
    freeze(AFTER_DEADLINE);
    const cl = r.lines.find((l) => !l.item_id)!;
    await review(cl.id, { action: 'accept' }).expect(200);
    const cat = r.lines.find((l) => l.item_id === item)!;
    const res = await results({
      requests: [
        {
          request_id: r.id,
          lines: [{ line_id: cat.id, qty: 2, expected_delivered_qty: 0 }],
        },
      ],
    });
    expect(res[0]).toMatchObject({ ok: true, delivered_units: 2 });
  });
});
