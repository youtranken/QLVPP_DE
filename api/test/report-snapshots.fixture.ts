import ExcelJS from 'exceljs';
import type { Response } from 'supertest';
import type { SnapshotData } from '../src/modules/reports/report.types';
import { reportsFixture } from './reports.fixture';

export type Snapshot = SnapshotData & {
  id: string;
  kind: string;
  period_ym: string;
};

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

  f.onCleanup((p) =>
    p.query('DELETE FROM report_snapshots WHERE created_by_sub LIKE $1', [
      `e2e-req-%-${SUFFIX}`,
    ]),
  );

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
  };
}
