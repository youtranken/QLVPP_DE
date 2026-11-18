import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { lockState } from '../periods/period-lock';
import { PeriodsService } from '../periods/periods.service';
import { LineDeliveryStore } from '../requests/line-delivery.store';
import type { OpenLine, RequestHead } from '../requests/line-delivery.store';
import { LineNotifier } from '../requests/line-notifier';
import { userNotFound } from '../requests/request-errors';
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

interface Actor {
  actor: string;
  now: Date;
  note: string;
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

  // Mọi phiếu còn nợ của người trong một tx: lệch một dòng thì không phiếu nào bị hủy.
  // Không chuông: người đã nghỉ không đọc được; không còn nợ → 200 cancelled_now 0 (gửi lại an toàn)
  async cancelUser(
    userSub: string,
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
      const status = await this.notifier.ownerStatus(userSub);
      if (status === null) throw userNotFound();
      const { heads, lines } = await this.lines.lockUserOpenLines(tx, userSub);
      const locked = await this.lockedRequests(tx, heads, lines, body, now);
      if (status === 'active') throw userNotLeft();
      const open = lines.filter(
        (l) => l.remaining > 0 && locked.has(l.request_id),
      );
      if (open.length === 0)
        return { user_sub: userSub, cancelled_now: 0, lines: [], undo_id: null };
      assertExpected(open, body.expected_lines);
      const done = await this.cancelAll(tx, open, note, now);
      const touched = heads.filter((h) =>
        done.some((d) => d.line.request_id === h.id),
      );
      return this.afterCancel(tx, userSub, touched, done, { actor, now, note });
    });
  }

  // Phiếu kỳ còn mở không bị hủy; gửi dòng của kỳ đó lên → PERIOD_NOT_LOCKED như các route theo kỳ
  private async lockedRequests(
    tx: Tx,
    heads: RequestHead[],
    lines: OpenLine[],
    body: CancelRequestBody,
    now: Date,
  ): Promise<Set<string>> {
    const openYm = (await this.periods.openPeriod(tx, now)).ym;
    const locked = new Set(
      heads
        .filter((h) => lockState(h.period_ym, openYm) === 'locked')
        .map((h) => h.id),
    );
    const sent = new Set(body.expected_lines.map((e) => e.line_id));
    for (const l of lines)
      if (sent.has(l.id) && !locked.has(l.request_id))
        await this.periods.assertLocked(l.period_ym, now, tx);
    return locked;
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
    userSub: string,
    heads: RequestHead[],
    done: CancelledEntry[],
    by: Actor,
  ): Promise<CancelRequestResult> {
    const { actor, now } = by;
    const parentId = await this.audit.appendWithin(tx, {
      actor,
      action: 'user.cancel_remaining',
      objectType: 'user',
      objectId: userSub,
      detail: {
        owner_sub: userSub,
        requests: heads.map((h) => ({ request_id: h.id, ym: h.period_ym })),
        reason: by.note,
        reason_code: USER_LEFT,
        lines: done.map((d) => ({
          line_id: d.line.id,
          before: { cancelled_qty: d.payload.before.cancelled_qty },
          after: d.payload.after,
        })),
      },
      at: now,
    });
    await this.auditLines(tx, done, parentId, by);
    for (const h of heads) await this.lines.touchRequest(tx, h.id, now);
    const undoId = await this.undo.record(tx, {
      id: randomUUID(),
      kind: 'cancel',
      actor,
      now,
      payload: { owner_sub: userSub, lines: done.map((d) => d.payload) },
    });
    const lines = done.map((d) => d.result);
    const total = lines.reduce((n, l) => n + l.cancelled_now, 0);
    return { user_sub: userSub, cancelled_now: total, lines, undo_id: undoId };
  }

  private async auditLines(
    tx: Tx,
    done: CancelledEntry[],
    parentId: Awaited<ReturnType<AuditWriterService['appendWithin']>>,
    { actor, now, note }: Actor,
  ): Promise<void> {
    for (const d of done) {
      await this.audit.appendWithin(tx, {
        actor,
        action: 'line.cancel_remaining',
        objectType: 'request_line',
        objectId: d.line.id,
        detail: {
          request_id: d.line.request_id,
          before: { cancelled_qty: d.payload.before.cancelled_qty },
          after: d.payload.after,
          reason: note,
          reason_code: USER_LEFT,
          batch_id: parentId,
        },
        at: now,
      });
    }
  }
}
