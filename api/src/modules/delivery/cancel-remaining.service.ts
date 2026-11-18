import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { addMonths } from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { CatalogService } from '../catalog/catalog.service';
import { eventIds } from '../notifications/notification-events';
import { NotificationsService } from '../notifications/notifications.service';
import { PeriodsService } from '../periods/periods.service';
import { LineDeliveryStore } from '../requests/line-delivery.store';
import type {
  CancelOutcome,
  LockedLine,
} from '../requests/line-delivery.store';
import { LineNotifier } from '../requests/line-notifier';
import { lineNotFound } from '../requests/request-errors';
import { UndoLedgerService } from '../undo/undo-ledger.service';
import {
  ADM_OUT_NOTE,
  ADM_OUT_REASON,
  admOutCancelDetail,
  itemNotAdmOut,
  lockLineAdmOut,
} from './adm-out-cancel';
import { cancelNoteOf } from './cancel-reason';
import { notDebtYet, staleCancel } from './delivery-errors';
import type { CancelBody, CancelResult } from './delivery.dto';
import { assertDeliverable } from './delivery.service';

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
    private readonly notifier: LineNotifier,
    private readonly undo: UndoLedgerService,
  ) {}

  async cancelRemaining(
    lineId: string,
    body: CancelBody,
    actor: string,
  ): Promise<CancelResult> {
    const { code, note } = cancelNoteOf(body);
    const now = this.clock.now();
    return this.db.transaction(async (tx) => {
      const marked =
        code === ADM_OUT_REASON && (await lockLineAdmOut(tx, lineId));
      const line = await this.lines.lockLine(tx, lineId);
      if (!line) throw lineNotFound();
      await this.periods.assertLocked(line.period_ym, now, tx);
      const current = addMonths(
        (await this.periods.openPeriod(tx, now)).ym,
        -1,
      );
      const isDebt = line.period_ym < current;
      if (!isDebt && code !== ADM_OUT_REASON) throw notDebtYet();
      assertDeliverable(line);
      if (
        line.delivered_qty !== body.expected_delivered_qty ||
        line.qty !== body.expected_qty
      ) {
        throw staleCancel(line);
      }
      // Tháng đang giao chỉ hủy được khi khóa đang đánh ADM hết hàng (đường hộp giao); nợ tháng trước dùng mã như một lý do
      if (!isDebt && !marked) throw itemNotAdmOut();
      const reason = marked ? ADM_OUT_NOTE : note;
      const outcome = await this.lines.cancelRemaining(tx, lineId, reason, now);
      const result = {
        line: outcome.line,
        cancelled_now: outcome.cancelled_now,
      };
      if (result.cancelled_now === 0) return { ...result, undo_id: null };
      if (marked) return this.afterAdmOut(tx, line, result, actor, now);
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
          reason_code: code,
        },
        at: now,
      });
      await this.lines.touchRequest(tx, line.request_id, now);
      const bell =
        code !== 'user_left' && (await this.notifier.ownerActive(line.user_sub))
          ? await this.notifyOwner(tx, line, result, reason, now)
          : null;
      const undoId = await this.recordUndo(tx, line, outcome, bell, {
        actor,
        now,
      });
      return { ...result, undo_id: undoId };
    });
  }

  private recordUndo(
    tx: Tx,
    line: LockedLine,
    outcome: CancelOutcome,
    bell: string | null,
    by: { actor: string; now: Date },
  ): Promise<string> {
    return this.undo.record(tx, {
      id: randomUUID(),
      kind: 'cancel',
      actor: by.actor,
      now: by.now,
      payload: {
        line_id: line.id,
        request_id: line.request_id,
        before: {
          cancelled_qty: line.cancelled_qty,
          cancel_note: outcome.note_before,
        },
        after: { cancelled_qty: outcome.line.cancelled_qty },
        bell,
      },
    });
  }

  // ADM hết hàng: không chuông line_cancelled, gộp vào chuông ngày line_adjusted
  // Không mở hoàn tác: chuông ngày line_adjusted gộp nhiều lần hủy, không gỡ riêng một lần được
  private async afterAdmOut(
    tx: Tx,
    line: LockedLine,
    result: Omit<CancelResult, 'undo_id'>,
    actor: string,
    now: Date,
  ): Promise<CancelResult> {
    await this.audit.appendWithin(tx, {
      actor,
      action: 'line.cancel_remaining',
      objectType: 'request_line',
      objectId: line.id,
      detail: admOutCancelDetail(line, result, now),
      at: now,
    });
    await this.lines.touchRequest(tx, line.request_id, now);
    await this.notifier.linesAdjusted(tx, {
      userSub: line.user_sub,
      ym: line.period_ym,
      reasons: [ADM_OUT_REASON],
      now,
    });
    return { ...result, undo_id: null };
  }

  // Không gọi notifyIfComplete: hủy nợ làm phiếu đủ thì không báo "đã giao đủ". Trả event_id khi chuông mới được ghi
  private async notifyOwner(
    tx: Tx,
    line: LockedLine,
    result: Omit<CancelResult, 'undo_id'>,
    reason: string,
    now: Date,
  ): Promise<string | null> {
    const item = line.item_id
      ? (await this.catalog.itemFacts([line.item_id], tx)).get(line.item_id)
      : undefined;
    const eventId = eventIds.lineCancelled(line.id, result.line.cancelled_qty);
    const written = await this.notifications.notifyWithin(tx, {
      eventId,
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
    return written > 0 ? eventId : null;
  }
}
