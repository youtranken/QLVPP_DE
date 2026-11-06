import type { Pool } from 'pg';
import { AFTER_DEADLINE, BEFORE_DEADLINE } from './me-request.fixture';
import { reviewFixture } from './review.fixture';

// Kỳ 12 đã khóa sổ: dòng kỳ 11 là nợ tháng trước (Hủy nợ được)
export const DEBT_AT = '2026-12-11T03:00:00Z';

export interface DeliverResult {
  line: {
    id: string;
    qty: number;
    delivered_qty: number;
    cancelled_qty: number;
  };
  movement_id: string | null;
  stock_qty: number | null;
  request_complete: boolean;
}

export interface BacklogLine {
  line_id: string;
  request_id: string;
  period_ym: string;
  user_sub: string;
  full_name: string | null;
  department: string | null;
  user_status: string;
  item_id: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  qty: number;
  delivered_qty: number;
  cancelled_qty: number;
  remaining_qty: number;
  stock_qty: number | null;
}

export interface BacklogGroup {
  key: string;
  label: Record<string, string | null>;
  remaining_qty: number;
  lines: BacklogLine[];
}

// Đợt giao/biến động kho chặn xóa phiếu và món (RESTRICT) → dọn trước hook dọn của reviewFixture
async function clearDeliveries(pool: Pool, suffix: string): Promise<void> {
  const mine = `e2e-req-%-${suffix}`;
  const lines = `SELECT l.id FROM request_lines l JOIN requests r ON r.id = l.request_id
                 WHERE r.user_sub LIKE $1`;
  await pool.query(`DELETE FROM line_deliveries WHERE line_id IN (${lines})`, [
    mine,
  ]);
  await pool.query(
    `DELETE FROM stock_movements WHERE ref_line_id IN (${lines})
       OR item_id IN (SELECT id FROM items WHERE name LIKE $2)`,
    [mine, `e2e-req-item-${suffix}-%`],
  );
  await pool.query('DELETE FROM in_app_notifications WHERE user_sub LIKE $1', [
    mine,
  ]);
}

export function deliveryFixture(tag: string) {
  // Đăng ký trước reviewFixture: jest chạy beforeEach/afterAll theo thứ tự khai báo
  beforeEach(() => clearDeliveries(f.pool(), f.SUFFIX));
  afterAll(() => clearDeliveries(f.pool(), f.SUFFIX));
  const f = reviewFixture(tag);
  const { ADMIN, A, as, at, http, newItem, pool, seed, freeze } = f;

  const deliver = (lineId: string, body: object, sub = ADMIN, role = 'admin') =>
    as(http().post(`/api/admin/lines/${lineId}/deliver`), sub, role).send(body);
  const deliverAll = (requestId: string, sub = ADMIN, role = 'admin') =>
    as(http().post(`/api/admin/requests/${requestId}/deliver-all`), sub, role);
  const cancel = (lineId: string, body: object, sub = ADMIN, role = 'admin') =>
    as(
      http().post(`/api/admin/lines/${lineId}/cancel-remaining`),
      sub,
      role,
    ).send(body);
  const backlog = async (by: 'item' | 'person') => {
    const res = await as(
      http().get(`/api/admin/backlog?by=${by}`),
      ADMIN,
      'admin',
    ).expect(200);
    return (res.body as { groups: BacklogGroup[] }).groups;
  };
  const bellsOf = async (topic: string, sub = A) =>
    (
      await pool().query<{
        event_id: string;
        params: Record<string, unknown>;
        link: string | null;
      }>(
        'SELECT event_id, params, link FROM in_app_notifications WHERE user_sub = $1 AND topic = $2 ORDER BY created_at, event_id',
        [sub, topic],
      )
    ).rows;
  const stockItem = async (stock: number, maxQty = 10) => {
    const id = await newItem({ max_qty: maxQty });
    await pool().query('UPDATE items SET stock_qty = $2 WHERE id = $1', [
      id,
      stock,
    ]);
    return id;
  };
  const stockOf = async (itemId: string) =>
    (
      await pool().query<{ stock_qty: number }>(
        'SELECT stock_qty FROM items WHERE id = $1',
        [itemId],
      )
    ).rows[0].stock_qty;
  const movementsOf = async (lineId: string) =>
    (
      await pool().query<{ id: string; delta: number; reason: string }>(
        'SELECT id, delta, reason FROM stock_movements WHERE ref_line_id = $1',
        [lineId],
      )
    ).rows;
  const deliveriesOf = async (lineId: string) =>
    (
      await pool().query<{ qty: number; movement_id: string | null }>(
        'SELECT qty, movement_id FROM line_deliveries WHERE line_id = $1 ORDER BY created_at',
        [lineId],
      )
    ).rows;
  const notificationsOf = async (sub = A) =>
    (
      await pool().query<{
        event_id: string;
        topic: string;
        params: Record<string, unknown>;
        link: string | null;
      }>(
        "SELECT event_id, topic, params, link FROM in_app_notifications WHERE user_sub = $1 AND topic = 'request_delivered' ORDER BY created_at, event_id",
        [sub],
      )
    ).rows;
  // Phiếu một dòng món danh mục, tạo trước hạn rồi đứng đồng hồ sau hạn (kỳ đã khóa)
  const lockedLine = async (stock: number, qty = 5, sub = A) => {
    const item = await stockItem(stock);
    at(BEFORE_DEADLINE);
    const request = await seed([{ item_id: item, qty }], sub);
    freeze(AFTER_DEADLINE);
    return { item, request, line: request.lines[0] };
  };
  const debtLine = async (stock: number, qty = 5, sub = A) => {
    const seeded = await lockedLine(stock, qty, sub);
    freeze(DEBT_AT);
    return seeded;
  };

  return {
    ...f,
    deliver,
    deliverAll,
    cancel,
    backlog,
    bellsOf,
    stockItem,
    stockOf,
    movementsOf,
    deliveriesOf,
    notificationsOf,
    lockedLine,
    debtLine,
  };
}
