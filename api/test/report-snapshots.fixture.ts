import ExcelJS from 'exceljs';
import type { Pool } from 'pg';
import type { Response } from 'supertest';
import type { SnapshotData } from '../src/modules/reports/report.types';
import { reportsFixture } from './reports.fixture';

export type Snapshot = SnapshotData & {
  id: string;
  kind: string;
  period_ym: string;
};

export interface SentView {
  id: string;
  kind: string;
  created_at: string;
  items_count: number;
  units_total: number;
  replaces: { id: string; created_at: string } | null;
  data: SnapshotData;
}

export interface SendState {
  state: 'unsent' | 'no_order' | 'sent';
  no_order_at: string | null;
  no_order_by_name: string | null;
  sent: SentView | null;
  changed_after: boolean;
  changed_at: string | null;
  delivered_since: Record<string, number>;
  adm_cancelled_since: Record<string, number>;
}

export interface SnapshotListItem {
  id: string;
  kind: string;
  created_at: string;
  created_by_sub: string;
  created_by_name: string | null;
}

const binary = (
  res: Response,
  done: (err: Error | null, body: Buffer) => void,
) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => done(null, Buffer.concat(chunks)));
};

export function snapshotsFixture(tag: string) {
  const f = reportsFixture(tag);
  const { ADMIN, SUFFIX, as, http, pool } = f;

  f.onCleanup(async (p) => {
    await p.query('DELETE FROM report_snapshots WHERE created_by_sub LIKE $1', [
      `e2e-req-%-${SUFFIX}`,
    ]);
    await p.query(
      'UPDATE periods SET no_order_at = NULL, no_order_by = NULL WHERE no_order_by LIKE $1',
      [`e2e-req-%-${SUFFIX}`],
    );
  });

  const create = (ym: string, body: object, sub = ADMIN, role = 'admin') =>
    as(http().post(`/api/admin/reports/${ym}/snapshots`), sub, role).send(body);
  const createOk = async (ym: string, body: object = { kind: 'xlsx' }) =>
    (await create(ym, body).expect(201)).body as {
      id: string;
      kind: string;
      created_at: string;
      created_by: { sub: string; name: string | null };
    };
  const getSnapshot = (id: string) =>
    as(http().get(`/api/admin/reports/snapshots/${id}`), ADMIN, 'admin');
  const snapshot = async (id: string) =>
    (await getSnapshot(id).expect(200)).body as Snapshot;
  const list = async (ym: string) =>
    (
      (
        await as(
          http().get(`/api/admin/reports/${ym}/snapshots`),
          ADMIN,
          'admin',
        ).expect(200)
      ).body as { items: SnapshotListItem[] }
    ).items;
  const exportXlsx = (id: string, query = '') =>
    as(
      http().get(`/api/admin/reports/snapshots/${id}/export.xlsx${query}`),
      ADMIN,
      'admin',
    )
      .buffer(true)
      .parse(binary);
  const workbook = async (res: Response) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(new Uint8Array(res.body as Buffer).buffer);
    return wb;
  };
  const binaryError = (res: Response) =>
    JSON.parse((res.body as Buffer).toString()) as {
      code: string;
      fields?: string[];
    };
  const auditCount = async (objectId: string) =>
    (
      await pool().query<{ n: number }>(
        'SELECT count(*)::int AS n FROM audit_log WHERE object_id = $1',
        [objectId],
      )
    ).rows[0].n;
  const ymDir = (ym: string) => `/api/admin/periods/${ym}`;
  const sent = (ym: string) =>
    as(http().get(`/api/admin/reports/${ym}/sent`), ADMIN, 'admin');
  const sendState = async (ym: string) =>
    (
      await as(http().get(`${ymDir(ym)}/send-state`), ADMIN, 'admin').expect(
        200,
      )
    ).body as SendState;
  const noOrder = (ym: string, body: object = {}, sub = ADMIN) =>
    as(http().post(`${ymDir(ym)}/no-order`), sub, 'admin').send(body);
  const clearNoOrder = (ym: string) =>
    as(http().delete(`${ymDir(ym)}/no-order`), ADMIN, 'admin');
  // Bản chốt cũ/rỗng không tạo được qua API (ORDER_EMPTY) → gieo thẳng JSON như dữ liệu đã có
  const insertSnapshot = async (
    ym: string,
    data: object,
    createdAt: string,
    kind = 'print',
  ) =>
    (
      await pool().query<{ id: string }>(
        `INSERT INTO report_snapshots (period_ym, kind, data, created_by_sub, created_at)
         VALUES ($1::date, $2, $3::jsonb, $4, $5::timestamptz) RETURNING id`,
        [`${ym}-01`, kind, JSON.stringify(data), ADMIN, createdAt],
      )
    ).rows[0].id;
  // Kỳ dùng chung giữa các suite: "bản mới nhất"/cờ phải sạch trước mỗi ca
  const resetPeriod = (ym: string, p: Pool = pool()) =>
    Promise.all([
      p.query(
        'UPDATE periods SET no_order_at = NULL, no_order_by = NULL WHERE ym = $1::date',
        [`${ym}-01`],
      ),
      p.query('DELETE FROM report_snapshots WHERE period_ym = $1::date', [
        `${ym}-01`,
      ]),
    ]);
  const putSignatureBoxes = (signature_boxes: object[]) =>
    as(http().put('/api/admin/config'), ADMIN, 'admin')
      .send({ signature_boxes })
      .expect(200);

  return {
    ...f,
    create,
    createOk,
    getSnapshot,
    snapshot,
    list,
    exportXlsx,
    workbook,
    binaryError,
    auditCount,
    putSignatureBoxes,
    sent,
    sendState,
    noOrder,
    clearNoOrder,
    insertSnapshot,
    resetPeriod,
  };
}
