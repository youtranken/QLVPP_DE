import { Inject, Injectable } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LineDeliveryStore } from '../requests/line-delivery.store';
import { lineNotFound } from '../requests/request-errors';
import type { UndoResult } from '../undo/undo.dto';
import { UndoLedgerService } from '../undo/undo-ledger.service';
import type { UndoRow } from '../undo/undo-window';
import { staleCancel } from './delivery-errors';

interface CancelPayload {
  line_id: string;
  request_id: string;
  before: { cancelled_qty: number; cancel_note: string | null };
  after: { cancelled_qty: number };
  bell: string | null;
}

@Injectable()
export class CancelUndoService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly ledger: UndoLedgerService,
    private readonly lines: LineDeliveryStore,
    private readonly audit: AuditWriterService,
    private readonly notifications: NotificationsService,
  ) {}

  async undoCancels(ids: string[], actor: string): Promise<UndoResult> {
    const now = this.clock.now();
    return this.db.transaction(async (tx) => {
      const rows = await this.ledger.claimWithin(tx, {
        ids,
        kind: 'cancel',
        actor,
        now,
      });
      // Khóa theo (phiếu, dòng) như mọi đường ghi nhiều dòng: requests → request_lines
      const key = (p: CancelPayload) => `${p.request_id}|${p.line_id}`;
      const payloads = rows
        .map((r: UndoRow) => r.payload as unknown as CancelPayload)
        .sort((a, b) => (key(a) < key(b) ? -1 : 1));
      for (const p of payloads) await this.undoOne(tx, p, actor, now);
      return { undone: payloads.length };
    });
  }

  private async undoOne(
    tx: Tx,
    p: CancelPayload,
    actor: string,
    now: Date,
  ): Promise<void> {
    const line = await this.lines.lockLine(tx, p.line_id);
    if (!line) throw lineNotFound();
    const restored = await this.lines.restoreCancelled(
      tx,
      line.id,
      p.before,
      p.after.cancelled_qty,
      now,
    );
    if (!restored) throw staleCancel(line);
    await this.audit.appendWithin(tx, {
      actor,
      action: 'line.cancel_undone',
      objectType: 'request_line',
      objectId: line.id,
      detail: {
        request_id: line.request_id,
        before: {
          cancelled_qty: line.cancelled_qty,
          cancel_note: line.cancel_note,
        },
        after: {
          cancelled_qty: p.before.cancelled_qty,
          cancel_note: p.before.cancel_note,
        },
      },
      at: now,
    });
    await this.lines.touchRequest(tx, line.request_id, now);
    if (p.bell)
      await this.notifications.removeByEvent(line.user_sub, p.bell, tx);
  }
}
