import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import type { RequestIdentity } from '../auth/identity.types';
import { PeriodsService } from '../periods/periods.service';
import { changedAt } from './changed-after';
import { clearNoOrderFlag, lockNoOrderFlag } from './no-order-flag';
import { resolveOrderQty } from './order-qty';
import { ReportsService } from './reports.service';
import {
  alreadySent,
  latestSent,
  orderNotEmpty,
  orderTotals,
} from './sent-snapshot';
import type { SentSnapshot } from './sent-snapshot';
import type { NoOrderBody } from './snapshot.dto';

export interface SendState {
  state: 'unsent' | 'no_order' | 'sent';
  no_order_at: string | null;
  no_order_by_name: string | null;
  sent: SentSnapshot | null;
  changed_after: boolean;
  changed_at: string | null;
}

@Injectable()
export class SendStateService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly periods: PeriodsService,
    private readonly reports: ReportsService,
    private readonly audit: AuditWriterService,
  ) {}

  async state(ym: string, now: Date): Promise<SendState> {
    await this.periods.assertLocked(ym, now);
    const sent = await latestSent(this.db, ym);
    const { rows } = await this.db.execute<{
      no_order_at: Date | string | null;
      no_order_by_name: string | null;
    }>(sql`
      SELECT p.no_order_at, coalesce(u.full_name, p.no_order_by) AS no_order_by_name
      FROM periods p LEFT JOIN users u ON u.sub = p.no_order_by
      WHERE p.ym = ${ymToDate(ym)}::date`);
    const flag = rows[0];
    const changed = sent
      ? await changedAt(this.db, ym, new Date(sent.created_at))
      : null;
    return {
      state: sent ? 'sent' : flag?.no_order_at ? 'no_order' : 'unsent',
      no_order_at: flag?.no_order_at
        ? new Date(flag.no_order_at).toISOString()
        : null,
      no_order_by_name: flag?.no_order_at ? flag.no_order_by_name : null,
      sent,
      changed_after: changed !== null,
      changed_at: changed?.toISOString() ?? null,
    };
  }

  // Tổng đề nghị tính lại ở server từ order_qty gửi kèm (ô vắng = số mặc định)
  async markNoOrder(
    ym: string,
    body: NoOrderBody,
    actor: RequestIdentity,
    now: Date,
  ): Promise<{ no_order_at: string; no_order_by: string }> {
    await this.periods.assertLocked(ym, now);
    await this.periods.ensurePeriod(ym);
    return this.db.transaction(async (tx) => {
      const flag = await lockNoOrderFlag(tx, ym);
      if (await latestSent(tx, ym)) throw alreadySent();
      const report = await this.reports.build(ym, now, tx);
      const order = resolveOrderQty(report, body.order_qty);
      if (orderTotals(order).units_total > 0) throw orderNotEmpty();
      if (flag.no_order_at && flag.no_order_by) {
        return { no_order_at: flag.no_order_at, no_order_by: flag.no_order_by };
      }
      const at = now.toISOString();
      await tx.execute(sql`
        UPDATE periods SET no_order_at = ${at}::timestamptz, no_order_by = ${actor.sub}
        WHERE ym = ${ymToDate(ym)}::date`);
      await this.audit.appendWithin(tx, {
        actor: actor.sub,
        action: 'period.no_order',
        objectType: 'period',
        objectId: ym,
        detail: {
          ym,
          before: { no_order_at: null, no_order_by: null },
          after: { no_order_at: at, no_order_by: actor.sub },
        },
      });
      return { no_order_at: at, no_order_by: actor.sub };
    });
  }

  async clearNoOrder(
    ym: string,
    actor: RequestIdentity,
    now: Date,
  ): Promise<void> {
    await this.periods.assertLocked(ym, now);
    await this.db.transaction(async (tx) => {
      await lockNoOrderFlag(tx, ym);
      await clearNoOrderFlag(tx, this.audit, ym, actor.sub);
    });
  }
}
