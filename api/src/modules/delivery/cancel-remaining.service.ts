import { Inject, Injectable } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { CatalogService } from '../catalog/catalog.service';
import { eventIds } from '../notifications/notification-events';
import { NotificationsService } from '../notifications/notifications.service';
import { PeriodsService } from '../periods/periods.service';
import { LineDeliveryStore } from '../requests/line-delivery.store';
import type { LockedLine } from '../requests/line-delivery.store';
import { lineNotFound } from '../requests/request-errors';
import { cancelReasonRequired, staleCancel } from './delivery-errors';
import type { CancelBody, CancelResult } from './delivery.dto';
import { assertDeliverable } from './delivery.service';

const REASON_MIN = 3;

@Injectable()
export class CancelRemainingService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly periods: PeriodsService,
    private readonly lines: LineDeliveryStore,
    private readonly catalog: CatalogService,
    private readonly audit: AuditWriterService,
    private readonly notifications: NotificationsService,
  ) {}

  async cancelRemaining(
    lineId: string,
    body: CancelBody,
    actor: string,
  ): Promise<CancelResult> {
    const reason = body.reason?.trim() ?? '';
    if (reason.length < REASON_MIN) throw cancelReasonRequired();
    const now = this.clock.now();
    return this.db.transaction(async (tx) => {
      const line = await this.lines.lockLine(tx, lineId);
      if (!line) throw lineNotFound();
      await this.periods.assertLocked(line.period_ym, now, tx);
      assertDeliverable(line);
      if (
        line.delivered_qty !== body.expected_delivered_qty ||
        line.qty !== body.expected_qty
      ) {
        throw staleCancel(line);
      }
      const result = await this.lines.cancelRemaining(tx, lineId, reason, now);
      if (result.cancelled_now === 0) return result;
      await this.audit.appendWithin(tx, {
        actor,
        action: 'line.cancel_remaining',
        objectType: 'request_line',
        objectId: line.id,
        detail: {
          request_id: line.request_id,
          before: { cancelled_qty: line.cancelled_qty },
          after: { cancelled_qty: result.line.cancelled_qty },
          reason,
        },
      });
      await this.lines.touchRequest(tx, line.request_id, now);
      await this.notifyOwner(tx, line, result, reason, now);
      return result;
    });
  }

  // Không gọi notifyIfComplete: hủy nợ làm phiếu đủ thì không báo "đã giao đủ"
  private async notifyOwner(
    tx: Tx,
    line: LockedLine,
    result: CancelResult,
    reason: string,
    now: Date,
  ): Promise<void> {
    const item = line.item_id
      ? (await this.catalog.itemFacts([line.item_id], tx)).get(line.item_id)
      : undefined;
    await this.notifications.notifyWithin(tx, {
      eventId: eventIds.lineCancelled(line.id, result.line.cancelled_qty),
      recipients: [line.user_sub],
      topic: 'line_cancelled',
      params: {
        ym: line.period_ym,
        name: item?.name ?? line.custom_name,
        name_en: item?.name_en ?? null,
        unit: item?.unit ?? line.custom_unit,
        qty: result.cancelled_now,
        reason,
      },
      link: `/history/${line.period_ym}`,
      now,
    });
  }
}
