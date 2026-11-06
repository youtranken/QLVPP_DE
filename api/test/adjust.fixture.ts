import { BEFORE_DEADLINE, meRequestFixture } from './me-request.fixture';
import type { RequestView } from './me-request.fixture';

export type Cut = { qty: number; reason_code?: string; reason_note?: string };

export interface Bell {
  event_id: string;
  params: {
    ym: string;
    lines: {
      name: string;
      name_en: string | null;
      unit: string;
      before: number;
      after: number;
      reason_code: string;
      reason_note: string | null;
    }[];
    more: number;
  };
  link: string;
  read_at: string | null;
}

// Bản ghi điều chỉnh chỉ-thêm (không xóa được) → mỗi test chuông dùng chủ phiếu mới để params không lẫn test trước
export function adjustFixture(tag: string) {
  const f = meRequestFixture(tag);
  const { ADMIN, SUFFIX, as, at, http, newItem, pool, save, view } = f;
  let owners = 0;

  f.onCleanup((p) =>
    p.query('DELETE FROM in_app_notifications WHERE user_sub LIKE $1', [
      `e2e-req-%-${SUFFIX}`,
    ]),
  );

  const newOwner = async (status = 'active') => {
    const sub = `e2e-req-o${++owners}-${SUFFIX}`;
    await pool().query(
      `INSERT INTO users (sub, full_name, department, status) VALUES ($1, $2, 'Phòng CT', $3)`,
      [sub, `Chủ phiếu ${owners}`, status],
    );
    return sub;
  };

  // Lưu trước hạn bằng nhân viên rồi dời đồng hồ: Hành chính chỉ thấy phiếu kỳ đã khóa
  const seed = async (qtys: number[], sub = f.A) => {
    at(BEFORE_DEADLINE);
    const items = await Promise.all(qtys.map(() => newItem({ max_qty: 10 })));
    return view(
      await save(
        items.map((item_id, i) => ({ item_id, qty: qtys[i] })),
        {},
        sub,
      ).expect(200),
    );
  };

  const adminPut = (id: string, body: object, role = 'admin') =>
    as(http().put(`/api/admin/requests/${id}/lines`), ADMIN, role).send(body);

  // Mọi dòng của phiếu kèm expected_qty; dòng có trong `cuts` thì giảm
  const linesOf = (r: RequestView, cuts: Record<number, Cut> = {}) =>
    r.lines.map((l, i) => ({
      id: l.id,
      expected_qty: l.qty,
      ...(cuts[i] ?? { qty: l.qty }),
    }));

  const cut = (r: RequestView, cuts: Record<number, Cut>, extra = {}) =>
    adminPut(r.id, {
      expected_updated_at: r.updated_at,
      lines: linesOf(r, cuts),
      ...extra,
    });

  const recordsOf = async (requestId: string) =>
    (
      await pool().query<{
        batch_id: string;
        line_id: string;
        qty_before: number;
        qty_after: number;
        reason_code: string;
        reason_note: string | null;
        actor_sub: string;
        created_at: Date;
      }>(
        `SELECT batch_id, line_id, qty_before, qty_after, reason_code, reason_note, actor_sub, created_at
         FROM request_line_adjustments WHERE request_id = $1 ORDER BY created_at, line_id`,
        [requestId],
      )
    ).rows;

  const bellsOf = async (sub: string, topic = 'line_adjusted') =>
    (
      await pool().query<Bell>(
        `SELECT event_id, params, link, read_at FROM in_app_notifications
         WHERE user_sub = $1 AND topic = $2 ORDER BY created_at, event_id`,
        [sub, topic],
      )
    ).rows;

  return { ...f, newOwner, seed, adminPut, linesOf, cut, recordsOf, bellsOf };
}
