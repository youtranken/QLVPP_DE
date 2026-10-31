import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import type { RequestIdentity } from '../auth/identity.types';
import { SystemConfigService } from '../config/system-config.service';
import { PeriodsService } from '../periods/periods.service';
import { invalidPeriod } from '../requests/request-errors';
import { UnitsService } from '../units/units.service';
import { UsersService } from '../users/users.service';
import { resolveOrderQty } from './order-qty';
import type { SignatureBox, SnapshotData } from './report.types';
import { ReportsService } from './reports.service';
import type { SnapshotBody } from './snapshot.dto';
import { withUnitNames } from './snapshot-unit-names';

export type StoredSnapshot = SnapshotData & {
  id: string;
  kind: string;
  period_ym: string;
};

@Injectable()
export class SnapshotsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly reports: ReportsService,
    private readonly periods: PeriodsService,
    private readonly config: SystemConfigService,
    private readonly users: UsersService,
    private readonly units: UnitsService,
    private readonly audit: AuditWriterService,
  ) {}

  async create(
    ym: string,
    body: SnapshotBody,
    actor: RequestIdentity,
    now: Date,
  ) {
    // Tạo kỳ trước khi mở tx REPEATABLE READ (ảnh dữ liệu không thấy dòng tx khác vừa chèn); kỳ cũ cần dòng cho FK
    const open = await this.periods.openPeriod(this.db, now);
    if (ym > open.ym) throw invalidPeriod();
    await this.periods.ensurePeriod(ym);
    const signature_boxes =
      await this.config.get<SignatureBox[]>('signature_boxes');
    const user = await this.users.findBySub(actor.sub);
    const created_by = {
      sub: actor.sub,
      name: user?.fullName ?? actor.fullName ?? null,
    };
    const created_at = now.toISOString();
    const id = await this.db.transaction(
      async (tx) => {
        const report = withUnitNames(
          await this.reports.build(ym, now, tx),
          await this.units.namesByCode(tx),
        );
        const data: SnapshotData = {
          ...report,
          order_qty: resolveOrderQty(report, body.order_qty),
          signature_boxes,
          created_by,
          created_at,
        };
        const { rows } = await tx.execute<{ id: string }>(sql`
          INSERT INTO report_snapshots (period_ym, kind, data, created_by_sub, created_at)
          VALUES (${ymToDate(ym)}::date, ${body.kind}, ${JSON.stringify(data)}::jsonb,
                  ${actor.sub}, ${created_at}::timestamptz)
          RETURNING id`);
        const snapshotId = rows[0].id;
        await this.audit.appendWithin(tx, {
          actor: actor.sub,
          action: 'report.snapshot_created',
          objectType: 'report_snapshot',
          objectId: snapshotId,
          detail: { ym, kind: body.kind, snapshot_id: snapshotId },
        });
        return snapshotId;
      },
      { isolationLevel: 'repeatable read' },
    );
    return { id, kind: body.kind, created_at, created_by };
  }

  async list(ym: string) {
    const { rows } = await this.db.execute<{
      id: string;
      kind: string;
      created_at: Date;
      created_by_sub: string;
      created_by_name: string | null;
    }>(sql`
      SELECT id, kind, created_at, created_by_sub,
             data->'created_by'->>'name' AS created_by_name
      FROM report_snapshots WHERE period_ym = ${ymToDate(ym)}::date
      ORDER BY created_at DESC, id DESC`);
    return {
      items: rows.map((r) => ({
        ...r,
        created_at: new Date(r.created_at).toISOString(),
      })),
    };
  }

  async get(id: string): Promise<StoredSnapshot> {
    const { rows } = await this.db.execute<{
      kind: string;
      period_ym: string;
      data: SnapshotData;
    }>(sql`
      SELECT kind, to_char(period_ym, 'YYYY-MM') AS period_ym, data
      FROM report_snapshots WHERE id = ${id}`);
    if (!rows[0]) {
      throw new NotFoundException({
        code: 'SNAPSHOT_NOT_FOUND',
        message: 'Không tìm thấy bản chốt.',
      });
    }
    const { data, kind, period_ym } = rows[0];
    return { ...data, id, kind, period_ym };
  }
}
