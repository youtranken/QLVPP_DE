import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { PeriodsService } from '../periods/periods.service';
import { LineDeliveryStore } from '../requests/line-delivery.store';
import type { OpenLine, RequestHead } from '../requests/line-delivery.store';
import { LineNotifier } from '../requests/line-notifier';
import { requestNotFound } from '../requests/request-errors';
import { UndoLedgerService } from '../undo/undo-ledger.service';
import { cancelNoteOf } from './cancel-reason';
import type { CancelPayload } from './cancel-undo.service';
import type {
  CancelRequestBody,
  CancelRequestResult,
  ExpectedRemaining,
} from './cancel-request.dto';
import { staleRequestCancel, userNotLeft } from './delivery-errors';

const USER_LEFT = 'user_left';

interface CancelledEntry {
  line: OpenLine;
  payload: CancelPayload;
  result: CancelRequestResult['lines'][number];
}

function assertExpected(open: OpenLine[], expected: ExpectedRemaining[]) {
  const want = new Map(expected.map((e) => [e.line_id, e.remaining]));
  const same =
    want.size === open.length &&
    open.every((l) => want.get(l.id) === l.remaining);
  if (!same)
    throw staleRequestCancel(
      open.map((l) => ({ line_id: l.id, remaining: l.remaining })),
    );
}

@Injectable()
export class CancelRequestService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly periods: PeriodsService,
    private readonly lines: LineDeliveryStore,
    private readonly audit: AuditWriterService,
    private readonly notifier: LineNotifier,
    private readonly undo: UndoLedgerService,
  ) {}

  // Không chuông: người đã nghỉ không đọc được; phiếu không còn nợ → 200 cancelled_now 0 (gửi lại an toàn)
  async cancelRequest(
    requestId: string,
    body: CancelRequestBody,
    actor: string,
  ): Promise<CancelRequestResult> {
    const { note } = cancelNoteOf({
      reason_code: USER_LEFT,
      expected_delivered_qty: 0,
      expected_qty: 1,
    });
    const now = this.clock.now();
    return this.db.transaction(async (tx) => {
      const locked = await this.lines.lockRequestOpenLines(tx, requestId);
      if (!locked) throw requestNotFound('Không tìm thấy phiếu.');
      const { head } = locked;
      await this.periods.assertLocked(head.period_ym, now, tx);
      if (await this.notifier.ownerActive(head.user_sub)) throw userNotLeft();
      const open = locked.lines.filter((l) => l.remaining > 0);
      const nothing = { request_id: head.id, cancelled_now: 0, lines: [] };
      if (open.length === 0) return { ...nothing, undo_id: null };
      assertExpected(open, body.expected_lines);
      const done = await this.cancelAll(tx, open, note, now);
      return this.afterCancel(tx, head, done, { actor, now, note });
    });
  }

  private async cancelAll(
    tx: Tx,
    open: OpenLine[],
    note: string,
    now: Date,
  ): Promise<CancelledEntry[]> {
    const done: CancelledEntry[] = [];
    for (const line of open) {
      const outcome = await this.lines.cancelRemaining(tx, line.id, note, now);
      done.push({
        line,
        result: { ...outcome.line, cancelled_now: outcome.cancelled_now },
        payload: {
          line_id: line.id,
          request_id: line.request_id,
          before: {
            cancelled_qty: line.cancelled_qty,
            cancel_note: outcome.note_before,
          },
          after: { cancelled_qty: outcome.line.cancelled_qty },
          bell: null,
        },
      });
    }
    return done;
  }

  private async afterCancel(
    tx: Tx,
    head: RequestHead,
    done: CancelledEntry[],
    by: { actor: string; now: Date; note: string },
  ): Promise<CancelRequestResult> {
    const { actor, now, note } = by;
    const parentId = await this.audit.appendWithin(tx, {
      actor,
      action: 'request.cancel_remaining',
      objectType: 'request',
      objectId: head.id,
      detail: {
        ym: head.period_ym,
        owner_sub: head.user_sub,
        reason: note,
        reason_code: USER_LEFT,
        lines: done.map((d) => ({
          line_id: d.line.id,
          before: { cancelled_qty: d.payload.before.cancelled_qty },
          after: d.payload.after,
        })),
      },
      at: now,
    });
    for (const d of done) {
      await this.audit.appendWithin(tx, {
        actor,
        action: 'line.cancel_remaining',
        objectType: 'request_line',
        objectId: d.line.id,
        detail: {
          request_id: head.id,
          before: { cancelled_qty: d.payload.before.cancelled_qty },
          after: d.payload.after,
          reason: note,
          reason_code: USER_LEFT,
          batch_id: parentId,
        },
        at: now,
      });
    }
    await this.lines.touchRequest(tx, head.id, now);
    const undoId = await this.undo.record(tx, {
      id: randomUUID(),
      kind: 'cancel',
      actor,
      now,
      payload: { request_id: head.id, lines: done.map((d) => d.payload) },
    });
    const lines = done.map((d) => d.result);
    const total = lines.reduce((n, l) => n + l.cancelled_now, 0);
    return {
      request_id: head.id,
      cancelled_now: total,
      lines,
      undo_id: undoId,
    };
  }
}
