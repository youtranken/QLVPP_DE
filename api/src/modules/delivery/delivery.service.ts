import { Inject, Injectable } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { StockService } from '../catalog/stock.service';
import type { StockResult } from '../catalog/stock.service';
import { eventIds } from '../notifications/notification-events';
import { NotificationsService } from '../notifications/notifications.service';
import { PeriodsService } from '../periods/periods.service';
import { LineDeliveryStore } from '../requests/line-delivery.store';
import type { LockedLine } from '../requests/line-delivery.store';
import { lineNotFound } from '../requests/request-errors';
import {
  deliverExceedsQty,
  lineNotReviewed,
  lineRejected,
  periodNotLocked,
  staleDelivery,
} from './delivery-errors';
import type { DeliverBody, DeliverResult } from './delivery.dto';
import * as repo from './delivery.repo';

@Injectable()
export class DeliveryService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly periods: PeriodsService,
    private readonly lines: LineDeliveryStore,
    private readonly stock: StockService,
    private readonly audit: AuditWriterService,
    private readonly notifications: NotificationsService,
  ) {}

  async deliverLine(
    lineId: string,
    body: DeliverBody,
    actor: string,
  ): Promise<DeliverResult> {
    const now = this.clock.now();
    return this.db.transaction(async (tx) => {
      const line = await this.lines.lockLine(tx, lineId);
      if (!line) throw lineNotFound();
      await this.assertPeriodLocked(tx, line.period_ym, now);
      assertDeliverable(line);
      if (line.delivered_qty !== body.expected_delivered_qty) {
        throw staleDelivery(line.delivered_qty);
      }
      const result = await this.deliverWithin(tx, line, body.qty, actor, now);
      await this.lines.touchRequest(tx, line.request_id, now);
      const complete = await this.notifyIfComplete(tx, line, now);
      return { ...result, request_complete: complete };
    });
  }

  // Khóa dòng (lockLine) và kiểm kỳ là việc của người gọi; deliver-all dùng lại trong SAVEPOINT từng dòng
  async deliverWithin(
    tx: Tx,
    line: LockedLine,
    qty: number,
    actor: string,
    now: Date,
  ): Promise<Omit<DeliverResult, 'request_complete'>> {
    assertDeliverable(line);
    const remaining = remainingOf(line);
    if (qty > remaining) throw deliverExceedsQty(remaining);
    const taken = line.item_id
      ? await this.stock.takeForDeliveryWithin(tx, {
          itemId: line.item_id,
          qty,
          lineId: line.id,
          actor,
          now,
        })
      : null;
    const moved = await this.lines.addDelivered(
      tx,
      line.id,
      qty,
      line.delivered_qty,
      now,
    );
    // Dòng đã khóa FOR UPDATE nên không xảy ra; điều kiện vẫn là luật của chính câu UPDATE
    if (!moved) throw staleDelivery(line.delivered_qty);
    const movementId = taken?.movement_id ?? null;
    await repo.insertLineDelivery(tx, {
      lineId: line.id,
      qty,
      movementId,
      actor,
      now,
    });
    await this.auditDelivered(tx, line, qty, movementId, actor);
    return toResult(line, qty, taken);
  }

  private async auditDelivered(
    tx: Tx,
    line: LockedLine,
    qty: number,
    movementId: string | null,
    actor: string,
  ): Promise<void> {
    await this.audit.appendWithin(tx, {
      actor,
      action: 'line.delivered',
      objectType: 'request_line',
      objectId: line.id,
      detail: {
        request_id: line.request_id,
        before: { delivered_qty: line.delivered_qty },
        after: { delivered_qty: line.delivered_qty + qty },
        qty,
        movement_id: movementId,
      },
    });
  }

  // Chỉ gọi sau một đợt giao thật: hủy nợ làm phiếu đủ thì không báo "đã giao đủ"
  async notifyIfComplete(
    tx: Tx,
    line: LockedLine,
    now: Date,
  ): Promise<boolean> {
    if (!(await this.lines.isComplete(tx, line.request_id))) return false;
    const n = await repo.countRequestDeliveries(tx, line.request_id);
    await this.notifications.notifyWithin(tx, {
      eventId: eventIds.requestDelivered(line.request_id, n),
      recipients: [line.user_sub],
      topic: 'request_delivered',
      params: { ym: line.period_ym },
      link: `/history/${line.period_ym}`,
      now,
    });
    return true;
  }

  async assertPeriodLocked(tx: Tx, ym: string, now: Date): Promise<void> {
    const period = await this.periods.findSnapshot(ym, tx);
    if (!period || now < period.deadline) throw periodNotLocked();
  }
}

function toResult(
  line: LockedLine,
  qty: number,
  taken: StockResult | null,
): Omit<DeliverResult, 'request_complete'> {
  return {
    line: {
      id: line.id,
      qty: line.qty,
      delivered_qty: line.delivered_qty + qty,
      cancelled_qty: line.cancelled_qty,
    },
    movement_id: taken?.movement_id ?? null,
    stock_qty: taken?.stock_qty ?? null,
  };
}

export function remainingOf(line: LockedLine): number {
  return line.qty - line.delivered_qty - line.cancelled_qty;
}

function assertDeliverable(line: LockedLine): void {
  if (line.review_status === 'pending') throw lineNotReviewed();
  if (line.review_status === 'rejected') throw lineRejected();
}
