import { SessionService } from '../src/modules/auth/session.service';
import { UsersService } from '../src/modules/users/users.service';
import { deliveryFixture } from './delivery.fixture';
import type { RequestView } from './me-request.fixture';

describe('POST admin/lines/:id/deliver: chuông giao đủ, audit, updated_at', () => {
  const f = deliveryFixture('deliver-notify');
  const {
    ADMIN,
    SUFFIX,
    as,
    auditOf,
    custom,
    deliver,
    freeze,
    http,
    lockedLine,
    notificationsOf,
    save,
    stockItem,
    view,
  } = f;

  const adminView = async (id: string) =>
    (
      await as(http().get(`/api/admin/requests/${id}`), ADMIN, 'admin').expect(
        200,
      )
    ).body as RequestView;

  it('giao thiếu → không có chuông; giao đủ → đúng 1 thông báo request_delivered cho chủ phiếu, link /history/2026-11', async () => {
    const { request, line } = await lockedLine(10);
    await deliver(line.id, { qty: 3, expected_delivered_qty: 0 }).expect(200);
    expect(await notificationsOf()).toEqual([]);
    await deliver(line.id, { qty: 2, expected_delivered_qty: 3 }).expect(200);
    expect(await notificationsOf()).toEqual([
      {
        event_id: `request_delivered:${request.id}:2`,
        topic: 'request_delivered',
        params: { ym: '2026-11' },
        link: '/history/2026-11',
      },
    ]);
    expect(await notificationsOf(ADMIN)).toEqual([]);
  });

  it('phiếu còn dòng pending → giao đủ mọi dòng khác: request_complete false, không có chuông', async () => {
    const item = await stockItem(10);
    const request = view(
      await save([{ item_id: item, qty: 2 }, custom()]).expect(200),
    );
    freeze('2026-11-12T03:00:00Z');
    const catalogLine = request.lines.find((l) => l.item_id === item)!;
    const res = await deliver(catalogLine.id, {
      qty: 2,
      expected_delivered_qty: 0,
    }).expect(200);
    expect(res.body.request_complete).toBe(false);
    expect(await notificationsOf()).toEqual([]);
  });

  it('giao đủ → Hành chính tăng qty 5→6 qua PUT admin lines (lý do) → giao 1 → thông báo thứ 2 với event_id khác', async () => {
    const { request, line } = await lockedLine(10);
    await deliver(line.id, { qty: 5, expected_delivered_qty: 0 }).expect(200);
    const current = await adminView(request.id);
    await as(
      http().put(`/api/admin/requests/${request.id}/lines`),
      ADMIN,
      'admin',
    )
      .send({
        lines: [{ id: line.id, qty: 6 }],
        expected_updated_at: current.updated_at,
        reason: 'Bổ sung một cây',
      })
      .expect(200);
    const more = await deliver(line.id, {
      qty: 1,
      expected_delivered_qty: 5,
    }).expect(200);
    expect(more.body.request_complete).toBe(true);
    expect((await notificationsOf()).map((n) => n.event_id)).toEqual([
      `request_delivered:${request.id}:1`,
      `request_delivered:${request.id}:2`,
    ]);
  });

  it('audit line.delivered có request_id, before/after delivered_qty, qty, movement_id', async () => {
    const { request, line } = await lockedLine(10);
    const res = await deliver(line.id, {
      qty: 3,
      expected_delivered_qty: 0,
    }).expect(200);
    expect(await auditOf('line.delivered', line.id)).toEqual([
      {
        request_id: request.id,
        before: { delivered_qty: 0 },
        after: { delivered_qty: 3 },
        qty: 3,
        movement_id: res.body.movement_id,
      },
    ]);
  });

  it('GET admin/requests/:id sau giao có updated_at mới; tab Điều chỉnh mở trước khi giao lưu → 409 STALE_UPDATE', async () => {
    const { request, line } = await lockedLine(10);
    const before = await adminView(request.id);
    await deliver(line.id, { qty: 1, expected_delivered_qty: 0 }).expect(200);
    const after = await adminView(request.id);
    expect(after.updated_at > before.updated_at).toBe(true);
    const stale = await as(
      http().put(`/api/admin/requests/${request.id}/lines`),
      ADMIN,
      'admin',
    )
      .send({
        lines: [{ id: line.id, qty: 4 }],
        expected_updated_at: before.updated_at,
        reason: 'Giảm một cây',
      })
      .expect(409);
    expect(stale.body.code).toBe('STALE_UPDATE');
  });

  it('có phiên cookie mà thiếu X-CSRF-Token → 403 CSRF_TOKEN_INVALID, không giao', async () => {
    const { line } = await lockedLine(10);
    const sub = `e2e-req-csrf-${SUFFIX}`;
    await f.app().get(UsersService).upsertFromClaims({ sub, full_name: 'E2E' });
    const session = await f
      .app()
      .get(SessionService)
      .create({
        userSub: sub,
        refreshToken: null,
        accessTokenExp: new Date(Date.now() + 10 * 60_000),
        claims: { sub, full_name: 'E2E' },
        idToken: null,
      });
    const res = await http()
      .post(`/api/admin/lines/${line.id}/deliver`)
      .set('Cookie', `vpp_sid=${session.id}`)
      .send({ qty: 1, expected_delivered_qty: 0 })
      .expect(403);
    expect(res.body.code).toBe('CSRF_TOKEN_INVALID');
    expect(await f.deliveriesOf(line.id)).toHaveLength(0);
  });
});
