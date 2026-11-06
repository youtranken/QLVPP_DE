import type { Pool } from 'pg';
import { snapshotsFixture } from './report-snapshots.fixture';

export interface ArrivalRow {
  item_id: string;
  key: string;
  name: string;
  ordered: number;
  received: number;
  remaining: number;
  stock_qty: number;
  usable: boolean;
  inactive_reason: string | null;
  adm_out: boolean;
  adm_out_final: boolean;
  reduced_after_snapshot: number;
}

export interface ArrivalsPlan {
  snapshot: { id: string; kind: string; created_at: string } | null;
  no_order: { at: string; by_name: string | null } | null;
  batches: {
    at: string;
    actor_name: string | null;
    items: number;
    units: number;
    note: string | null;
  }[];
  rows: ArrivalRow[];
  custom: {
    key: string;
    name: string;
    unit: string;
    ordered: number;
    received: number;
    remaining: number;
    adm_out: boolean;
  }[];
  makeup: {
    ym: string;
    rows: {
      key: string;
      item_id: string | null;
      name: string;
      unit: string;
      ordered: number;
      received: number;
      adm_owed: number;
    }[];
  }[];
}

// custom_receipts có FK kỳ không CASCADE: xóa trước khi fixture dọn kỳ; dấu ADM hết hàng của suite dọn mỗi ca
async function clearArrivals(pool: Pool, suffix: string): Promise<void> {
  const mine = `e2e-req-%-${suffix}`;
  await pool.query('DELETE FROM custom_receipts WHERE created_by LIKE $1', [
    mine,
  ]);
  await pool.query('DELETE FROM period_adm_out WHERE marked_by LIKE $1', [
    mine,
  ]);
}

export function arrivalsFixture(tag: string) {
  beforeEach(() => clearArrivals(f.pool(), f.SUFFIX));
  afterAll(() => clearArrivals(f.pool(), f.SUFFIX));
  const f = snapshotsFixture(tag);
  const { ADMIN, as, http, pool } = f;
  const dir = (ym: string) => `/api/admin/periods/${ym}`;
  const enc = encodeURIComponent;

  const ensurePeriod = (ym: string) =>
    pool().query(
      `INSERT INTO periods (ym, deadline) VALUES ($1::date, $1::date + interval '9 days 17 hours')
       ON CONFLICT (ym) DO NOTHING`,
      [`${ym}-01`],
    );
  const planRes = (ym: string) =>
    as(http().get(`${dir(ym)}/arrivals-plan`), ADMIN, 'admin');
  const plan = async (ym: string) =>
    (await planRes(ym).expect(200)).body as ArrivalsPlan;
  const rowOf = async (ym: string, item: string) =>
    (await plan(ym)).rows.find((r) => r.item_id === item);
  const markOut = (ym: string, key: string) =>
    as(http().put(`${dir(ym)}/adm-out/${enc(key)}`), ADMIN, 'admin');
  const unmarkOut = (ym: string, key: string) =>
    as(http().delete(`${dir(ym)}/adm-out/${enc(key)}`), ADMIN, 'admin');
  const closeOwed = (ym: string, key: string) =>
    as(http().put(`${dir(ym)}/adm-owed-closed/${enc(key)}`), ADMIN, 'admin');
  const reopenOwed = (ym: string, key: string) =>
    as(http().delete(`${dir(ym)}/adm-owed-closed/${enc(key)}`), ADMIN, 'admin');
  const receipts = (body: object) =>
    as(http().post('/api/admin/stock/receipts'), ADMIN, 'admin').send(body);
  const customReceive = (ym: string, body: object) =>
    as(http().post(`${dir(ym)}/custom-receipts`), ADMIN, 'admin').send(body);
  const customKey = async (lineId: string) =>
    (
      await pool().query<{ key: string }>(
        `SELECT 'custom:' || jsonb_build_array(lower(trim(custom_name)), lower(trim(custom_unit)))::text AS key
         FROM request_lines WHERE id = $1`,
        [lineId],
      )
    ).rows[0].key;
  const purchase = (item: string, qty: number, ym: string, at: string) =>
    pool().query(
      `INSERT INTO stock_movements (item_id, delta, reason, note, actor_sub, receipt_ym, created_at)
       VALUES ($1, $2, 'purchase', $3, $4, $5::date, $6::timestamptz)`,
      [item, qty, `Hàng về kỳ ${ym}`, ADMIN, `${ym}-01`, at],
    );
  const auditRows = async (action: string, objectId: string) =>
    (
      await pool().query<{ actor: string; detail: Record<string, unknown> }>(
        'SELECT actor, detail FROM audit_log WHERE action = $1 AND object_id = $2 ORDER BY created_at, id',
        [action, objectId],
      )
    ).rows;
  const line = async (id: string) =>
    (
      await pool().query<{
        qty: number;
        delivered_qty: number;
        cancelled_qty: number;
        cancel_note: string | null;
      }>(
        'SELECT qty, delivered_qty, cancelled_qty, cancel_note FROM request_lines WHERE id = $1',
        [id],
      )
    ).rows[0];

  return {
    ...f,
    ensurePeriod,
    planRes,
    plan,
    rowOf,
    markOut,
    unmarkOut,
    closeOwed,
    reopenOwed,
    receipts,
    customReceive,
    customKey,
    purchase,
    auditRows,
    line,
  };
}
