import type { DeliveryPerson } from '../src/modules/delivery/delivery.dto';
import { deliveryFixture } from './delivery.fixture';
import { AFTER_DEADLINE, BEFORE_DEADLINE } from './me-request.fixture';

// Kỳ 2026-11 hạn 10/11 17:00Z (fixture me-request)
const DEADLINE_11 = '2026-11-10T17:00:00.000Z';

describe('GET admin/periods/:ym/delivery-people', () => {
  const f = deliveryFixture('dpeople');
  const {
    A,
    ADMIN,
    B,
    as,
    at,
    cancel,
    customLine,
    deliver,
    freeze,
    http,
    put,
    review,
    seed,
    stockItem,
  } = f;

  const people = async (ym = '2026-11') =>
    (
      (
        await as(
          http().get(`/api/admin/periods/${ym}/delivery-people`),
          ADMIN,
          'admin',
        ).expect(200)
      ).body as { ym: string; people: DeliveryPerson[] }
    ).people;
  const mine = async (sub: string, ym = '2026-11') =>
    (await people(ym)).find((p) => p.user_sub === sub);
  // Chuẩn: A cần 3, B cần 10, kho 10
  const scenario = async () => {
    const item = await stockItem(10, 10);
    at(BEFORE_DEADLINE);
    const ra = await seed([{ item_id: item, qty: 3 }], A);
    const rb = await seed([{ item_id: item, qty: 10 }], B);
    freeze(AFTER_DEADLINE);
    return { item, la: ra.lines[0], lb: rb.lines[0], ra, rb };
  };

  it('A cần 3, B cần 10, tồn 10: cả hai pending, stock_qty 10', async () => {
    const { la, lb } = await scenario();
    const a = await mine(A);
    const b = await mine(B);
    expect([a?.status, b?.status]).toEqual(['pending', 'pending']);
    expect(a?.lines[0]).toMatchObject({
      line_id: la.id,
      remaining_qty: 3,
      stock_qty: 10,
      is_debt: false,
      period_ym: '2026-11',
    });
    expect(b?.lines[0]).toMatchObject({ line_id: lb.id, remaining_qty: 10 });
    expect(a).toMatchObject({ owed_lines: 0, open_lines: 1 });
  });

  it('A nhận đủ → done, xuất hiện kèm dòng đã giao', async () => {
    const { la } = await scenario();
    await deliver(la.id, { qty: 3, expected_delivered_qty: 0 }).expect(200);
    const a = await mine(A);
    expect(a?.status).toBe('done');
    expect(a?.lines).toHaveLength(1);
    expect(a?.lines[0]).toMatchObject({ delivered_qty: 3, remaining_qty: 0 });
  });

  it('B giao 7/10 (giao thiếu) → vẫn Chưa nhận kỳ 11 (pending, has_pending); sang kỳ 12 B có dòng is_debt remaining 3, request_id kỳ 12 null nếu B không đăng ký → status debt', async () => {
    const { lb } = await scenario();
    await deliver(lb.id, { qty: 7, expected_delivered_qty: 0 }).expect(200);
    const b11 = await mine(B);
    expect(b11?.status).toBe('pending');
    expect(b11).toMatchObject({
      open_lines: 1,
      owed_lines: 0,
      has_pending: true,
      has_debt: false,
    });
    expect(b11?.lines[0].remaining_qty).toBe(3);

    freeze('2026-12-11T03:00:00Z');
    const b12 = await mine(B, '2026-12');
    expect(b12).toMatchObject({
      status: 'debt',
      request_id: null,
      owed_lines: 1,
      open_lines: 0,
      has_pending: false,
      has_debt: true,
    });
    expect(b12?.lines).toHaveLength(1);
    expect(b12?.lines[0]).toMatchObject({
      is_debt: true,
      remaining_qty: 3,
      period_ym: '2026-11',
    });
    // A chưa nhận gì → cũng nợ 3 ở kỳ 12; chỉ người hết nợ mới biến mất
    expect((await mine(A, '2026-12'))?.status).toBe('debt');
  });

  it('có phiếu kỳ 12 mới: dòng nợ trước, dòng kỳ 12 sau, status pending', async () => {
    const { lb } = await scenario();
    await deliver(lb.id, { qty: 7, expected_delivered_qty: 0 }).expect(200);
    const item = await stockItem(5);
    at('2026-11-20T03:00:00Z');
    const r12 = (
      await put(
        { ym: '2026-12', lines: [{ item_id: item, qty: 2 }] },
        B,
      ).expect(200)
    ).body as { request: { id: string } };
    freeze('2026-12-11T03:00:00Z');
    const b = await mine(B, '2026-12');
    expect(b?.status).toBe('pending');
    expect(b?.request_id).toBe(r12.request.id);
    expect(b?.lines.map((l) => l.is_debt)).toEqual([true, false]);
    expect(b).toMatchObject({ owed_lines: 1, open_lines: 1 });
  });

  it('dòng bị từ chối không xuất hiện; dòng ngoài DM chờ duyệt có review_status pending, ảnh của dòng', async () => {
    at(BEFORE_DEADLINE);
    const c = await customLine(A, 'Bìa còng riêng');
    const d = await customLine(B, 'Kẹp loại');
    await review(d.line.id, { action: 'reject', note: 'không mua' }).expect(
      200,
    );
    freeze(AFTER_DEADLINE);
    const a = await mine(A);
    expect(a?.lines[0]).toMatchObject({
      review_status: 'pending',
      item_id: null,
      name: 'Bìa còng riêng',
      stock_qty: null,
      image_file_id: c.img,
    });
    expect(await mine(B)).toBeUndefined();
  });

  const setName = (sub: string, name: string | null) =>
    f
      .pool()
      .query('UPDATE users SET full_name = $2 WHERE sub = $1', [sub, name]);
  const order = async () =>
    (await people()).map((p) => p.user_sub).filter((s) => s === A || s === B);

  it('sắp xếp theo tên tiếng Việt: "Dũng" trước "Đào"', async () => {
    await scenario();
    await setName(A, 'Đào');
    await setName(B, 'Dũng');
    expect(await order()).toEqual([B, A]);
  });

  it('trùng full_name → xếp theo user_sub', async () => {
    await scenario();
    await setName(A, 'Trùng Tên');
    await setName(B, 'Trùng Tên');
    expect(await order()).toEqual([A, B].sort());
  });

  it('full_name null vẫn được liệt kê (xếp đầu)', async () => {
    await scenario();
    await setName(A, null);
    await setName(B, 'Bình');
    const list = await order();
    expect(list).toEqual([A, B]);
    expect((await mine(A))?.full_name).toBeNull();
  });

  it('dòng nợ đã hủy phần còn lại (remaining 0) không xuất hiện kỳ sau', async () => {
    const { lb } = await scenario();
    await cancel(lb.id, {
      reason: 'Người đã nghỉ',
      expected_delivered_qty: 0,
      expected_qty: 10,
    }).expect(200);
    freeze('2026-12-11T03:00:00Z');
    expect(await mine(B, '2026-12')).toBeUndefined();
  });

  it('deadline − 1 ms → 409 PERIOD_NOT_LOCKED', async () => {
    freeze(new Date(Date.parse(DEADLINE_11) - 1).toISOString());
    const res = await as(
      http().get('/api/admin/periods/2026-11/delivery-people'),
      ADMIN,
      'admin',
    ).expect(409);
    expect((res.body as { code: string }).code).toBe('PERIOD_NOT_LOCKED');
  });

  it('đúng deadline → 200', async () => {
    freeze(DEADLINE_11);
    await as(
      http().get('/api/admin/periods/2026-11/delivery-people'),
      ADMIN,
      'admin',
    ).expect(200);
  });

  it('kỳ sau kỳ mở → 400 INVALID_PERIOD; kỳ đã qua không có dòng periods → 200 rỗng', async () => {
    freeze(AFTER_DEADLINE);
    const res = await as(
      http().get('/api/admin/periods/2031-01/delivery-people'),
      ADMIN,
      'admin',
    ).expect(400);
    expect((res.body as { code: string }).code).toBe('INVALID_PERIOD');
    const past = await as(
      http().get('/api/admin/periods/2003-01/delivery-people'),
      ADMIN,
      'admin',
    ).expect(200);
    expect((past.body as { people: unknown[] }).people).toEqual([]);
  });

  it('member gọi → 403', async () => {
    freeze(AFTER_DEADLINE);
    await as(
      http().get('/api/admin/periods/2026-11/delivery-people'),
      A,
    ).expect(403);
  });

  it('ym sai định dạng → 400 INVALID_PERIOD', async () => {
    const res = await as(
      http().get('/api/admin/periods/2026-13/delivery-people'),
      ADMIN,
      'admin',
    ).expect(400);
    expect((res.body as { code: string }).code).toBe('INVALID_PERIOD');
  });
});
