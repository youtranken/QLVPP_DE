import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import type { RequestIdentity } from '../auth/identity.types';
import { SystemConfigService } from '../config/system-config.service';
import { PeriodsService } from '../periods/periods.service';
import { ReviewWriter } from '../requests/review-writer';
import { UnitsService } from '../units/units.service';
import { UsersService } from '../users/users.service';
import { pgSqlState } from '../../common/sql';
import { clearNoOrderFlag, lockNoOrderFlag } from './no-order-flag';
import { orderBasisOf } from './order-default';
import { resolveOrderQty } from './order-qty';
import type { SignatureBox, SnapshotData } from './report.types';
import { ReportsService } from './reports.service';
import {
  hasItemsSql,
  latestSent,
  noSentSnapshot,
  orderEmpty,
  orderTotals,
  sameContent,
  sameOrder,
} from './sent-snapshot';
import type { SentSnapshot } from './sent-snapshot';
import type { PreviewBody, SnapshotBody } from './snapshot.dto';
import { withUnitNames } from './snapshot-unit-names';

const MAX_ATTEMPTS = 3;

interface CreateContext {
  ym: string;
  body: SnapshotBody;
  actor: string;
  now: Date;
  signature_boxes: SignatureBox[];
  created_by: SnapshotData['created_by'];
}

export interface CreatedSnapshot {
  id: string;
  kind: string;
  created_at: string;
  created_by: SnapshotData['created_by'];
  reused: boolean;
  data: SnapshotData;
}

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
    private readonly reviews: ReviewWriter,
  ) {}

  async create(
    ym: string,
    body: SnapshotBody,
    actor: RequestIdentity,
    now: Date,
  ): Promise<CreatedSnapshot> {
    // Tạo kỳ trước khi mở tx REPEATABLE READ (ảnh dữ liệu không thấy dòng tx khác vừa chèn); kỳ cũ cần dòng cho FK
    await this.periods.assertLocked(ym, now);
    await this.periods.ensurePeriod(ym);
    const ctx: CreateContext = {
      ...(await this.contextOf(ym, body, actor, now)),
      body,
      actor: actor.sub,
    };
    // Đua với "không cần đề nghị" trên cùng dòng periods → 40001; làm lại thấy cờ đã ghi và tự xóa
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.db.transaction((tx) => this.createWithin(tx, ctx), {
          isolationLevel: 'repeatable read',
        });
      } catch (error) {
        if (pgSqlState(error) !== '40001' || attempt >= MAX_ATTEMPTS) {
          throw error;
        }
      }
    }
  }

  private async createWithin(
    tx: Tx,
    ctx: CreateContext,
  ): Promise<CreatedSnapshot> {
    const { ym, body, now, created_by } = ctx;
    const flag = await lockNoOrderFlag(tx, ym);
    await this.reviews.rejectPendingWithin(tx, ym, body, {
      actor: ctx.actor,
      now,
    });
    const content = await this.buildContent(tx, ctx);
    if (body.reuse_if_unchanged) {
      const same = await latestSent(tx, ym, body.kind);
      if (same && sameContent(same.data, content)) {
        return {
          id: same.id,
          kind: same.kind,
          created_at: same.created_at,
          created_by: same.data.created_by,
          reused: true,
          data: same.data,
        };
      }
    }
    const data = await this.withReplaces(tx, ym, content, created_by, now);
    const id = await this.insert(tx, ctx, data);
    if (flag.no_order_at) await clearNoOrderFlag(tx, this.audit, ym, ctx.actor);
    return {
      id,
      kind: body.kind,
      created_at: data.created_at,
      created_by,
      reused: false,
      data,
    };
  }

  // Phần nội dung chung của bản chốt và bản xem trước: báo cáo + tên ĐVT chụp + Đề nghị + ô ký
  private async buildContent(
    tx: Tx,
    ctx: Pick<CreateContext, 'ym' | 'now' | 'signature_boxes'> & {
      body: Pick<SnapshotBody, 'order_qty'>;
    },
  ) {
    const report = withUnitNames(
      await this.reports.build(ctx.ym, ctx.now, tx),
      await this.units.namesByCode(tx),
    );
    const order_qty = resolveOrderQty(report, ctx.body.order_qty);
    if (orderTotals(order_qty).units_total === 0) throw orderEmpty();
    return {
      ...report,
      order_qty,
      order_basis: orderBasisOf([...report.byItem, ...report.custom]),
      signature_boxes: ctx.signature_boxes,
    };
  }

  private async withReplaces(
    tx: Tx,
    ym: string,
    content: Awaited<ReturnType<SnapshotsService['buildContent']>>,
    created_by: SnapshotData['created_by'],
    now: Date,
  ): Promise<SnapshotData> {
    const prev = await latestSent(tx, ym);
    return {
      ...content,
      ...(prev && !sameOrder(prev.data.order_qty, content.order_qty)
        ? { replaces: { id: prev.id, created_at: prev.created_at, kind: prev.kind as 'print' | 'xlsx' } }
        : {}),
      created_by,
      created_at: now.toISOString(),
    };
  }

  // "Xem tổng kết": dựng đúng bản sẽ in nhưng không ghi gì (không tạo kỳ, không chèn bản, không audit, không đụng cờ)
  async preview(
    ym: string,
    body: PreviewBody,
    actor: RequestIdentity,
    now: Date,
  ): Promise<{ data: SnapshotData }> {
    await this.periods.assertLocked(ym, now);
    const ctx = await this.contextOf(ym, body, actor, now);
    const data = await this.db.transaction(
      async (tx) =>
        this.withReplaces(
          tx,
          ym,
          await this.buildContent(tx, ctx),
          ctx.created_by,
          now,
        ),
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
    return { data };
  }

  private async contextOf(
    ym: string,
    body: PreviewBody,
    actor: RequestIdentity,
    now: Date,
  ) {
    const user = await this.users.findBySub(actor.sub);
    return {
      ym,
      body,
      now,
      signature_boxes: await this.config.get<SignatureBox[]>('signature_boxes'),
      created_by: {
        sub: actor.sub,
        name: user?.fullName ?? actor.fullName ?? null,
      },
    };
  }

  private async insert(
    tx: Tx,
    ctx: CreateContext,
    data: SnapshotData,
  ): Promise<string> {
    const { ym, body, actor } = ctx;
    const { rows } = await tx.execute<{ id: string }>(sql`
      INSERT INTO report_snapshots (period_ym, kind, data, created_by_sub, created_at)
      VALUES (${ymToDate(ym)}::date, ${body.kind}, ${JSON.stringify(data)}::jsonb,
              ${actor}, ${data.created_at}::timestamptz)
      RETURNING id`);
    const id = rows[0].id;
    await this.audit.appendWithin(tx, {
      actor,
      action: 'report.snapshot_created',
      objectType: 'report_snapshot',
      objectId: id,
      detail: { ym, kind: body.kind, snapshot_id: id },
    });
    return id;
  }

  async sent(ym: string, now: Date): Promise<SentSnapshot> {
    await this.periods.assertLocked(ym, now);
    const sent = await latestSent(this.db, ym);
    if (!sent) throw noSentSnapshot();
    return sent;
  }

  async list(ym: string, now: Date) {
    await this.periods.assertLocked(ym, now);
    const { rows } = await this.db.execute<{
      id: string;
      kind: string;
      created_at: Date;
      created_by_sub: string;
      created_by_name: string | null;
      has_items: boolean;
      items_count: number;
      units_total: number;
    }>(sql`
      SELECT id, kind, created_at, created_by_sub,
             data->'created_by'->>'name' AS created_by_name,
             ${hasItemsSql} AS has_items,
             (SELECT count(*) FROM jsonb_each_text(data->'order_qty') e
              WHERE e.value::int > 0)::int AS items_count,
             (SELECT coalesce(sum(e.value::int), 0) FROM jsonb_each_text(data->'order_qty') e
              WHERE e.value::int > 0)::int AS units_total
      FROM report_snapshots WHERE period_ym = ${ymToDate(ym)}::date
      ORDER BY created_at DESC, id DESC`);
    return {
      items: rows.map((r) => ({
        ...r,
        created_at: new Date(r.created_at).toISOString(),
      })),
    };
  }

  async get(id: string, now: Date): Promise<StoredSnapshot> {
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
    await this.periods.assertLocked(period_ym, now);
    return { ...data, id, kind, period_ym };
  }
}
